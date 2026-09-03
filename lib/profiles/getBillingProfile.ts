import type { SupabaseClient } from '@supabase/supabase-js'
import { pickCanonicalProfile } from './ensureProfile'
import { filterRowsByExactEmail, selectWithEmail } from './emailMatch'

const BILLING_SELECT =
  'id, plan, status, billing_exempt, stripe_customer_id, stripe_subscription_id, role, created_at'

export type BillingProfile = {
  id: string
  plan: string | null
  status: string | null
  billing_exempt: boolean
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  role: string | null
  created_at: string
}

/** Prefer the profile row with Stripe/plan data when duplicates exist. */
export async function getBillingProfileForClerkUser(
  supabase: SupabaseClient,
  clerkUserId: string,
  email?: string | null,
): Promise<BillingProfile | null> {
  const { data: byClerk } = await supabase
    .from('profiles')
    .select(BILLING_SELECT)
    .eq('clerk_user_id', clerkUserId)

  if (byClerk?.length) {
    const canonical = pickCanonicalProfile(byClerk as BillingProfile[])
    return {
      ...canonical,
      billing_exempt: canonical.billing_exempt ?? false,
    }
  }

  const normalizedEmail = email?.trim()
  if (!normalizedEmail) return null

  const { data: byEmail } = await supabase
    .from('profiles')
    .select(selectWithEmail(BILLING_SELECT))
    .ilike('email', normalizedEmail)
    .neq('status', 'churned')
    .order('created_at', { ascending: true })

  const exactEmailRows = filterRowsByExactEmail(
    byEmail as Array<BillingProfile & { email?: string | null }> | null,
    normalizedEmail,
  )
  if (!exactEmailRows.length) return null

  const canonical = pickCanonicalProfile(exactEmailRows)
  return {
    ...canonical,
    billing_exempt: canonical.billing_exempt ?? false,
  }
}
