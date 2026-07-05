import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  getWorkspaceSessionFromRequest,
  workspaceDataUserId,
} from '@/lib/profiles/workspaceSession'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const session = await getWorkspaceSessionFromRequest(supabase)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = workspaceDataUserId(session)

  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? 'pending_approval'

  const { data, error } = await supabase
    .from('agent_outputs')
    .select('*, agent_tasks(agent, input, trigger_type, created_at)')
    .eq('user_id', workspaceId)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
