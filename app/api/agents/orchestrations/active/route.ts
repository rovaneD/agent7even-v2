import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  getWorkspaceSessionFromRequest,
  workspaceDataUserId,
} from '@/lib/profiles/workspaceSession'

export async function GET() {
  const supabase = createServiceClient()
  const session = await getWorkspaceSessionFromRequest(supabase)
  if (!session) return NextResponse.json({ orchestration: null })

  const workspaceId = workspaceDataUserId(session)

  const { data } = await supabase
    .from('orchestration_sessions')
    .select('id, triggered_by, status, total_tasks, completed_tasks, agent_ids, agent_status')
    .eq('user_id', workspaceId)
    .eq('status', 'running')
    .order('created_at', { ascending: false })
    .limit(1)

  return NextResponse.json({ orchestration: data?.[0] ?? null })
}
