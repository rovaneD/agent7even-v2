import type { SupabaseClient } from '@supabase/supabase-js'
import { pickCanonicalProfile } from './ensureProfile'

export const DASHBOARD_PROFILE_SELECT = `
  id, company_name, full_name, business_type, plan, role,
  website_url, instagram_handle, ideal_customer,
  sell_locations, marketing_budget, competitors,
  top_goals, marketing_challenge, content_comfort,
  foundation_complete, foundation_score, avatar_url,
  clerk_user_id, stripe_customer_id, stripe_subscription_id,
  status, created_at
`

export type DashboardProfile = {
  id: string
  company_name: string | null
  full_name: string | null
  business_type: string | null
  plan: string | null
  role: string | null
  website_url: string | null
  instagram_handle: string | null
  ideal_customer: string | null
  sell_locations: string[] | null
  marketing_budget: string | null
  competitors: string[] | null
  top_goals: string[] | null
  marketing_challenge: string | null
  content_comfort: string | null
  foundation_complete: boolean | null
  foundation_score: number | null
  avatar_url: string | null
  clerk_user_id: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: string | null
  created_at: string
}

/** Resolve the canonical dashboard profile for a Clerk session (clerk id, then email). */
export async function getDashboardProfileForClerkUser(
  supabase: SupabaseClient,
  clerkUserId: string,
  email?: string | null,
): Promise<DashboardProfile | null> {
  const { data: byClerk } = await supabase
    .from('profiles')
    .select(DASHBOARD_PROFILE_SELECT)
    .eq('clerk_user_id', clerkUserId)

  if (byClerk?.length) {
    return pickCanonicalProfile(byClerk as DashboardProfile[])
  }

  const normalizedEmail = email?.trim()
  if (!normalizedEmail) return null

  const { data: byEmail } = await supabase
    .from('profiles')
    .select(DASHBOARD_PROFILE_SELECT)
    .ilike('email', normalizedEmail)
    .neq('status', 'churned')
    .order('created_at', { ascending: true })

  if (!byEmail?.length) return null

  return pickCanonicalProfile(byEmail as DashboardProfile[])
}
