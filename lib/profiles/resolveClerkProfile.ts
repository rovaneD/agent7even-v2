import type { SupabaseClient } from '@supabase/supabase-js'
import { pickCanonicalProfile } from './ensureProfile'

type CanonicalProfileRow = {
  id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: string | null
  created_at: string
  role?: string | null
}

const CANONICAL_SUFFIX =
  'stripe_customer_id, stripe_subscription_id, plan, created_at, role'

function withCanonicalFields(select: string): string {
  const fields = select.split(',').map((f) => f.trim())
  for (const required of CANONICAL_SUFFIX.split(', ')) {
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
    .select(selectFields)
    .ilike('email', normalizedEmail)
    .neq('status', 'churned')
    .order('created_at', { ascending: true })

  if (!byEmail?.length) return null

  return pickCanonicalProfile(byEmail as unknown as T[])
}
