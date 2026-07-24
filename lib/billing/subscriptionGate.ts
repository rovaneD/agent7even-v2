import type { SupabaseClient } from '@supabase/supabase-js'
import { recoverPaidSubscriptionForClerkUser } from '@/lib/billing/activateCheckoutSession'
import { getBillingProfileForClerkUser } from '@/lib/profiles/getBillingProfile'
import { hasPlatformAccess } from '@/lib/plans'

export type SubscriptionGateResult =
  | { ok: true; profile: NonNullable<Awaited<ReturnType<typeof getBillingProfileForClerkUser>>> }
  | { ok: false; reason: 'no_profile' | 'no_subscription' }

/** Requires an active paid or trialing subscription (Stripe id on profile + platform access). */
export async function requirePaidSubscriptionForClerkUser(
  supabase: SupabaseClient,
  clerkUserId: string,
  email?: string | null,
): Promise<SubscriptionGateResult> {
  const profile = await getBillingProfileForClerkUser(supabase, clerkUserId, email)
  if (!profile) return { ok: false, reason: 'no_profile' }
  if (!profile.stripe_subscription_id) return { ok: false, reason: 'no_subscription' }
  if (!hasPlatformAccess(profile.plan, profile.status, profile.billing_exempt ?? false)) {
    return { ok: false, reason: 'no_subscription' }
  }
  return { ok: true, profile }
}

export function startTrialPath(plan?: string | null): string {
  return plan ? `/start-trial?plan=${encodeURIComponent(plan)}` : '/start-trial'
}

/** Gate check with Stripe recovery when profile is missing subscription data. */
export async function ensurePaidSubscriptionForClerkUser(
  supabase: SupabaseClient,
  clerkUserId: string,
  email?: string | null,
): Promise<SubscriptionGateResult> {
  const initial = await requirePaidSubscriptionForClerkUser(supabase, clerkUserId, email)
  if (initial.ok) return initial

  await recoverPaidSubscriptionForClerkUser(clerkUserId, email)
  return requirePaidSubscriptionForClerkUser(supabase, clerkUserId, email)
}
