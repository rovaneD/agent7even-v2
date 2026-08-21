import type { SupabaseClient } from '@supabase/supabase-js'
import { recoverPaidSubscriptionForClerkUser } from '@/lib/billing/activateCheckoutSession'
import { getBillingProfileForClerkUser } from '@/lib/profiles/getBillingProfile'
import { hasPlatformAccess } from '@/lib/plans'

export type SubscriptionGateResult =
  | { ok: true; profile: NonNullable<Awaited<ReturnType<typeof getBillingProfileForClerkUser>>> }
  | { ok: false; reason: 'no_profile' | 'no_subscription' }

type GateProfile = {
  role?: string | null
  billing_exempt?: boolean | null
  stripe_subscription_id?: string | null
  plan?: string | null
  status?: string | null
}

/** Ops / comp accounts — no customer billing emails or churn side-effects from Stripe webhooks. */
export function isInternalPlatformAccount(profile: {
  role?: string | null
  billing_exempt?: boolean | null
}): boolean {
  if (profile.role === 'admin' || profile.role === 'owner') return true
  if (profile.billing_exempt) return true
  return false
}

/** Internal admin/owner accounts, comp access, or an active paid/trialing Stripe subscription. */
export function profileBypassesSubscriptionGate(profile: GateProfile): boolean {
  if (profile.role === 'admin' || profile.role === 'owner') return true
  if (profile.billing_exempt) return true
  if (!profile.stripe_subscription_id) return false
  return hasPlatformAccess(profile.plan, profile.status, false)
}

/** Requires platform access — not necessarily a Stripe subscription (admin/comp exempt). */
export async function requirePaidSubscriptionForClerkUser(
  supabase: SupabaseClient,
  clerkUserId: string,
  email?: string | null,
): Promise<SubscriptionGateResult> {
  const profile = await getBillingProfileForClerkUser(supabase, clerkUserId, email)
  if (!profile) return { ok: false, reason: 'no_profile' }
  if (!profileBypassesSubscriptionGate(profile)) {
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
