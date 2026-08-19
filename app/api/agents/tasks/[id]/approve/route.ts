import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import {
  publishApprovedImageCaption,
  shouldRevertApprovalAfterPublish,
} from '@/lib/agents/publishApprovedOutput'
import { shouldPublishApprovedPost, singlePostPublishBlockReason } from '@/lib/agents/contentPosting'
import { linkOutputToZernioPost } from '@/lib/content/agentOutputLifecycle'
import { logApprovalChangelog } from '@/lib/foundation/changelog'
import { recordApprovalDecisionNote } from '@/lib/agents/approvalNotes'
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

  const outputUpdate: Record<string, unknown> = {
    status: 'approved',
    approved_at: now,
    lifecycle_stage: 'approved',
  }
  if (typeof editedContent === 'string') {
    const { data: existing } = await supabase
      .from('agent_outputs')
      .select('content')
      .eq('id', outputId)
      .eq('user_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
    const prev = (existing?.[0]?.content ?? {}) as Record<string, unknown>
    contentBefore = prev
    outputUpdate.content = { ...prev, raw: editedContent }
  }

  // Only a pending output can be approved — mirrors the reject path and stops
  // re-approval of already-rejected rows.
  const outputRes = await supabase
    .from('agent_outputs')
    .update(outputUpdate)
    .eq('id', outputId)
    .eq('user_id', workspaceId)
    .eq('status', 'pending_approval')
    .select('id')

  if (outputRes.error) return NextResponse.json({ error: outputRes.error.message }, { status: 500 })
  if (!outputRes.data?.length) {
    return NextResponse.json(
      { error: 'not_pending', message: 'This output is not awaiting approval.' },
      { status: 409 },
    )
  }

  const taskRes = await supabase
    .from('agent_tasks')
    .update({ approved_at: now, reviewed_at: now, reviewed_by: memberId })
    .eq('id', taskId)
    .eq('user_id', workspaceId)

  if (taskRes.error) return NextResponse.json({ error: taskRes.error.message }, { status: 500 })

  const [{ data: task }, { data: output }] = await Promise.all([
    supabase.from('agent_tasks').select('agent, input, actor_profile_id').eq('id', taskId).eq('user_id', workspaceId).single(),
    supabase.from('agent_outputs').select('title, content').eq('id', outputId).eq('user_id', workspaceId).single(),
  ])

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
  const intendedToPublish = shouldPublishApprovedPost(publishOpts)

  async function revertClaimedApproval() {
    const [outputRevert, taskRevert] = await Promise.all([
      supabase
        .from('agent_outputs')
        .update({
          status: 'pending_approval',
          approved_at: null,
          lifecycle_stage: 'review',
        })
        .eq('id', outputId)
        .eq('user_id', workspaceId)
        .eq('status', 'approved'),
      supabase
        .from('agent_tasks')
        .update({ approved_at: null, reviewed_at: null, reviewed_by: null })
        .eq('id', taskId)
        .eq('user_id', workspaceId),
    ])
    if (outputRevert.error) {
      console.error('[approve] failed to restore pending_approval after publish failure:', outputRevert.error)
    }
    if (taskRevert.error) {
      console.error('[approve] failed to clear task approval timestamps after publish failure:', taskRevert.error)
    }
  }

  if (intendedToPublish) {
    try {
      publish = await publishApprovedImageCaption({
        profileId: workspaceId,
        outputId,
        taskInput: publishOpts.taskInput,
        outputContent,
        caption,
        taskId,
      })
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'publish_threw'
      console.error('[approve] publish threw after claiming output:', detail)
      await revertClaimedApproval()
      return NextResponse.json(
        {
          error: 'publish_failed',
          detail,
          message: 'Could not create a Posts draft. The item is still awaiting approval — try again.',
        },
        { status: 502 },
      )
    }

    if (shouldRevertApprovalAfterPublish({ intendedToPublish: true, publish })) {
      await revertClaimedApproval()
      return NextResponse.json(
        {
          error: 'publish_failed',
          detail: publish?.detail ?? 'publish_failed',
          message: 'Could not create a Posts draft. The item is still awaiting approval — try again.',
        },
        { status: 502 },
      )
    }

    if (publish?.scheduled && publish.postId) {
      try {
        await linkOutputToZernioPost(supabase, {
          userId: workspaceId,
          outputId,
          zernioPostId: publish.postId,
          stage: 'draft',
        })
      } catch (err) {
        // Draft already exists in Zernio — keep approved so a retry cannot mint a second post.
        console.error('[approve] failed to link zernio_post_id after draft create:', err)
      }
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
