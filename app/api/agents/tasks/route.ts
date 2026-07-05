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
  const statuses = url.searchParams.getAll('status')

  let query = supabase
    .from('agent_tasks')
    .select('*')
    .eq('user_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (statuses.length > 0) {
    query = query.in('status', statuses)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
