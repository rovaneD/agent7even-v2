import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  getWorkspaceSessionFromRequest,
  workspaceDataUserId,
} from '@/lib/profiles/workspaceSession'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()
  const session = await getWorkspaceSessionFromRequest(supabase)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = workspaceDataUserId(session)

  const { data: digest, error } = await supabase
    .from('daily_digests')
    .select('id, agent_runs, approvals, today_actions, dismissed, email_sent, created_at')
    .eq('id', id)
    .eq('user_id', workspaceId)
    .single()

  if (error || !digest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(digest)
}
