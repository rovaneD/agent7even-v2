import { requireAdmin } from '@/lib/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'
import {
  resolveAdminWorkspaceContext,
  type AdminWorkspaceContext,
} from '@/lib/admin/resolveAdminClientWorkspace'
import { notFound } from 'next/navigation'
import ClientDetail from './ClientDetail'

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireAdmin()
  const supabase = createServiceClient()

  const profileResult = await supabase.from('profiles').select('*').eq('id', id).single()
  if (!profileResult.data) notFound()

  const profile = profileResult.data as Record<string, unknown>
  const workspaceBase = await resolveAdminWorkspaceContext(
    supabase,
    profile as { id: string; is_account_owner?: boolean | null; account_id?: string | null },
  )
  const { workspaceId, isTeamMember } = workspaceBase

  const [
    creditResult,
    teamResult,
    activityResult,
    fieldScoresResult,
    notesResult,
    ticketsResult,
    ownerResult,
  ] = await Promise.all([
    supabase.from('credit_balances').select('balance').eq('user_id', workspaceId).single(),
    isTeamMember
      ? Promise.resolve({ data: [] as unknown[] })
      : supabase
          .from('team_members')
          .select('*, profiles!team_members_member_profile_id_fkey(id, full_name, email, avatar_url)')
          .eq('account_id', id)
          .order('created_at', { ascending: false }),
    supabase
      .from('client_activity_log')
      .select('id, event_type, metadata, created_at, user_id')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('foundation_field_scores').select('field_name, score').eq('user_id', workspaceId),
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
    isTeamMember
      ? supabase
          .from('profiles')
          .select('id, full_name, email, company_name, plan, status, foundation_score, foundation_complete, foundation_answers, stripe_customer_id, billing_exempt')
          .eq('id', workspaceId)
          .single()
      : Promise.resolve({ data: null }),
  ])

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

  const activityRows = (activityResult.data ?? []) as Array<{
    id: string
    event_type: string
    metadata: unknown
    created_at: string
    user_id: string | null
  }>

  const actorIds = [...new Set(activityRows.map(row => row.user_id).filter(Boolean))] as string[]
  const actorNameById = new Map<string, string>()
  if (actorIds.length > 0) {
    const { data: actors } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', actorIds)
    for (const actor of actors ?? []) {
      actorNameById.set(
        actor.id as string,
        (actor.full_name as string | null)?.trim() || (actor.email as string | null)?.trim() || 'Team member',
      )
    }
  }

  const workspaceContext: AdminWorkspaceContext = {
    isTeamMember,
    workspaceId,
    owner: (ownerResult.data as AdminWorkspaceContext['owner']) ?? null,
    membership: workspaceBase.membership,
  }

  return (
    <ClientDetail
      clientId={id}
      initialProfile={profileResult.data as any}
      initialCreditBalance={creditResult.data?.balance ?? 0}
      initialNotes={(notesResult.data ?? []) as any}
      initialActivity={activityRows.map(row => ({
        ...row,
        actor_name: row.user_id ? actorNameById.get(row.user_id) ?? null : null,
      }))}
      initialTeamMembers={(teamResult.data ?? []) as any}
      initialTickets={(ticketsResult.data ?? []) as any}
      fieldScores={(fieldScoresResult.data ?? []) as any}
      duplicateAccount={duplicateAccount}
      workspaceContext={workspaceContext}
    />
  )
}
