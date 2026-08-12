import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createServiceClient } from '@/lib/supabase/server'
import { createTask } from '@/lib/agents/runner'
import { dispatchAgentTask } from '@/lib/agents/dispatch'
import { resolveContentPostingFlow } from '@/lib/agents/contentPosting'
import { assertPostAssetOwnedByProfile } from '@/lib/agents/imageGeneration'
import { AgentId } from '@/lib/agents/registry'
import { readPostMediaRef } from '@/lib/postAssets'
import { logActivity } from '@/lib/activity'
import { hasPlatformAccess } from '@/lib/plans'
import {
  getWorkspaceSessionFromRequest,
  workspaceActorId,
  workspaceDataUserId,
} from '@/lib/profiles/workspaceSession'

export async function POST(req: Request) {
  const supabase = createServiceClient()
  const session = await getWorkspaceSessionFromRequest(supabase)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = workspaceDataUserId(session)
  const memberId = workspaceActorId(session)

  // Agent runs cost model spend — require the workspace to be in good billing
  // standing (failed payments set status 'paused', cancellation 'churned').
  const { data: billingRow } = await supabase
    .from('profiles')
    .select('plan, status, billing_exempt')
    .eq('id', workspaceId)
    .maybeSingle()
  if (!hasPlatformAccess(billingRow?.plan, billingRow?.status, billingRow?.billing_exempt ?? false)) {
    return NextResponse.json(
      { error: 'An active subscription is required to run agents.', code: 'NO_ACTIVE_PLAN' },
      { status: 403 },
    )
  }

  const body = await req.json()
  const { agent, input = {}, priority = 'normal', scheduledFor } = body

  if (!agent) return NextResponse.json({ error: 'agent is required' }, { status: 400 })

  const taskInput = (input ?? {}) as Record<string, unknown>
  const mediaRef = readPostMediaRef(taskInput)
  if (
    agent === 'content_posting'
    && resolveContentPostingFlow(taskInput) === 'single'
    && !mediaRef.media_storage_path
  ) {
    return NextResponse.json(
      { error: 'Attach the post image before running Single post.' },
      { status: 400 },
    )
  }

  // Client-supplied storage paths must stay under this workspace. Without this
  // check, executeAgentRun's service-role download + approve publish can read
  // and redistribute another tenant's private post-assets.
  if (
    mediaRef.media_storage_path
    && !assertPostAssetOwnedByProfile(mediaRef.media_storage_path, workspaceId)
  ) {
    return NextResponse.json(
      { error: 'Invalid media path.', code: 'invalid_storage_path' },
      { status: 403 },
    )
  }

  try {
    const task = await createTask({
      userId: workspaceId,
      actorProfileId: memberId,
      agent: agent as AgentId,
      input: taskInput,
      triggerType: 'user',
      priority,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
    })

    // Fire the agent immediately if not scheduled.
    // waitUntil keeps the execution context alive so the fetch isn't GC'd when the response returns.
    // On any failure, mark the task failed so it surfaces in the UI instead of hanging at pending.
    if (!scheduledFor) {
      waitUntil(
        dispatchAgentTask({
          taskId: task.id,
          agent,
          input: taskInput,
          userId: workspaceId,
        })
      )
    }

    logActivity(memberId, 'agent_run', { agent }, workspaceId).catch(() => {})
    return NextResponse.json({ taskId: task.id, status: task.status })
  } catch (err) {
    console.error('Create task error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
