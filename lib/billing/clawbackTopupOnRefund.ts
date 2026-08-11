import type { SupabaseClient } from '@supabase/supabase-js'
import { deductCredits } from '@/lib/credits'
import { createServiceClient } from '@/lib/supabase/server'

export type ClawbackTopupResult =
  | { ok: true; clawed: number; balance: number; topupId: string; userId: string; credits: number }
  | { ok: false; reason: 'not_a_topup' | 'already_refunded' | 'invalid_credits' }

/**
 * Idempotent clawback when a credit top-up PaymentIntent is fully refunded.
 * CAS-claims credit_topups completed → refunded, then deducts up to the
 * purchased pack (floors at zero if the customer already spent some).
 */
export async function clawbackCompletedTopupOnce(
  supabase: SupabaseClient,
  opts: { paymentIntentId: string },
): Promise<ClawbackTopupResult> {
  const { data: topup, error: lookupError } = await supabase
    .from('credit_topups')
    .select('id, user_id, credits, status')
    .eq('stripe_payment_id', opts.paymentIntentId)
    .maybeSingle()

  if (lookupError) {
    throw new Error(`credit_topups lookup failed: ${lookupError.message}`)
  }

  if (!topup) return { ok: false, reason: 'not_a_topup' }
  if (topup.status === 'refunded') return { ok: false, reason: 'already_refunded' }
  if (topup.status !== 'completed') return { ok: false, reason: 'not_a_topup' }

  const packCredits = Number(topup.credits)
  if (!Number.isFinite(packCredits) || packCredits <= 0) {
    return { ok: false, reason: 'invalid_credits' }
  }

  const { data: claimed, error: claimError } = await supabase
    .from('credit_topups')
    .update({ status: 'refunded' })
    .eq('id', topup.id)
    .eq('status', 'completed')
    .select('id, user_id, credits')
    .maybeSingle()

  if (claimError) {
    throw new Error(`credit_topups refund claim failed: ${claimError.message}`)
  }
  if (!claimed) return { ok: false, reason: 'already_refunded' }

  try {
    const clawed = await clawbackUpTo(claimed.user_id, packCredits, opts.paymentIntentId)
    return {
      ok: true,
      clawed: clawed.clawed,
      balance: clawed.balance,
      topupId: claimed.id,
      userId: claimed.user_id,
      credits: packCredits,
    }
  } catch (err) {
    // Revert claim so Stripe can retry the webhook.
    await supabase
      .from('credit_topups')
      .update({ status: 'completed' })
      .eq('id', claimed.id)
      .eq('status', 'refunded')
    throw err
  }
}

/** Deduct up to `maxCredits`, retrying once if a concurrent spend races the balance. */
async function clawbackUpTo(
  userId: string,
  maxCredits: number,
  paymentIntentId: string,
): Promise<{ clawed: number; balance: number }> {
  const supabase = createServiceClient()

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: balRows } = await supabase
      .from('credit_balances')
      .select('balance')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)

    const balance = Number(balRows?.[0]?.balance ?? 0)
    const amount = Math.min(Math.max(0, balance), maxCredits)
    if (amount <= 0) return { clawed: 0, balance: Math.max(0, balance) }

    try {
      const result = await deductCredits(
        userId,
        amount,
        `Credit top-up refunded — clawed ${amount} credits (pi ${paymentIntentId})`,
      )
      return { clawed: amount, balance: result.balance }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('INSUFFICIENT_CREDITS') && attempt === 0) continue
      throw err
    }
  }

  return { clawed: 0, balance: 0 }
}

/** True when Stripe reports a full refund (chargebacks / Dashboard full refunds). */
export function isFullyRefundedCharge(charge: {
  refunded?: boolean | null
  amount?: number | null
  amount_refunded?: number | null
}): boolean {
  if (charge.refunded) return true
  const amount = Number(charge.amount ?? 0)
  const refunded = Number(charge.amount_refunded ?? 0)
  return amount > 0 && refunded >= amount
}
