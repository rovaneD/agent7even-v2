import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { publishApprovedImageCaption } from '@/lib/agents/publishApprovedOutput'
import { shouldPublishApprovedPost, singlePostPublishBlockReason } from '@/lib/agents/contentPosting'
import { linkOutputToZernioPost } from '@/lib/content/agentOutputLifecycle'
import { logApprovalChangelog } from '@/lib/foundation/changelog'
import { PENDING_APPROVAL_OUTPUT_STATUS } from '@/lib/agents/pendingApprovals'
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
  const { outputId, editedContent } = await req.json()

  const supabase = createServiceClient()
  const session = await getWorkspaceSessionFromRequest(supabase)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = workspaceDataUserId(session)
  const memberId = workspaceActorId(session)

  const perms = await getTeamPermissions(memberId)
  if (!perms.isOwner) {
    return NextResponse.json({ error: 'Only account owners can approve agent output' }, { status: 403 })
  }

  if (typeof outputId !== 'string' || !outputId.trim()) {
    return NextResponse.json({ error: 'outputId required' }, { status: 400 })
  }

  const now = new Date().toISOString()
  let contentBefore: unknown = null

  const [{ data: task }, { data: output, error: outputLookupError }] = await Promise.all([
    supabase
      .from('agent_tasks')
      .select('id, agent, input')
      .eq('id', taskId)
      .eq('user_id', workspaceId)
      .maybeSingle(),
    supabase
      .from('agent_outputs')
      .select('id, title, content, status, task_id')
      .eq('id', outputId)
      .eq('task_id', taskId)
      .eq('user_id', workspaceId)
      .maybeSingle(),
  ])

  if (outputLookupError) {
    return NextResponse.json({ error: outputLookupError.message }, { status: 500 })
  }

  if (!task || !output) {
    return NextResponse.json({ error: 'Pending output not found' }, { status: 404 })
  }

  if (output.status !== PENDING_APPROVAL_OUTPUT_STATUS) {
    return NextResponse.json({ error: 'Output is not pending approval' }, { status: 400 })
  }

  const outputUpdate: Record<string, unknown> = {
    status: 'approved',
    approved_at: now,
    lifecycle_stage: 'approved',
  }
  if (typeof editedContent === 'string') {
    const prev = (output.content ?? {}) as Record<string, unknown>
    contentBefore = prev
    outputUpdate.content = { ...prev, raw: editedContent }
  }

  const { data: updatedOutput, error: outputUpdateError } = await supabase
    .from('agent_outputs')
    .update(outputUpdate)
    .eq('id', outputId)
    .eq('task_id', taskId)
    .eq('user_id', workspaceId)
    .eq('status', PENDING_APPROVAL_OUTPUT_STATUS)
    .select('id, title, content')
    .maybeSingle()

  if (outputUpdateError) return NextResponse.json({ error: outputUpdateError.message }, { status: 500 })
  if (!updatedOutput) {
    return NextResponse.json({ error: 'Output was already reviewed' }, { status: 409 })
  }

  const taskRes = await supabase
    .from('agent_tasks')
    .update({ approved_at: now, reviewed_at: now, reviewed_by: memberId })
    .eq('id', taskId)
    .eq('user_id', workspaceId)

  if (taskRes.error) return NextResponse.json({ error: taskRes.error.message }, { status: 500 })

  const outputContent = (updatedOutput.content ?? {}) as Record<string, unknown>
  const caption = typeof outputContent.raw === 'string' ? outputContent.raw : ''

  const publishOpts = {
    agentId: (task?.agent as string) ?? '',
    taskInput: (task?.input ?? {}) as Record<string, unknown>,
    outputContent,
    caption,
  }

  let publish: Awaited<ReturnType<typeof publishApprovedImageCaption>> | null = null
  const publishBlocked = singlePostPublishBlockReason(publishOpts)
  if (shouldPublishApprovedPost(publishOpts)) {
    publish = await publishApprovedImageCaption({
      profileId: workspaceId,
      outputId,
      taskInput: publishOpts.taskInput,
      outputContent,
      caption,
      taskId,
    })
    if (publish?.scheduled && publish.postId) {
      await linkOutputToZernioPost(supabase, {
        userId: workspaceId,
        outputId,
        zernioPostId: publish.postId,
        stage: 'draft',
      })
    }
  }

  logActivity(memberId, 'agent_approved', {
    taskId,
    agent: (task?.agent as string) ?? undefined,
    publishScheduled: publish?.scheduled ?? false,
  }, workspaceId).catch(() => {})

  logApprovalChangelog({
    actorProfileId: memberId,
    taskId,
    agentId: (task?.agent as string) ?? 'unknown',
    outputId,
    title: updatedOutput.title,
    contentBefore,
    contentAfter: outputContent,
    editedContent: typeof editedContent === 'string' ? editedContent : null,
  })

  return NextResponse.json({ success: true, publish, publishBlocked })
}
