import { createServiceClient } from '@/lib/supabase/server'
import { PLAN_CREDITS } from '@/lib/credits'
import { TRIAL_MEDIA_CREDITS } from '@/lib/billing/trialPolicy'

async function writeAllocation(
  profileId: string,
  credits: number,
  description: string,
): Promise<number> {
  const supabase = createServiceClient()
  const now = new Date().toISOString()

  await supabase.from('credit_balances').upsert({
    user_id: profileId,
    balance: credits,
    updated_at: now,
  })

  await supabase.from('credit_ledger').insert({
    user_id: profileId,
    type: 'allocation',
    credits,
    balance_after: credits,
    description,
  })

  return credits
}

async function hasLedgerAllocationMatching(
  profileId: string,
  descriptionPattern: string,
): Promise<boolean> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('credit_ledger')
    .select('id')
    .eq('user_id', profileId)
    .eq('type', 'allocation')
    .ilike('description', descriptionPattern)
    .limit(1)
    .maybeSingle()
  return Boolean(data)
}

/** First checkout while Stripe subscription is trialing — capped pool. */
export async function allocateTrialCredits(profileId: string): Promise<number> {
  return writeAllocation(
    profileId,
    TRIAL_MEDIA_CREDITS,
    `Trial allocation — ${TRIAL_MEDIA_CREDITS} media credits`,
  )
}

/**
 * Trial conversion, mid-trial upgrade, or paid activation — full plan pool.
 * Resets balance to the plan allowance (does not add on top of trial remainder).
 */
export async function grantFullPlanAllowance(
  profileId: string,
  plan: string,
  description: string,
): Promise<number | null> {
  const credits = PLAN_CREDITS[plan]
  if (!credits) return null
  return writeAllocation(profileId, credits, description)
}

/**
 * Top-up after trial ends or upgrade out of trial.
 * Uses a distinct ledger description so monthly cron skipIfAllocated logic
 * (if any) does not block this grant.
 */
export async function grantPaidPlanAllowanceAfterTrial(
  profileId: string,
  plan: string,
): Promise<number | null> {
  return grantFullPlanAllowance(
    profileId,
    plan,
    `Paid plan allowance — ${plan} plan (trial ended)`,
  )
}

/**
 * Idempotent checkout activation credits.
 * Stripe may deliver checkout.session.completed more than once, and the
 * client sync path can race the webhook — without this guard, balance is
 * reset to the allocation amount and duplicate ledger rows appear.
 */
export async function grantCheckoutActivationCreditsOnce(
  profileId: string,
  plan: string,
  isTrialing: boolean,
): Promise<number | null> {
  const alreadyGranted =
    (await hasLedgerAllocationMatching(profileId, '%Trial allocation%')) ||
    (await hasLedgerAllocationMatching(profileId, '%Paid plan allowance%')) ||
    (await hasLedgerAllocationMatching(profileId, '%Plan activation%'))

  if (alreadyGranted) return null

  return isTrialing
    ? allocateTrialCredits(profileId)
    : grantPaidPlanAllowanceAfterTrial(profileId, plan)
}

/** Idempotent trial → paid conversion grant (subscription.updated retries). */
export async function grantPaidPlanAllowanceAfterTrialOnce(
  profileId: string,
  plan: string,
): Promise<number | null> {
  if (await hasLedgerAllocationMatching(profileId, '%Paid plan allowance%')) {
    return null
  }
  return grantPaidPlanAllowanceAfterTrial(profileId, plan)
}
