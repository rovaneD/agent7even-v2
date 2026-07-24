import type { PaidPlan } from '@/lib/plans'
import type Stripe from 'stripe'

const PRICE_TO_PLAN: Record<string, PaidPlan> = {}

function ensurePriceMap() {
  if (Object.keys(PRICE_TO_PLAN).length > 0) return
  const pairs: [string | undefined, PaidPlan][] = [
    [process.env.STRIPE_STARTER_MONTHLY_PRICE_ID, 'starter'],
    [process.env.STRIPE_STARTER_ANNUAL_PRICE_ID, 'starter'],
    [process.env.STRIPE_GROWTH_MONTHLY_PRICE_ID, 'growth'],
    [process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID, 'growth'],
    [process.env.STRIPE_PROAGENT_MONTHLY_PRICE_ID, 'proagent'],
    [process.env.STRIPE_PROAGENT_ANNUAL_PRICE_ID, 'proagent'],
  ]
  for (const [id, plan] of pairs) {
    if (id) PRICE_TO_PLAN[id] = plan
  }
}

export function planFromPriceId(priceId: string): PaidPlan | null {
  ensurePriceMap()
  return PRICE_TO_PLAN[priceId] ?? null
}

export function getPlanFromSubscription(subscription: Stripe.Subscription): PaidPlan | null {
  for (const item of subscription.items.data) {
    const plan = planFromPriceId(item.price.id)
    if (plan) return plan
  }
  return null
}

export function allPlanPriceIds(): Set<string> {
  ensurePriceMap()
  return new Set(Object.keys(PRICE_TO_PLAN))
}
