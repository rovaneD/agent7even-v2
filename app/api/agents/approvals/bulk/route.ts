import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createServiceClient } from '@/lib/supabase/server'
import { buildRequeueTaskInput } from '@/lib/agents/requeueTaskInput'
import { logActivity } from '@/lib/activity'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, taskIds, feedback, feedbackNote, rerun = false } = await req.json()

  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return NextResponse.json({ error: 'taskIds required' }, { status: 400 })
  }
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
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

  const now = new Date().toISOString()

  if (action === 'approve') {
    const [tasksRes, outputsRes] = await Promise.all([
      supabase
        .from('agent_tasks')
        .update({ approved_at: now, reviewed_at: now, reviewed_by: profile.id })
        .in('id', taskIds)
        .eq('user_id', profile.id),
      supabase
        .from('agent_outputs')
        .update({ status: 'approved', approved_at: now, lifecycle_stage: 'approved' })
        .in('task_id', taskIds)
        .eq('user_id', profile.id),
    ])
    if (tasksRes.error) return NextResponse.json({ error: tasksRes.error.message }, { status: 500 })
    if (outputsRes.error) return NextResponse.json({ error: outputsRes.error.message }, { status: 500 })
    logActivity(profile.id, 'agent_bulk_approved', { count: taskIds.length }).catch(() => {})
  } else {
    const outputUpdate: Record<string, unknown> = {
      status: 'rejected',
      lifecycle_stage: 'rejected',
      feedback: feedback ?? null,
      feedback_note: feedbackNote ?? null,
      feedback_at: now,
    }
    const taskUpdate: Record<string, unknown> = {
      rejected_at: now,
      reviewed_at: now,
      reviewed_by: profile.id,
      rejection_reason: feedback ?? null,
    }

    // Re-queue each task with rejection feedback
    const { data: tasksToRequeue } = await supabase
      .from('agent_tasks')
      .select('id, agent, input, priority')
      .in('id', taskIds)
      .eq('user_id', profile.id)

    const [tasksRes, outputsRes] = await Promise.all([
      supabase
        .from('agent_tasks')
        .update(taskUpdate)
        .in('id', taskIds)
        .eq('user_id', profile.id),
      supabase
        .from('agent_outputs')
        .update(outputUpdate)
        .in('task_id', taskIds)
        .eq('user_id', profile.id),
    ])
    if (tasksRes.error) return NextResponse.json({ error: tasksRes.error.message }, { status: 500 })
    if (outputsRes.error) return NextResponse.json({ error: outputsRes.error.message }, { status: 500 })

    if (rerun && feedback && tasksToRequeue) {
      const { createTask } = await import('@/lib/agents/runner')
      const { dispatchAgentTask } = await import('@/lib/agents/dispatch')
      await Promise.all(
        tasksToRequeue.map(async task => {
          const { data: outputRow } = await supabase
            .from('agent_outputs')
            .select('content')
            .eq('task_id', task.id)
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          const requeueInput = buildRequeueTaskInput(
            task.input as Record<string, unknown>,
            (outputRow?.content ?? null) as Record<string, unknown> | null,
            feedbackNote ?? feedback,
          )
          const replacement = await createTask({
            userId: profile.id,
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
              userId: profile.id,
            })
          )
        })
      )
    }
    logActivity(profile.id, 'agent_bulk_rejected', { count: taskIds.length }).catch(() => {})
  }

  return NextResponse.json({ success: true, count: taskIds.length })
}
