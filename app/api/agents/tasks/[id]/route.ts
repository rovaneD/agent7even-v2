import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: taskId } = await params
  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: task, error: taskErr } = await supabase
    .from('agent_tasks')
    .select('*')
    .eq('id', taskId)
    .eq('user_id', profile.id)
    .single()

  if (taskErr || !task) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: outputs } = await supabase
    .from('agent_outputs')
    .select('id, task_id, agent, output_type, title, content, status, created_at')
    .eq('task_id', taskId)
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ task, outputs: outputs ?? [] })
}
