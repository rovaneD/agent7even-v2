/**
 * Static verification: cancel → resubscribe must not mint another free trial.
 *
 * Usage: npx tsx scripts/verify-checkout-trial-eligibility.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  checkoutTrialPeriodDays,
  customerHadPriorSubscription,
  isEligibleForCheckoutTrial,
} from '../lib/billing/checkoutTrialEligibility'

const TRIAL_DAYS = 7

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function main() {
  // First-time buyer — no Stripe history
  assert(
    isEligibleForCheckoutTrial({ subscriptions: [] }) === true,
    'empty subscription history must remain trial-eligible',
  )
  assert(
    checkoutTrialPeriodDays(true, TRIAL_DAYS) === TRIAL_DAYS,
    'eligible checkout must request trial_period_days',
  )

  // Abandoned incomplete checkout must not burn the trial
  assert(
    isEligibleForCheckoutTrial({
      subscriptions: [{ status: 'incomplete' }, { status: 'incomplete_expired' }],
    }) === true,
    'incomplete Checkout Sessions must not block a first trial',
  )
  assert(
    customerHadPriorSubscription([{ status: 'incomplete' }]) === false,
    'incomplete is not a prior subscription',
  )

  // Concrete abuse path: canceled prior trial/paid sub
  assert(
    isEligibleForCheckoutTrial({
      subscriptions: [{ status: 'canceled', trial_start: 1_700_000_000 }],
    }) === false,
    'canceled prior subscription must block another free trial',
  )
  assert(
    isEligibleForCheckoutTrial({
      subscriptions: [{ status: 'active' }],
    }) === false,
    'prior active subscription must block another free trial',
  )
  assert(
    isEligibleForCheckoutTrial({
      subscriptions: [{ status: 'past_due' }],
    }) === false,
    'past_due history must block another free trial',
  )
  assert(
    checkoutTrialPeriodDays(false, TRIAL_DAYS) === undefined,
    'ineligible checkout must omit trial_period_days',
  )

  // Belt-and-suspenders when Stripe customer was recreated empty
  assert(
    isEligibleForCheckoutTrial({
      subscriptions: [],
      profileStatus: 'churned',
    }) === false,
    'churned profile must block trial even with empty Stripe history',
  )
  assert(
    isEligibleForCheckoutTrial({
      subscriptions: [],
      hadTrialCreditGrant: true,
    }) === false,
    'prior Trial allocation ledger row must block another free trial',
  )

  const checkoutSrc = readFileSync(
    join(process.cwd(), 'app/api/stripe/checkout/route.ts'),
    'utf8',
  )
  assert(
    checkoutSrc.includes('isEligibleForCheckoutTrial') &&
      checkoutSrc.includes('checkoutTrialPeriodDays') &&
      checkoutSrc.includes('checkoutTrialPeriodDays(trialEligible, TRIAL_DAYS)') &&
      checkoutSrc.includes("status: 'all'"),
    'checkout route must consult Stripe subscription history before trial_period_days',
  )
  assert(
    !/trial_period_days:\s*TRIAL_DAYS/.test(checkoutSrc),
    'checkout must not unconditionally set trial_period_days: TRIAL_DAYS',
  )
  assert(
    checkoutSrc.includes('%Trial allocation%') || checkoutSrc.includes('hadTrialCreditGrant'),
    'checkout must consult prior trial credit grant as a recreate fallback',
  )

  console.log('verify-checkout-trial-eligibility: ok')
}

main()
