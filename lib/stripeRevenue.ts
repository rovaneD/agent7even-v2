import type Stripe from 'stripe'

/** One-time legacy agency packages — exclude from SaaS revenue views. */
export const LEGACY_CHARGE_AMOUNTS_CENTS = new Set([
  750_000, // $7,500 legacy project package
])

/** Current SaaS subscription, seat, and credit top-up price points (cents). */
export const PLATFORM_CHARGE_AMOUNTS_CENTS = new Set([
  4_900,   // Starter monthly
  8_900,   // Growth monthly
  14_900,  // ProAgent monthly
  49_000,  // Starter annual
  89_000,  // Growth annual
  149_000, // ProAgent annual
  1_500,   // Team seat
  500,     // Credit top-up small
  1_500,   // Credit top-up medium
  4_000,   // Credit top-up large
])

export function isStripeTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_')
}

export function stripeCustomerId(charge: Stripe.Charge): string | null {
  if (!charge.customer) return null
  return typeof charge.customer === 'string' ? charge.customer : charge.customer.id
}

export function isPlatformRevenueCharge(
  charge: Stripe.Charge,
  knownCustomerIds: Set<string>
): boolean {
  if (!charge.paid || charge.refunded) return false
  if (LEGACY_CHARGE_AMOUNTS_CENTS.has(charge.amount)) return false

  const customerId = stripeCustomerId(charge)
  if (!customerId || !knownCustomerIds.has(customerId)) return false

  if (PLATFORM_CHARGE_AMOUNTS_CENTS.has(charge.amount)) return true

  const desc = (charge.description ?? '').toLowerCase()
  return desc.includes('subscription') || desc.includes('top-up') || desc.includes('credit')
}

export interface RevenueChargeRow {
  id: string
  amount: number
  created: number
  customerId: string
  label: string
  email: string | null
  plan: string | null
}

export function enrichRevenueCharges(
  charges: Stripe.Charge[],
  profileByCustomerId: Map<string, { full_name: string | null; company_name: string | null; email: string | null; plan: string | null }>
): RevenueChargeRow[] {
  return charges.map(charge => {
    const customerId = stripeCustomerId(charge)!
    const profile = profileByCustomerId.get(customerId)
    const label = profile?.company_name
      ?? profile?.full_name
      ?? profile?.email
      ?? charge.billing_details?.name
      ?? 'Unknown'
    return {
      id: charge.id,
      amount: charge.amount,
      created: charge.created,
      customerId,
      label,
      email: profile?.email ?? charge.billing_details?.email ?? null,
      plan: profile?.plan ?? null,
    }
  })
}
