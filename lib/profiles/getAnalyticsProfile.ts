import type { SupabaseClient } from '@supabase/supabase-js'
import { pickCanonicalProfile } from './ensureProfile'

const ANALYTICS_SELECT = `
  id,
  company_name,
  plan,
  ga_connected,
  ga_measurement_id,
  ga_oauth_email,
  meta_connected,
  instagram_handle,
  meta_ad_account_id,
  zernio_profile_id,
  zernio_profile_ids,
  zernio_connected_platforms,
  stripe_customer_id,
  stripe_subscription_id,
  created_at
`

export type AnalyticsProfile = {
  id: string
  company_name: string | null
  plan: string | null
  ga_connected: boolean | null
  ga_measurement_id: string | null
  ga_oauth_email: string | null
  meta_connected: boolean | null
  instagram_handle: string | null
  meta_ad_account_id: string | null
  zernio_profile_id: string | null
  zernio_profile_ids: string[] | null
  zernio_connected_platforms: string[] | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
}

/** Prefer the profile row with Stripe/plan data when duplicates exist. */
export async function getAnalyticsProfileForClerkUser(
  supabase: SupabaseClient,
  clerkUserId: string,
  email?: string | null,
): Promise<AnalyticsProfile | null> {
  const { data: byClerk } = await supabase
    .from('profiles')
    .select(ANALYTICS_SELECT)
    .eq('clerk_user_id', clerkUserId)

  if (byClerk?.length) {
    return pickCanonicalProfile(byClerk as AnalyticsProfile[])
  }

  const normalizedEmail = email?.trim()
  if (!normalizedEmail) return null

  const { data: byEmail } = await supabase
    .from('profiles')
    .select(ANALYTICS_SELECT)
    .ilike('email', normalizedEmail)
    .neq('status', 'churned')
    .order('created_at', { ascending: true })

  if (!byEmail?.length) return null

  return pickCanonicalProfile(byEmail as AnalyticsProfile[])
}
