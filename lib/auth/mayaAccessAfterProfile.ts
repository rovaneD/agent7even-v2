import type { SupabaseClient } from '@supabase/supabase-js'
import { profileBypassesSubscriptionGate } from '@/lib/billing/subscriptionGate'
import { getBillingProfileForClerkUser } from '@/lib/profiles/getBillingProfile'
import { loadDashboardSession } from '@/lib/profiles/getDashboardWorkspaceContext'

/** After an Atlas-first user deliberately opens Maya, send them through normal access — never a paid bypass. */
export function mayaAccessAfterProfile(opts: {
  profile: { id: string } | null
  isTeamMember: boolean
  billing: {
    role?: string | null
    billing_exempt?: boolean | null
    stripe_subscription_id?: string | null
    plan?: string | null
    status?: string | null
  } | null
}): 'start-trial' | 'continue' {
  if (!opts.profile) return 'start-trial'
  if (opts.isTeamMember) return 'continue'
  if (!opts.billing || !profileBypassesSubscriptionGate(opts.billing)) {
    return 'start-trial'
  }
  return 'continue'
}

/**
 * Same decision as the dashboard home gate, for every dashboard route and
 * paid Maya/campaign calls. Team members, admins, and comp accounts continue.
 */
export async function loadMayaProductAccess(
  supabase: SupabaseClient,
  clerkUserId: string,
  email?: string | null,
) {
  const { profile, workspace } = await loadDashboardSession(supabase, clerkUserId, email)
  const billing = await getBillingProfileForClerkUser(supabase, clerkUserId, email)
  const access = mayaAccessAfterProfile({
    profile,
    isTeamMember: workspace?.isTeamMember ?? false,
    billing,
  })
  return { profile, workspace, billing, access }
}
