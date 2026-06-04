import Stripe from 'stripe'

let stripe: Stripe | null = null

export function getStripeClient() {
  const apiKey = process.env.STRIPE_SECRET_KEY
  if (!apiKey) return null

  stripe ??= new Stripe(apiKey, {
    apiVersion: '2026-04-22.dahlia' as any,
  })
  return stripe
}
