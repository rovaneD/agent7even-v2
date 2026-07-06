import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createServiceClient } from '@/lib/supabase/server'
import { buildRequeueTaskInput } from '@/lib/agents/requeueTaskInput'
import { rejectAllPendingOutputsForTask } from '@/lib/agents/approvalQueueMutations'
import { logRejectionChangelog } from '@/lib/foundation/changelog'
import {
  getWorkspaceSessionFromRequest,
  workspaceActorId,
  workspaceDataUserId,
} from '@/lib/profiles/workspaceSession'
import { getTeamPermissions } from '@/lib/teamPermissions'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params
  const { outputId, note = '', feedback, feedbackNote, rerun = false } = await req.json()

  const supabase = createServiceClient()
  const session = await getWorkspaceSessionFromRequest(supabase)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = workspaceDataUserId(session)
  const memberId = workspaceActorId(session)

  const perms = await getTeamPermissions(memberId)
  if (!perms.isOwner) {
    return NextResponse.json({ error: 'Only account owners can reject agent output' }, { status: 403 })
  }

  const rejectionText = feedbackNote ?? note ?? null

  const result = await rejectAllPendingOutputsForTask(supabase, {
    workspaceId,
    actorProfileId: memberId,
    taskId,
    rejectionText,
    feedback: feedback ?? null,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'Task not found' ? 404 : 400 })
  }

  const task = result.task
  const primaryOutput =
    result.outputs.find(row => row.id === outputId) ?? result.outputs[0]

  logRejectionChangelog({
    actorProfileId: memberId,
    taskId,
    agentId: task.agent as string,
    outputId: primaryOutput?.id ?? outputId,
    title: primaryOutput?.title,
    content: primaryOutput?.content,
    rejectionReason: feedback ?? null,
    feedbackNote: rejectionText,
    rerun,
  })

  if (rerun && rejectionText) {
    const requeueInput = buildRequeueTaskInput(
      task.input as Record<string, unknown>,
      (primaryOutput?.content ?? null) as Record<string, unknown> | null,
      rejectionText,
    )
    const { createTask } = await import('@/lib/agents/runner')
    const { dispatchAgentTask } = await import('@/lib/agents/dispatch')
    const replacement = await createTask({
      userId: workspaceId,
      actorProfileId: memberId,
      agent: task.agent,
      input: requeueInput,
      triggerType: 'user',
      priority: task.priority,
    })
    waitUntil(
      dispatchAgentTask({
        taskId: replacement.id,
        agent: task.agent,
        input: requeueInput,
        userId: workspaceId,
      })
    )
  }

  return NextResponse.json({
    success: true,
    rejectedOutputCount: result.outputs.length,
  })
}
