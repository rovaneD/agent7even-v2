import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { memberId, permissions, role } = await req.json()
  if (!memberId) return NextResponse.json({ error: 'Member ID required' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, is_account_owner')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile || !profile.is_account_owner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Verify ownership of this team member
  const { data: member } = await supabase
    .from('team_members')
    .select('account_id')
    .eq('id', memberId)
    .single()

  if (!member || member.account_id !== profile.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('team_members')
    .update({
      permissions,
      role,
    })
    .eq('id', memberId)

  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  return NextResponse.json({ success: true })
}
