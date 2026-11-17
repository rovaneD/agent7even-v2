import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getClerkUserSafe } from '@/lib/clerk/sessionUser'
import { createServiceClient } from '@/lib/supabase/server'
import { getDashboardProfileForClerkUser } from '@/lib/profiles/getDashboardProfile'
import type { VoixAccount, VoixMember } from '@/lib/voix/types'

/**
 * Voix access model
 * - Spa staff get access through a voix_members row (added by an Agent7even admin).
 *   Rows are matched by Clerk user id, or by verified email on first visit.
 * - Agent7even admins (profiles.role admin/owner) can open every account.
 * Voix does not depend on a Maya profile or subscription.
 */

export const ACCOUNT_SELECT =
  'id, name, timezone, retell_agent_ids, phone_number, transfer_number, alert_emails, status, digest_enabled, digest_hour, created_at'

export type VoixViewer = {
  clerkUserId: string
  email: string | null
  name: string | null
  isAdmin: boolean
  memberships: { member: VoixMember; account: VoixAccount }[]
}

export type VoixAccountContext = {
  viewer: VoixViewer
  account: VoixAccount
  /** The viewer's member row in this account; null for admins without one. */
  member: VoixMember | null
  supabase: SupabaseClient
}

async function isAgent7evenAdmin(
  supabase: SupabaseClient,
  clerkUserId: string,
  email: string | null,
): Promise<boolean> {
  try {
    const profile = await getDashboardProfileForClerkUser(supabase, clerkUserId, email)
    return ['admin', 'owner'].includes(profile?.role ?? '')
  } catch {
    return false
  }
}

async function loadViewer(supabase: SupabaseClient, clerkUserId: string): Promise<VoixViewer> {
  const user = await getClerkUserSafe()
  const email =
    user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() ??
    user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ??
    null
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || null

  // Claim invites sent to this email (first visit after sign-up).
  if (email) {
    await supabase
      .from('voix_members')
      .update({ clerk_user_id: clerkUserId, joined_at: new Date().toISOString() })
      .eq('email', email)
      .is('clerk_user_id', null)
  }

  const MEMBER_SELECT = 'id, account_id, email, full_name, clerk_user_id, role, invited_at, joined_at, last_seen_at'
  const [{ data: byClerk }, { data: byEmail }] = await Promise.all([
    supabase.from('voix_members').select(MEMBER_SELECT).eq('clerk_user_id', clerkUserId),
    email
      ? supabase.from('voix_members').select(MEMBER_SELECT).eq('email', email)
      : Promise.resolve({ data: [] as VoixMember[] }),
  ])
  const memberRows = [
    ...new Map([...(byClerk ?? []), ...(byEmail ?? [])].map((m) => [(m as VoixMember).id, m])).values(),
  ]

  // A row claimed by a different Clerk user is not ours, even if the email matches.
  const members = ((memberRows ?? []) as VoixMember[]).filter(
    (m) => !m.clerk_user_id || m.clerk_user_id === clerkUserId,
  )

  let memberships: VoixViewer['memberships'] = []
  if (members.length) {
    const { data: accounts } = await supabase
      .from('voix_accounts')
      .select(ACCOUNT_SELECT)
      .in('id', members.map((m) => m.account_id))
    const byId = new Map(((accounts ?? []) as VoixAccount[]).map((a) => [a.id, a]))
    memberships = members
      .filter((m) => byId.has(m.account_id))
      .map((m) => ({ member: m, account: byId.get(m.account_id)! }))
      .sort((a, b) => a.account.name.localeCompare(b.account.name))
  }

  const isAdmin = await isAgent7evenAdmin(supabase, clerkUserId, email)
  return { clerkUserId, email, name, isAdmin, memberships }
}

/** Page helper: signed-in viewer or redirect to the Voix sign-in. */
export async function requireVoixViewer(): Promise<{ viewer: VoixViewer; supabase: SupabaseClient }> {
  const { userId } = await auth()
  if (!userId) redirect('/voix/sign-in')
  const supabase = createServiceClient()
  const viewer = await loadViewer(supabase, userId)
  return { viewer, supabase }
}

async function resolveAccount(
  supabase: SupabaseClient,
  viewer: VoixViewer,
  accountId: string,
): Promise<{ account: VoixAccount; member: VoixMember | null } | null> {
  const membership = viewer.memberships.find((m) => m.account.id === accountId)
  if (membership) return { account: membership.account, member: membership.member }
  if (!viewer.isAdmin) return null
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) return null
  const { data } = await supabase.from('voix_accounts').select(ACCOUNT_SELECT).eq('id', accountId).maybeSingle()
  return data ? { account: data as VoixAccount, member: null } : null
}

/** Page helper: the account in the URL, or redirect when the viewer has no access. */
export async function requireVoixAccount(accountId: string): Promise<VoixAccountContext> {
  const { viewer, supabase } = await requireVoixViewer()
  const resolved = await resolveAccount(supabase, viewer, accountId)
  if (!resolved) redirect('/voix/app')
  await touchLastSeen(supabase, resolved.member)
  return { viewer, supabase, ...resolved }
}

/** Record staff activity for the admin monitor (at most every 10 minutes). */
async function touchLastSeen(supabase: SupabaseClient, member: VoixMember | null) {
  if (!member) return
  const last = member.last_seen_at ? new Date(member.last_seen_at).getTime() : 0
  if (Date.now() - last < 10 * 60_000) return
  const { error } = await supabase.from('voix_members').update({ last_seen_at: new Date().toISOString() }).eq('id', member.id)
  if (error) console.error('[voix/access] last_seen update failed:', error.message)
}

/** API helper: returns the context or an HTTP status to send back. */
export async function getVoixApiContext(
  accountId: string,
): Promise<{ ctx: VoixAccountContext } | { status: 401 | 403 }> {
  const { userId } = await auth()
  if (!userId) return { status: 401 }
  const supabase = createServiceClient()
  const viewer = await loadViewer(supabase, userId)
  const resolved = await resolveAccount(supabase, viewer, accountId)
  if (!resolved) return { status: 403 }
  return { ctx: { viewer, supabase, ...resolved } }
}

/** API helper for admin-only routes. */
export async function getVoixAdminContext(): Promise<
  { viewer: VoixViewer; supabase: SupabaseClient } | { status: 401 | 403 }
> {
  const { userId } = await auth()
  if (!userId) return { status: 401 }
  const supabase = createServiceClient()
  const viewer = await loadViewer(supabase, userId)
  if (!viewer.isAdmin) return { status: 403 }
  return { viewer, supabase }
}

/** Label for activity rows: member name, else email, else "Agent7even". */
export function actorLabel(ctx: VoixAccountContext): string {
  return ctx.member?.full_name || ctx.viewer.name || ctx.member?.email || ctx.viewer.email || 'Agent7even'
}
