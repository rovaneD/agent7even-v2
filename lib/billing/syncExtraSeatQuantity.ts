import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { extraSeatsRequired } from '@/lib/billing/planSeatLimits'

/**
 * Keep the Stripe $15/mo seat line item aligned with team roster size for the
 * current plan. Plan changes (Billing UI or Customer Portal) must call this —
 * otherwise a ProAgent→Starter downgrade leaves included-seat members unpaid.
 */
export async function syncExtraSeatQuantityForProfile(opts: {
  stripe: Stripe
  supabase: SupabaseClient
  profileId: string
  subscriptionId: string
  plan: string
}): Promise<{ neededExtra: number; previousQuantity: number }> {
  const seatPriceId = process.env.STRIPE_SEAT_PRICE_ID
  if (!seatPriceId) {
    throw new Error('STRIPE_SEAT_PRICE_ID is not configured')
  }

  const { count, error: countError } = await opts.supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', opts.profileId)
    .neq('status', 'removed')

  if (countError) {
    throw new Error(`Failed to count team members: ${countError.message}`)
  }

  const neededExtra = extraSeatsRequired(opts.plan, count ?? 0)
  const subscription = await opts.stripe.subscriptions.retrieve(opts.subscriptionId)
  const seatItem = subscription.items.data.find(item => item.price.id === seatPriceId)
  const previousQuantity = seatItem?.quantity ?? 0

  if (neededExtra <= 0) {
    if (seatItem) {
      // delete not typed on this API version — same pattern as team/remove.
      await opts.stripe.subscriptionItems.update(seatItem.id, {
        quantity: 1,
        deleted: true,
      } as any)
    }
    return { neededExtra, previousQuantity }
  }

  if (seatItem) {
    if (previousQuantity !== neededExtra) {
      await opts.stripe.subscriptionItems.update(seatItem.id, {
        quantity: neededExtra,
      })
    }
    return { neededExtra, previousQuantity }
  }

  await opts.stripe.subscriptionItems.create({
    subscription: opts.subscriptionId,
    price: seatPriceId,
    quantity: neededExtra,
  })

  return { neededExtra, previousQuantity }
}
