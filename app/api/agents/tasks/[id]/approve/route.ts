import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { publishApprovedImageCaption } from '@/lib/agents/publishApprovedOutput'
import { shouldPublishApprovedPost, singlePostPublishBlockReason } from '@/lib/agents/contentPosting'
import { linkOutputToZernioPost } from '@/lib/content/agentOutputLifecycle'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: taskId } = await params
  const { outputId, editedContent } = await req.json()
  if (typeof outputId !== 'string' || !outputId) {
    return NextResponse.json({ error: 'Missing outputId' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  const profile = profileRows?.[0] ?? null

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: existingOutput, error: existingOutputErr } = await supabase
    .from('agent_outputs')
    .select('content, lifecycle_stage, zernio_post_id')
    .eq('id', outputId)
    .eq('user_id', profile.id)
    .maybeSingle()

  if (existingOutputErr) {
    return NextResponse.json({ error: existingOutputErr.message }, { status: 500 })
  }
  if (!existingOutput) {
    return NextResponse.json({ error: 'Output not found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const linkedPostId = typeof existingOutput.zernio_post_id === 'string' && existingOutput.zernio_post_id
    ? existingOutput.zernio_post_id
    : null

  const outputUpdate: Record<string, unknown> = {
    status: 'approved',
    approved_at: now,
    lifecycle_stage: linkedPostId
      ? (existingOutput.lifecycle_stage ?? 'draft')
      : 'approved',
  }
  if (typeof editedContent === 'string') {
    const prev = (existingOutput.content ?? {}) as Record<string, unknown>
    outputUpdate.content = { ...prev, raw: editedContent }
  }

  const [outputRes, taskRes] = await Promise.all([
    supabase
      .from('agent_outputs')
      .update(outputUpdate)
      .eq('id', outputId)
      .eq('user_id', profile.id),
    supabase
      .from('agent_tasks')
      .update({ approved_at: now, reviewed_at: now, reviewed_by: profile.id })
      .eq('id', taskId)
      .eq('user_id', profile.id),
  ])

  if (outputRes.error) return NextResponse.json({ error: outputRes.error.message }, { status: 500 })
  if (taskRes.error) return NextResponse.json({ error: taskRes.error.message }, { status: 500 })

  const { data: task } = await supabase
    .from('agent_tasks')
    .select('agent, input')
    .eq('id', taskId)
    .eq('user_id', profile.id)
    .single()

  const outputContent = (outputUpdate.content ?? existingOutput.content ?? {}) as Record<string, unknown>
  const caption = typeof outputContent.raw === 'string' ? outputContent.raw : ''

  const publishOpts = {
    agentId: (task?.agent as string) ?? '',
    taskInput: (task?.input ?? {}) as Record<string, unknown>,
    outputContent,
    caption,
  }

  let publish: Awaited<ReturnType<typeof publishApprovedImageCaption>> | null = null
  const publishBlocked = singlePostPublishBlockReason(publishOpts)
  if (linkedPostId && shouldPublishApprovedPost(publishOpts)) {
    publish = { scheduled: true, postId: linkedPostId, detail: 'already_linked' }
  } else if (shouldPublishApprovedPost(publishOpts)) {
    publish = await publishApprovedImageCaption({
      profileId: profile.id,
      outputId,
      taskInput: publishOpts.taskInput,
      outputContent,
      caption,
      taskId,
    })
    if (publish?.scheduled && publish.postId) {
      try {
        await linkOutputToZernioPost(supabase, {
          userId: profile.id,
          outputId,
          zernioPostId: publish.postId,
          stage: 'draft',
        })
      } catch (err) {
        console.error('[approve] failed to link approved output to Zernio post:', err)
        const { error: stageErr } = await supabase
          .from('agent_outputs')
          .update({ lifecycle_stage: 'draft' })
          .eq('id', outputId)
          .eq('user_id', profile.id)
        if (stageErr) console.error('[approve] failed to preserve draft lifecycle stage:', stageErr)
        publish = { ...publish, detail: 'draft_created_link_pending' }
      }
    }
  }

  logActivity(profile.id, 'agent_approved', { taskId, publishScheduled: publish?.scheduled ?? false }).catch(() => {})
  return NextResponse.json({ success: true, publish, publishBlocked })
}
