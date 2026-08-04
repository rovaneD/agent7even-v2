/**
 * Abandoned Checkout Sessions leave incomplete subscriptions that must not
 * block a first real trial.
 */
const NON_PRIOR_SUBSCRIPTION_STATUSES = new Set(['incomplete', 'incomplete_expired'])

export type TrialEligibilitySubscription = {
  status: string
  trial_start?: number | null
}

export type CheckoutTrialEligibilityInput = {
  subscriptions: TrialEligibilitySubscription[]
  /** profiles.status — churned customers are returning buyers */
  profileStatus?: string | null
  /** credit_ledger already has a Trial allocation (covers recreated Stripe customers) */
  hadTrialCreditGrant?: boolean
}

/** True when Stripe history shows a real prior subscription (trial or paid). */
export function customerHadPriorSubscription(
  subscriptions: TrialEligibilitySubscription[],
): boolean {
  return subscriptions.some(sub => !NON_PRIOR_SUBSCRIPTION_STATUSES.has(sub.status))
}

/**
 * First-time checkout only. Returning / churned customers must not mint
 * another free `trial_period_days` window.
 */
export function isEligibleForCheckoutTrial(input: CheckoutTrialEligibilityInput): boolean {
  if (input.hadTrialCreditGrant) return false
  if (input.profileStatus === 'churned') return false
  if (customerHadPriorSubscription(input.subscriptions)) return false
  return true
}

/** Omit trial when ineligible — Stripe charges immediately on subscribe. */
export function checkoutTrialPeriodDays(
  eligible: boolean,
  trialDays: number,
): number | undefined {
  return eligible ? trialDays : undefined
}
