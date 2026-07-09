import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { publishApprovedImageCaption } from '@/lib/agents/publishApprovedOutput'
import { shouldPublishApprovedPost, singlePostPublishBlockReason } from '@/lib/agents/contentPosting'
import { linkOutputToZernioPost } from '@/lib/content/agentOutputLifecycle'
import { logApprovalChangelog } from '@/lib/foundation/changelog'
import { recordApprovalDecisionNote } from '@/lib/agents/approvalNotes'
import { PENDING_APPROVAL_OUTPUT_STATUS } from '@/lib/agents/pendingApprovals'
import {
  getWorkspaceSessionFromRequest,
  workspaceActorId,
  workspaceDataUserId,
} from '@/lib/profiles/workspaceSession'
import { requireWorkspaceOwner } from '@/lib/team/requireWorkspaceOwner'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params
  const { outputId, editedContent, comment } = await req.json()

  const supabase = createServiceClient()
  const session = await getWorkspaceSessionFromRequest(supabase)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = workspaceDataUserId(session)
  const memberId = workspaceActorId(session)

  const ownerCheck = await requireWorkspaceOwner(supabase, memberId, 'owner_required')
  if (!ownerCheck.ok) {
    return NextResponse.json(
      { error: ownerCheck.code, message: ownerCheck.error },
      { status: ownerCheck.status },
    )
  }

  const now = new Date().toISOString()
  let contentBefore: unknown = null
  const { data: existingOutput, error: existingOutputError } = await supabase
    .from('agent_outputs')
    .select('content')
    .eq('id', outputId)
    .eq('task_id', taskId)
    .eq('user_id', workspaceId)
    .eq('status', PENDING_APPROVAL_OUTPUT_STATUS)
    .maybeSingle()

  if (existingOutputError) {
    return NextResponse.json({ error: existingOutputError.message }, { status: 500 })
  }

  if (!existingOutput) {
    return NextResponse.json({ error: 'No pending output to approve' }, { status: 409 })
  }

  const outputUpdate: Record<string, unknown> = {
    status: 'approved',
    approved_at: now,
    lifecycle_stage: 'approved',
  }
  if (typeof editedContent === 'string') {
    const prev = (existingOutput.content ?? {}) as Record<string, unknown>
    contentBefore = prev
    outputUpdate.content = { ...prev, raw: editedContent }
  }

  const { data: updatedOutputs, error: outputError } = await supabase
    .from('agent_outputs')
    .update(outputUpdate)
    .eq('id', outputId)
    .eq('task_id', taskId)
    .eq('user_id', workspaceId)
    .eq('status', PENDING_APPROVAL_OUTPUT_STATUS)
    .select('title, content, zernio_post_id')

  if (outputError) return NextResponse.json({ error: outputError.message }, { status: 500 })

  const output = updatedOutputs?.[0]
  if (!output) {
    return NextResponse.json({ error: 'No pending output to approve' }, { status: 409 })
  }

  const taskRes = await supabase
    .from('agent_tasks')
    .update({ approved_at: now, reviewed_at: now, reviewed_by: memberId })
    .eq('id', taskId)
    .eq('user_id', workspaceId)

  if (taskRes.error) return NextResponse.json({ error: taskRes.error.message }, { status: 500 })

  const { data: task } = await supabase
    .from('agent_tasks')
    .select('agent, input, actor_profile_id')
    .eq('id', taskId)
    .eq('user_id', workspaceId)
    .single()

  const outputContent = (outputUpdate.content ?? output?.content ?? {}) as Record<string, unknown>
  const caption = typeof outputContent.raw === 'string' ? outputContent.raw : ''

  const publishOpts = {
    agentId: (task?.agent as string) ?? '',
    taskInput: (task?.input ?? {}) as Record<string, unknown>,
    outputContent,
    caption,
  }

  let publish: Awaited<ReturnType<typeof publishApprovedImageCaption>> | null = null
  const publishBlocked = singlePostPublishBlockReason(publishOpts)
  if (!output.zernio_post_id && shouldPublishApprovedPost(publishOpts)) {
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
    title: output?.title,
    contentBefore,
    contentAfter: outputContent,
    editedContent: typeof editedContent === 'string' ? editedContent : null,
  })

  const approvalComment = typeof comment === 'string' ? comment.trim() : ''
  if (approvalComment) {
    await recordApprovalDecisionNote({
      supabase,
      workspaceId,
      authorProfileId: memberId,
      taskId,
      agentId: (task?.agent as string) ?? 'unknown',
      noteKind: 'approved',
      body: approvalComment,
      actorProfileId: (task?.actor_profile_id as string | null) ?? null,
    })
  }

  return NextResponse.json({ success: true, publish, publishBlocked })
}
