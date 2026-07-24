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
