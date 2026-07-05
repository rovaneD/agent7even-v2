import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveClerkProfile, resolveWorkspaceClerkProfile } from './resolveClerkProfile'
import { activateTeamInviteForProfile } from '@/lib/team/activateTeamInvite'

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
  const member = await resolveClerkProfile(supabase, clerkUserId, 'id', email)
  if (member && email?.trim()) {
    await activateTeamInviteForProfile(supabase, member.id, email)
  }

  return resolveWorkspaceClerkProfile<AnalyticsProfile>(
    supabase,
    clerkUserId,
    ANALYTICS_SELECT,
    email,
  )
}
