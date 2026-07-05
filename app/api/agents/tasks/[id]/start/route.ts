import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createServiceClient } from '@/lib/supabase/server'
import { dispatchAgentTask } from '@/lib/agents/dispatch'
import {
  getWorkspaceAuthContext,
  workspaceActorId,
  workspaceDataUserId,
} from '@/lib/profiles/workspaceSession'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: taskId } = await params
  const supabase = createServiceClient()
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberId = workspaceActorId(ctx.session)
  const workspaceId = workspaceDataUserId(ctx.session)

  const { data: task, error } = await supabase
    .from('agent_tasks')
    .select('id, agent, input, status, trigger_type, assigned_to_profile_id, user_id, started_at')
    .eq('id', taskId)
    .eq('user_id', workspaceId)
    .single()

  if (error || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  if (task.trigger_type !== 'assignment' || task.status !== 'pending' || task.started_at) {
    return NextResponse.json({ error: 'Task is not a pending assignment' }, { status: 400 })
  }

  const assigneeId = task.assigned_to_profile_id as string | null
  const isAssignee = assigneeId === memberId
  const isOwnerAssignee = !assigneeId && memberId === workspaceId

  if (!isAssignee && !isOwnerAssignee) {
    return NextResponse.json({ error: 'This assignment is not assigned to you' }, { status: 403 })
  }

  await supabase
    .from('agent_tasks')
    .update({
      actor_profile_id: memberId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)

  waitUntil(
    dispatchAgentTask({
      taskId,
      agent: task.agent as string,
      input: (task.input ?? {}) as Record<string, unknown>,
      userId: workspaceId,
    }),
  )

  return NextResponse.json({ success: true, taskId })
}
