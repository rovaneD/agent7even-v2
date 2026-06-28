import type { SupabaseClient } from '@supabase/supabase-js'
import { pickCanonicalProfile } from './ensureProfile'

const BILLING_SELECT =
  'id, plan, status, billing_exempt, stripe_customer_id, stripe_subscription_id, created_at'

export type BillingProfile = {
  id: string
  plan: string | null
  status: string | null
  billing_exempt: boolean
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
}

/** Prefer the profile row with Stripe/plan data when duplicates exist. */
export async function getBillingProfileForClerkUser(
  supabase: SupabaseClient,
  clerkUserId: string,
): Promise<BillingProfile | null> {
  const { data: rows } = await supabase
    .from('profiles')
    .select(BILLING_SELECT)
    .eq('clerk_user_id', clerkUserId)

  if (!rows?.length) return null
  const canonical = pickCanonicalProfile(rows as BillingProfile[])
  return {
    ...canonical,
    billing_exempt: canonical.billing_exempt ?? false,
  }
}
