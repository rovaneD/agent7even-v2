import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  // Resolve profile
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  const profile = profileRows?.[0]
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Verify ownership before dismissing
  const { data: digest } = await supabase
    .from('daily_digests')
    .select('id, user_id')
    .eq('id', id)
    .single()

  if (!digest || digest.user_id !== profile.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await supabase
    .from('daily_digests')
    .update({ dismissed: true, dismissed_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ success: true })
}
