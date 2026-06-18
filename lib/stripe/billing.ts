import Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

type ResolveCustomerInput = {
  profileId: string
  storedCustomerId: string | null
  email: string
  fullName: string | null
  clerkUserId: string
  supabase: SupabaseClient
}

/** Use stored Stripe customer when valid; recreate if missing or from the wrong Stripe mode. */
export async function resolveStripeCustomer(
  stripe: Stripe,
  input: ResolveCustomerInput,
): Promise<string> {
  const { profileId, storedCustomerId, email, fullName, clerkUserId, supabase } = input

  if (storedCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(storedCustomerId)
      if (!('deleted' in existing && existing.deleted)) {
        return existing.id
      }
    } catch (err) {
      console.warn('[stripe] stale stripe_customer_id, recreating customer', {
        profileId,
        storedCustomerId,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const customer = await stripe.customers.create({
    email,
    name: fullName ?? undefined,
    metadata: { clerk_user_id: clerkUserId },
  })

  await supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', profileId)

  return customer.id
}

export async function assertCheckoutPrice(stripe: Stripe, priceId: string, plan: string) {
  try {
    const price = await stripe.prices.retrieve(priceId)
    if (!price.active) {
      throw new Error(`${plan} pricing is inactive in Stripe. Contact support.`)
    }
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      const msg = err.message.toLowerCase()
      if (msg.includes('test mode') || msg.includes('live mode')) {
        throw new Error(
          `${plan} price ID does not match your Stripe account mode. Update STRIPE_*_PRICE_ID in Vercel Production with live-mode price IDs.`,
        )
      }
      if (err.code === 'resource_missing') {
        throw new Error(
          `${plan} price ID was not found in Stripe. Update STRIPE_*_PRICE_ID in Vercel Production.`,
        )
      }
    }
    throw err
  }
}

export function formatStripeCheckoutError(err: unknown): string {
  if (err instanceof Stripe.errors.StripeConnectionError) {
    const detail = (err as { detail?: unknown }).detail
    const detailMessage =
      detail instanceof Error
        ? detail.message
        : typeof detail === 'string'
          ? detail
          : ''

    if (detailMessage.includes('Invalid character in header content')) {
      return 'Billing is misconfigured: STRIPE_SECRET_KEY contains invalid characters (often a trailing newline or quotes). Re-save the key in Vercel Production and redeploy.'
    }
  }

  if (err instanceof Stripe.errors.StripeInvalidRequestError) {
    const msg = err.message.toLowerCase()
    if (msg.includes('test mode') && msg.includes('live mode')) {
      return 'Your account has test-mode billing data but production uses live Stripe keys. Please try again — a fresh billing profile will be created.'
    }
    if (err.code === 'resource_missing' && err.param === 'price') {
      return 'Subscription pricing is misconfigured. Contact support if this continues.'
    }
    return err.message
  }

  if (err instanceof Error && err.message) return err.message
  return 'Could not start checkout. Please try again.'
}
