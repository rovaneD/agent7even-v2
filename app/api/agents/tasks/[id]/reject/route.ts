import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: taskId } = await params
  const { outputId, note = '', feedback, feedbackNote } = await req.json()

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
  const rejectionText = feedbackNote ?? note ?? null

  const [outputRes, taskRes] = await Promise.all([
    supabase
      .from('agent_outputs')
      .update({
        status:       'rejected',
        feedback:     feedback ?? null,
        feedback_note: rejectionText,
        feedback_at:  now,
      })
      .eq('id', outputId)
      .eq('user_id', profile.id),

    supabase
      .from('agent_tasks')
      .update({
        rejected_at:      now,
        rejection_note:   rejectionText,
        rejection_reason: feedback ?? null,
        reviewed_at:      now,
        reviewed_by:      profile.id,
      })
      .eq('id', taskId)
      .eq('user_id', profile.id)
      .select(),
  ])

  if (outputRes.error) return NextResponse.json({ error: outputRes.error.message }, { status: 500 })
  if (taskRes.error)   return NextResponse.json({ error: taskRes.error.message },   { status: 500 })

  const task = taskRes.data?.[0] ?? null

  // Re-queue with rejection note as additional context
  if (task && rejectionText) {
    const { createTask } = await import('@/lib/agents/runner')
    const { dispatchAgentTask } = await import('@/lib/agents/dispatch')
    const replacement = await createTask({
      userId:      profile.id,
      agent:       task.agent,
      input:       { ...(task.input as Record<string, unknown>), rejection_feedback: rejectionText },
      triggerType: 'user',
      priority:    task.priority,
    })
    waitUntil(
      dispatchAgentTask({
        taskId: replacement.id,
        agent: task.agent,
        input: { ...(task.input as Record<string, unknown>), rejection_feedback: rejectionText },
        userId: profile.id,
      })
    )
  }

  return NextResponse.json({ success: true })
}
