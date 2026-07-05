import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  getWorkspaceSessionFromRequest,
  workspaceDataUserId,
} from '@/lib/profiles/workspaceSession'

export async function GET() {
  const supabase = createServiceClient()
  const session = await getWorkspaceSessionFromRequest(supabase)
  if (!session) return NextResponse.json({ orchestrations: [] })

  const workspaceId = workspaceDataUserId(session)

  const { data } = await supabase
    .from('orchestration_sessions')
    .select('id, triggered_by, status, total_tasks, completed_tasks, total_cost_usd, budget_exceeded, completed_at')
    .eq('user_id', workspaceId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(5)

  return NextResponse.json({ orchestrations: data ?? [] })
}
