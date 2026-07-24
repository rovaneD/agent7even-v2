import type Stripe from 'stripe'

/**
 * Map Stripe subscription status → profiles.status.
 * Never hardcode 'active' from a subscription update/recovery path —
 * past_due/unpaid must stay 'paused' or delinquent accounts regain paid access.
 */
export function profileStatusFromSubscription(
  subscription: Pick<Stripe.Subscription, 'status'>,
): 'active' | 'paused' | null {
  switch (subscription.status) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'paused'
    default:
      // canceled / incomplete / incomplete_expired / paused — handled elsewhere
      return null
  }
}

/** Subscriptions that may unlock platform access after checkout/recovery. */
export function isAccessGrantingSubscriptionStatus(
  status: Stripe.Subscription.Status | string,
): boolean {
  return status === 'active' || status === 'trialing'
}
