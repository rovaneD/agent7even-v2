import type { SupabaseClient } from '@supabase/supabase-js'

export type CompleteCreditTopupInput = {
  stripeSessionId: string
  /** Fallback profile id from Stripe metadata (authoritative source is the claimed topup row). */
  userId: string
  /** Fallback credits from Stripe metadata (authoritative source is the claimed topup row). */
  credits: number
  paymentIntentId?: string | null
  amountTotalCents?: number | null
}

export type CompleteCreditTopupResult =
  | { granted: true; userId: string; credits: number; newBalance: number }
  | { granted: false; reason: 'already_completed' | 'invalid_credits' | 'missing_topup' }

/**
 * Idempotent credit top-up fulfillment for Stripe `checkout.session.completed`.
 *
 * Claims the pending `credit_topups` row (pending → completed). Retries that
 * find an already-completed row return without granting again — without this
 * CAS, Stripe webhook retries double-credit the account.
 *
 * If balance/ledger writes fail after the claim, the row is reverted to
 * `pending` so Stripe's retry can reclaim and finish fulfillment.
 */
export async function completeCreditTopupOnce(
  supabase: SupabaseClient,
  input: CompleteCreditTopupInput,
): Promise<CompleteCreditTopupResult> {
  const now = new Date().toISOString()

  const { data: claimedRows, error: claimError } = await supabase
    .from('credit_topups')
    .update({
      status: 'completed',
      stripe_payment_id: input.paymentIntentId ?? null,
      completed_at: now,
    })
    .eq('stripe_session_id', input.stripeSessionId)
    .eq('status', 'pending')
    .select('id, user_id, credits')

  if (claimError) {
    throw new Error(`credit_topups claim failed: ${claimError.message}`)
  }

  const claimed = claimedRows?.[0] ?? null

  if (!claimed) {
    const { data: existing } = await supabase
      .from('credit_topups')
      .select('id')
      .eq('stripe_session_id', input.stripeSessionId)
      .eq('status', 'completed')
      .limit(1)

    if (existing?.length) {
      return { granted: false, reason: 'already_completed' }
    }

    // Checkout creates the pending row before the customer pays. If it is
    // missing, fail closed so Stripe retries rather than granting unbounded
    // credits from metadata alone on every delivery.
    return { granted: false, reason: 'missing_topup' }
  }

  const userId = typeof claimed.user_id === 'string' ? claimed.user_id : input.userId
  const credits = Number(claimed.credits)
  if (!userId || !Number.isFinite(credits) || credits <= 0) {
    await supabase
      .from('credit_topups')
      .update({ status: 'pending', stripe_payment_id: null, completed_at: null })
      .eq('id', claimed.id)
    return { granted: false, reason: 'invalid_credits' }
  }

  const amountLabel = ((input.amountTotalCents ?? 0) / 100).toFixed(2)
  const description = `Credit top-up — ${credits} credits ($${amountLabel})`

  try {
    const { data: balRows } = await supabase
      .from('credit_balances')
      .select('balance')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)

    const prevBalance = balRows?.[0]?.balance ?? 0
    const newBalance = prevBalance + credits

    const { error: balanceError } = await supabase
      .from('credit_balances')
      .upsert({ user_id: userId, balance: newBalance, updated_at: now })

    if (balanceError) {
      throw new Error(`credit_balances upsert failed: ${balanceError.message}`)
    }

    const { error: ledgerError } = await supabase.from('credit_ledger').insert({
      user_id: userId,
      type: 'topup',
      credits,
      balance_after: newBalance,
      description,
    })

    if (ledgerError) {
      throw new Error(`credit_ledger insert failed: ${ledgerError.message}`)
    }

    return { granted: true, userId, credits, newBalance }
  } catch (err) {
    await supabase
      .from('credit_topups')
      .update({ status: 'pending', stripe_payment_id: null, completed_at: null })
      .eq('id', claimed.id)
      .eq('status', 'completed')
    throw err
  }
}
