import { requireAdmin } from '@/lib/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ClientDetail from './ClientDetail'
import CanvasContextDispatcher from '@/components/maya/CanvasContextDispatcher'

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireAdmin()
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
    supabase.from('foundation_field_scores').select('field_name, score').eq('user_id', id),
    supabase
      .from('admin_notes')
      .select('id, body, created_at, profiles!admin_notes_admin_id_fkey(full_name, avatar_url)')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('support_tickets')
      .select('id, subject, status, priority, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (!profileResult.data) notFound()

  // Duplicate check
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

  const profile = profileResult.data as any
  const clientName = profile.full_name || profile.company_name || profile.email || id
  const contextStr = [
    `ADMIN — CLIENT DETAIL: ${clientName}`,
    `Company: ${profile.company_name ?? '—'}`,
    `Email: ${profile.email ?? '—'}`,
    `Plan: ${profile.plan ?? 'none'}`,
    `Status: ${profile.status ?? '—'}`,
    `Foundation score: ${profile.foundation_score ?? 0}`,
    `Engagement score: ${profile.engagement_score ?? 0}`,
    `Foundation complete: ${profile.foundation_complete ? 'yes' : 'no'}`,
    `Last active: ${profile.last_active_at ?? 'never'}`,
  ].join('\n')

  return (
    <>
      <CanvasContextDispatcher context={contextStr} />
      <ClientDetail
        clientId={id}
        initialProfile={profileResult.data as any}
        initialCreditBalance={creditResult.data?.balance ?? 0}
        initialNotes={(notesResult.data ?? []) as any}
        initialActivity={(activityResult.data ?? []) as any}
        initialTeamMembers={(teamResult.data ?? []) as any}
        initialTickets={(ticketsResult.data ?? []) as any}
        fieldScores={(fieldScoresResult.data ?? []) as any}
        duplicateAccount={duplicateAccount}
      />
    </>
  )
}
