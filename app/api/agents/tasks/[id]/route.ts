import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getDashboardProfileForClerkUser } from '@/lib/profiles/getDashboardProfile'
import { resolveWorkspaceProfileId } from '@/lib/profiles/workspaceProfile'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: taskId } = await params
  const supabase = createServiceClient()

  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  const profile = await getDashboardProfileForClerkUser(supabase, userId, email)

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  const workspaceId = await resolveWorkspaceProfileId(supabase, profile.id)

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
