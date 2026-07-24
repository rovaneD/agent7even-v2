import type { PaidPlan } from '@/lib/plans'
import { PLAN_MONTHLY_PRICE } from '@/lib/plans'
import { getStripeClient } from '@/lib/stripe'

/** SSOT — trial terms (copy surfaces should import these, not hardcode). */
export const TRIAL_DAYS = 7
export const TRIAL_MEDIA_CREDITS = 25
export const FIRST_CHARGE_DAY = 8
export const TRIAL_TOOLKIT_RUNS = 5

/** Primary marketing label — tier-neutral. */
export const TRIAL_LABEL = '7-day free trial'
export const TRIAL_CARD_NOTE = 'Card required, no charge until day 8'
export const TRIAL_GUARANTEE_NOTE =
  '30-day money back on your first payment (see Terms after checkout).'

export const PLAN_TIER_RANK: Record<PaidPlan, number> = {
  starter: 1,
  growth: 2,
  proagent: 3,
}

export function isPaidPlanKey(plan: string | null | undefined): plan is PaidPlan {
  return plan === 'starter' || plan === 'growth' || plan === 'proagent'
}

export function comparePlanTier(
  fromPlan: string | null | undefined,
  toPlan: string | null | undefined,
): 'upgrade' | 'downgrade' | 'same' | null {
  if (!isPaidPlanKey(fromPlan) || !isPaidPlanKey(toPlan)) return null
  const delta = PLAN_TIER_RANK[toPlan] - PLAN_TIER_RANK[fromPlan]
  if (delta > 0) return 'upgrade'
  if (delta < 0) return 'downgrade'
  return 'same'
}

export function upgradeChargeMessage(plan: PaidPlan, annual: boolean): string {
  const monthly = PLAN_MONTHLY_PRICE[plan]
  const amount = annual ? Math.round(monthly * 10) : monthly
  const cadence = annual ? 'year' : 'month'
  return `Upgrading ends your trial and charges $${amount} today for your first ${cadence}.`
}

/**
 * Real trial signal — Stripe subscription status, NOT profiles.status
 * (webhook maps trialing → profiles.status = 'active').
 */
export async function isProfileOnTrial(profile: {
  stripe_subscription_id: string | null
}): Promise<boolean> {
  if (!profile.stripe_subscription_id) return false
  try {
    const stripe = getStripeClient()
    if (!stripe) return false
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id)
    return subscription.status === 'trialing'
  } catch {
    return false
  }
}

/** @deprecated Use isProfileOnTrial — Starter-only name removed in trial v2. */
export async function isProfileOnStarterTrial(profile: {
  plan: string | null
  stripe_subscription_id: string | null
}): Promise<boolean> {
  return isProfileOnTrial(profile)
}

export function trialEndingNotificationBody(plan: PaidPlan, endsLabel: string): string {
  return `Your ${TRIAL_LABEL} on ${plan} ends on ${endsLabel}. Your card will be charged on day ${FIRST_CHARGE_DAY} unless you cancel from Billing first.`
}
