import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

async function getAdminProfile(userId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_user_id', userId)
    .single()
  return data
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await getAdminProfile(userId)
  if (!admin || !['admin', 'owner'].includes(admin.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const [
    profileResult,
    creditResult,
    teamResult,
    activityResult,
    fieldScoresResult,
    notesResult,
    ticketsResult,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).single(),
    supabase.from('credit_balances').select('balance').eq('user_id', id).single(),
    supabase
      .from('team_members')
      .select('*, profiles!team_members_member_profile_id_fkey(id, full_name, email, avatar_url)')
      .eq('account_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('client_activity_log')
      .select('id, event_type, metadata, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('foundation_field_scores').select('*').eq('user_id', id),
    supabase
      .from('admin_notes')
      .select('*, profiles!admin_notes_admin_id_fkey(full_name, avatar_url)')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('support_tickets')
      .select('id, subject, status, priority, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (!profileResult.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check for duplicate accounts (same email, different id)
  let duplicateAccount = null
  if (profileResult.data.email) {
    const { data: dupes } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('email', profileResult.data.email)
      .neq('id', id)
      .limit(1)
    if (dupes && dupes.length > 0) duplicateAccount = dupes[0]
  }

  return NextResponse.json({
    profile: profileResult.data,
    creditBalance: creditResult.data?.balance ?? 0,
    teamMembers: teamResult.data ?? [],
    activity: activityResult.data ?? [],
    fieldScores: fieldScoresResult.data ?? [],
    notes: notesResult.data ?? [],
    tickets: ticketsResult.data ?? [],
    duplicateAccount,
  })
}
