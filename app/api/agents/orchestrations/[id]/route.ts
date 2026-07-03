import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  const profile = profileRows?.[0] ?? null
  if (!profile) return NextResponse.json({ orchestration: null }, { status: 404 })

  const { data, error } = await supabase
    .from('orchestration_sessions')
    .select('id, triggered_by, status, total_tasks, completed_tasks, budget_exceeded, agent_ids, agent_status, created_at, completed_at')
    .eq('id', id)
    .eq('user_id', profile.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ orchestration: null }, { status: 404 })

  return NextResponse.json({ orchestration: data })
}
