import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createServiceClient } from '@/lib/supabase/server'
import { buildRequeueTaskInput } from '@/lib/agents/requeueTaskInput'
import {
  rejectAllPendingOutputsForTask,
  resolveApprovalActorProfile,
} from '@/lib/agents/approvalQueueMutations'
import { logRejectionChangelog } from '@/lib/foundation/changelog'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: taskId } = await params
  const { outputId, note = '', feedback, feedbackNote, rerun = false } = await req.json()

  const supabase = createServiceClient()
  const profile = await resolveApprovalActorProfile(supabase, userId)
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const rejectionText = feedbackNote ?? note ?? null

  const result = await rejectAllPendingOutputsForTask(supabase, {
    profileId: profile.id,
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
    actorProfileId: profile.id,
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
  }

  return NextResponse.json({
    success: true,
    rejectedOutputCount: result.outputs.length,
  })
}
