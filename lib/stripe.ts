import Stripe from 'stripe'

let stripe: Stripe | null = null

/** Strip whitespace, newlines, and wrapping quotes from pasted secret env vars. */
export function sanitizeSecretEnvValue(value: string | undefined | null): string | null {
  if (!value) return null
  const trimmed = value.trim().replace(/^["']|["']$/g, '')
  return trimmed || null
}

export function getStripeSecretKey(): string | null {
  return sanitizeSecretEnvValue(process.env.STRIPE_SECRET_KEY)
}

export function getStripeClient() {
  const apiKey = getStripeSecretKey()
  if (!apiKey) return null

  stripe ??= new Stripe(apiKey, {
    apiVersion: '2026-04-22.dahlia' as any,
  })
  return stripe
}
