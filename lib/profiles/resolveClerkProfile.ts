import type { SupabaseClient } from '@supabase/supabase-js'
import { pickCanonicalProfile } from './ensureProfile'
import { filterRowsByExactEmail, selectWithEmail } from './emailMatch'

type CanonicalProfileRow = {
  id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: string | null
  created_at: string
  role?: string | null
  is_account_owner?: boolean | null
  account_id?: string | null
}

const CANONICAL_SUFFIX =
  'stripe_customer_id, stripe_subscription_id, plan, created_at, role'

const WORKSPACE_SUFFIX = 'is_account_owner, account_id'

function withCanonicalFields(select: string): string {
  const fields = select.split(',').map((f) => f.trim())
  for (const required of CANONICAL_SUFFIX.split(', ')) {
    if (!fields.includes(required)) fields.push(required)
  }
  return fields.join(', ')
}

function withWorkspaceFields(select: string): string {
  const fields = withCanonicalFields(select).split(',').map((f) => f.trim())
  for (const required of WORKSPACE_SUFFIX.split(', ')) {
    if (!fields.includes(required)) fields.push(required)
  }
  return fields.join(', ')
}

/** Resolve the canonical profile row for a Clerk user (handles duplicate rows). */
export async function resolveClerkProfile<T extends CanonicalProfileRow>(
  supabase: SupabaseClient,
  clerkUserId: string,
  select: string,
  email?: string | null,
): Promise<T | null> {
  const selectFields = withCanonicalFields(select)

  const { data: byClerk } = await supabase
    .from('profiles')
    .select(selectFields)
    .eq('clerk_user_id', clerkUserId)

  if (byClerk?.length) {
    return pickCanonicalProfile(byClerk as unknown as T[])
  }

  const normalizedEmail = email?.trim()
  if (!normalizedEmail) return null

  const { data: byEmail } = await supabase
    .from('profiles')
    .select(selectWithEmail(selectFields))
    .ilike('email', normalizedEmail)
    .neq('status', 'churned')
    .order('created_at', { ascending: true })

  const exactEmailRows = filterRowsByExactEmail(
    byEmail as Array<T & { email?: string | null }> | null,
    normalizedEmail,
  )
  if (!exactEmailRows.length) return null

  return pickCanonicalProfile(exactEmailRows)
}

/**
 * Resolve workspace-scoped profile data for a Clerk user.
 * Team members inherit the account owner's integrations, plan, and analytics connections.
 */
export async function resolveWorkspaceClerkProfile<T extends CanonicalProfileRow>(
  supabase: SupabaseClient,
  clerkUserId: string,
  select: string,
  email?: string | null,
): Promise<T | null> {
  const selectFields = withWorkspaceFields(select)
  const member = await resolveClerkProfile<T>(supabase, clerkUserId, selectFields, email)
  if (!member) return null

  if (member.is_account_owner !== false || !member.account_id) {
    if (member.is_account_owner !== true) {
      const accountId = await supabase
        .from('team_members')
        .select('account_id')
        .eq('member_profile_id', member.id)
        .eq('status', 'active')
        .maybeSingle()
        .then(({ data }) => (data?.account_id as string | null) ?? null)

      if (accountId) {
        const { data: owner } = await supabase
          .from('profiles')
          .select(selectFields)
          .eq('id', accountId)
          .maybeSingle()

        if (owner) {
          await supabase
            .from('profiles')
            .update({
              account_id: accountId,
              is_account_owner: false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', member.id)
            .or('account_id.is.null,is_account_owner.is.null,is_account_owner.eq.true')

          return owner as unknown as T
        }
      }
    }

    return member
  }

  const { data: owner } = await supabase
    .from('profiles')
    .select(selectFields)
    .eq('id', member.account_id)
    .maybeSingle()

  return (owner as T | null) ?? member
}
