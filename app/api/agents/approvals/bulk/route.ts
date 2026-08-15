import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createServiceClient } from '@/lib/supabase/server'
import { buildRequeueTaskInput } from '@/lib/agents/requeueTaskInput'
import { selectApprovedPublishTargets } from '@/lib/agents/approvedPublishTargets'
import { publishAndLinkApprovedPost } from '@/lib/agents/publishApprovedOutput'
import { logActivity } from '@/lib/activity'
import {
  logBulkApprovalChangelog,
  logBulkRejectionChangelog,
} from '@/lib/foundation/changelog'
import { rejectAllPendingOutputsForTask } from '@/lib/agents/approvalQueueMutations'
import {
  getWorkspaceSessionFromRequest,
  workspaceActorId,
  workspaceDataUserId,
} from '@/lib/profiles/workspaceSession'
import { requireWorkspaceOwner } from '@/lib/team/requireWorkspaceOwner'

export const maxDuration = 120

export async function POST(req: Request) {
  const { action, taskIds, feedback, feedbackNote, rerun = false } = await req.json()

  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return NextResponse.json({ error: 'taskIds required' }, { status: 400 })
  }
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const session = await getWorkspaceSessionFromRequest(supabase)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = workspaceDataUserId(session)
  const memberId = workspaceActorId(session)

  // Same guard as single approve/reject — team members must not bulk-approve.
  const ownerCheck = await requireWorkspaceOwner(supabase, memberId, 'owner_required')
  if (!ownerCheck.ok) {
    return NextResponse.json(
      { error: ownerCheck.code, message: ownerCheck.error },
      { status: ownerCheck.status },
    )
  }

  const now = new Date().toISOString()

  if (action === 'approve') {
    const [tasksRes, outputsRes] = await Promise.all([
      supabase
        .from('agent_tasks')
        .update({ approved_at: now, reviewed_at: now, reviewed_by: memberId })
        .in('id', taskIds)
        .eq('user_id', workspaceId)
        .select('id, agent, input'),
      // Scope to pending rows only — a task can carry rejected/superseded
      // outputs that must not flip to approved in a bulk action.
      supabase
        .from('agent_outputs')
        .update({ status: 'approved', approved_at: now, lifecycle_stage: 'approved' })
        .in('task_id', taskIds)
        .eq('user_id', workspaceId)
        .eq('status', 'pending_approval')
        .select('id, task_id, content'),
    ])
    if (tasksRes.error) return NextResponse.json({ error: tasksRes.error.message }, { status: 500 })
    if (outputsRes.error) return NextResponse.json({ error: outputsRes.error.message }, { status: 500 })

    const tasksById = new Map(
      (tasksRes.data ?? []).map(task => [task.id as string, task]),
    )
    const publishTargets = selectApprovedPublishTargets(outputsRes.data ?? [], tasksById)
    let publishedCount = 0
    for (const target of publishTargets) {
      const { publish } = await publishAndLinkApprovedPost({
        supabase,
        profileId: workspaceId,
        outputId: target.outputId,
        taskId: target.taskId,
        agentId: target.agentId,
        taskInput: target.taskInput,
        outputContent: target.outputContent,
        caption: target.caption,
      })
      if (publish?.scheduled) publishedCount += 1
    }

    logActivity(memberId, 'agent_bulk_approved', { count: taskIds.length }, workspaceId).catch(() => {})
    void logBulkApprovalChangelog(memberId, taskIds).catch(err => {
      console.error('[foundation-changelog] bulk approve log failed:', err)
    })
    return NextResponse.json({
      success: true,
      count: taskIds.length,
      publishedCount,
    })
  } else {
    const { data: tasksToRequeue } = await supabase
      .from('agent_tasks')
      .select('id, agent, input, priority')
      .in('id', taskIds)
      .eq('user_id', workspaceId)

    let rejectedCount = 0
    for (const taskId of taskIds) {
      const result = await rejectAllPendingOutputsForTask(supabase, {
        workspaceId,
        actorProfileId: memberId,
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
            .eq('user_id', workspaceId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          const requeueInput = buildRequeueTaskInput(
            task.input as Record<string, unknown>,
            (outputRow?.content ?? null) as Record<string, unknown> | null,
            feedbackNote ?? feedback,
          )
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
        })
      )
    }
    logActivity(memberId, 'agent_bulk_rejected', { count: taskIds.length }, workspaceId).catch(() => {})
    void logBulkRejectionChangelog(
      memberId,
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
