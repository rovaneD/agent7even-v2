import type { SupabaseClient } from '@supabase/supabase-js'
import { isProfileOnStarterTrial } from '@/lib/ai/toolkitPlanLimits'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'

export const BRAND_KIT_TRIAL_LOCKED = 'BRAND_KIT_TRIAL_LOCKED'

/**
 * Product rule: Brand Kit is locked during the Starter free trial.
 * The lock previously existed only as UI copy — every server surface that
 * reads or generates Brand Kit material must check this.
 */
export async function isBrandKitLockedForClerkUser(
  supabase: SupabaseClient,
  clerkUserId: string,
): Promise<boolean> {
  const profile = await resolveClerkProfile<{
    id: string
    plan: string | null
    status: string | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    created_at: string
  }>(supabase, clerkUserId, 'id, plan, stripe_subscription_id')

  if (!profile) return false
  return isProfileOnStarterTrial(profile)
}
