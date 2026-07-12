import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  getWorkspaceSessionFromRequest,
  workspaceDataUserId,
} from '@/lib/profiles/workspaceSession'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()
  const session = await getWorkspaceSessionFromRequest(supabase)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = workspaceDataUserId(session)

  // Verify ownership before dismissing
  const { data: digest } = await supabase
    .from('daily_digests')
    .select('id, user_id')
    .eq('id', id)
    .single()

  if (!digest || digest.user_id !== workspaceId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await supabase
    .from('daily_digests')
    .update({ dismissed: true, dismissed_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ success: true })
}
