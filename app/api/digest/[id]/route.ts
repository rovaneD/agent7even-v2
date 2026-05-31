import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
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
  const profile = profileRows?.[0]
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: digest, error } = await supabase
    .from('daily_digests')
    .select('id, agent_runs, approvals, today_actions, dismissed, email_sent, created_at')
    .eq('id', id)
    .eq('user_id', profile.id)
    .single()

  if (error || !digest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(digest)
}
