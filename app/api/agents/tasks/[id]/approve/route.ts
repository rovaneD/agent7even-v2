import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { publishApprovedImageCaption } from '@/lib/agents/publishApprovedOutput'
import { shouldPublishApprovedPost, singlePostPublishBlockReason } from '@/lib/agents/contentPosting'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: taskId } = await params
  const { outputId, editedContent } = await req.json()

  const supabase = createServiceClient()

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  const profile = profileRows?.[0] ?? null

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const now = new Date().toISOString()

  const outputUpdate: Record<string, unknown> = { status: 'approved', approved_at: now }
  if (typeof editedContent === 'string') {
    const { data: existing } = await supabase
      .from('agent_outputs')
      .select('content')
      .eq('id', outputId)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
    const prev = (existing?.[0]?.content ?? {}) as Record<string, unknown>
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

  const [{ data: task }, { data: output }] = await Promise.all([
    supabase.from('agent_tasks').select('agent, input').eq('id', taskId).eq('user_id', profile.id).single(),
    supabase.from('agent_outputs').select('content').eq('id', outputId).eq('user_id', profile.id).single(),
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
  if (shouldPublishApprovedPost(publishOpts)) {
    publish = await publishApprovedImageCaption({
      profileId: profile.id,
      taskInput: publishOpts.taskInput,
      outputContent,
      caption,
      taskId,
    })
  }

  logActivity(profile.id, 'agent_approved', { taskId, publishScheduled: publish?.scheduled ?? false }).catch(() => {})
  return NextResponse.json({ success: true, publish, publishBlocked })
}
