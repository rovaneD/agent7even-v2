import { PLAN_CREDITS, writeCreditAllocation } from '@/lib/credits'
import { TRIAL_MEDIA_CREDITS } from '@/lib/billing/trialPolicy'

/** First checkout while Stripe subscription is trialing — capped pool. */
export async function allocateTrialCredits(profileId: string): Promise<number> {
  // Absolute grant: trial pool replaces any prior balance; do not treat remainder as top-up.
  return writeCreditAllocation(
    profileId,
    TRIAL_MEDIA_CREDITS,
    `Trial allocation — ${TRIAL_MEDIA_CREDITS} media credits`,
    { preserveTopups: false },
  )
}

/**
 * Trial conversion, mid-trial upgrade, or paid activation — full plan pool.
 * Resets the plan pool while preserving unused purchased top-ups.
 */
export async function grantFullPlanAllowance(
  profileId: string,
  plan: string,
  description: string,
): Promise<number | null> {
  const credits = PLAN_CREDITS[plan]
  if (!credits) return null
  return writeCreditAllocation(profileId, credits, description, {
    preserveTopups: true,
  })
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
