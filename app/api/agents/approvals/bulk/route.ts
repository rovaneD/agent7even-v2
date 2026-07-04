import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createServiceClient } from '@/lib/supabase/server'
import { buildRequeueTaskInput } from '@/lib/agents/requeueTaskInput'
import { logActivity } from '@/lib/activity'
import {
  logBulkApprovalChangelog,
  logBulkRejectionChangelog,
} from '@/lib/foundation/changelog'
import { resolveApprovalActorProfile } from '@/lib/agents/approvalQueueMutations'
import { rejectAllPendingOutputsForTask } from '@/lib/agents/approvalQueueMutations'

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
  const profile = await resolveApprovalActorProfile(supabase, userId)
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
    void logBulkApprovalChangelog(profile.id, taskIds).catch(err => {
      console.error('[foundation-changelog] bulk approve log failed:', err)
    })
  } else {
    const { data: tasksToRequeue } = await supabase
      .from('agent_tasks')
      .select('id, agent, input, priority')
      .in('id', taskIds)
      .eq('user_id', profile.id)

    let rejectedCount = 0
    for (const taskId of taskIds) {
      const result = await rejectAllPendingOutputsForTask(supabase, {
        profileId: profile.id,
        taskId,
        rejectionText: feedbackNote ?? null,
        feedback: feedback ?? null,
      })
      if (result.ok) rejectedCount += result.outputs.length
    }

    if (rejectedCount === 0) {
      return NextResponse.json({ error: 'No pending outputs to reject' }, { status: 400 })
    }

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
    void logBulkRejectionChangelog(
      profile.id,
      taskIds,
      feedback ?? null,
      feedbackNote ?? null,
      rerun,
    ).catch(err => {
      console.error('[foundation-changelog] bulk reject log failed:', err)
    })
  }

  return NextResponse.json({ success: true, count: taskIds.length })
}
