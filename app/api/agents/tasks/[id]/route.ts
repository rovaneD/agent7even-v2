import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  getWorkspaceSessionFromRequest,
  workspaceDataUserId,
} from '@/lib/profiles/workspaceSession'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: taskId } = await params
  const supabase = createServiceClient()
  const session = await getWorkspaceSessionFromRequest(supabase)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = workspaceDataUserId(session)

  const { data: task, error: taskErr } = await supabase
    .from('agent_tasks')
    .select('*')
    .eq('id', taskId)
    .eq('user_id', workspaceId)
    .single()

  if (taskErr || !task) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: outputs } = await supabase
    .from('agent_outputs')
    .select('id, task_id, agent, output_type, title, content, status, created_at')
    .eq('task_id', taskId)
    .eq('user_id', workspaceId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ task, outputs: outputs ?? [] })
}
