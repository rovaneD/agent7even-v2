import Stripe from 'stripe'
import { getStripeSecretKey, sanitizeSecretEnvValue } from '../../lib/stripe'

export function qaStripeKey(): string | null {
  return sanitizeSecretEnvValue(process.env.STRIPE_QA_SECRET_KEY) ?? getStripeSecretKey()
}

export function qaStripeClient(): Stripe | null {
  const apiKey = qaStripeKey()
  if (!apiKey) return null
  return new Stripe(apiKey, { apiVersion: '2026-04-22.dahlia' as any })
}
