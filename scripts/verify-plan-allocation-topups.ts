/**
 * Static verification: monthly plan allocation preserves purchased top-up surplus.
 *
 * Usage: npx tsx scripts/verify-plan-allocation-topups.ts
 */
import { nextAllocationBalance } from '../lib/credits/planAllocation'
import { readFileSync } from 'fs'
import { join } from 'path'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function main() {
  // First allocation — no prior activity
  assert(
    nextAllocationBalance(350, {
      previousAllocationCredits: null,
      topupsSinceAllocation: 0,
      netUsageSinceAllocation: 0,
    }) === 350,
    'first allocation should equal plan pool',
  )

  // Growth + large top-up, light spend — concrete wipe scenario
  // prev plan 350, +1000 topup, spent 100 → carry 1000 topup → 1350
  assert(
    nextAllocationBalance(350, {
      previousAllocationCredits: 350,
      topupsSinceAllocation: 1000,
      netUsageSinceAllocation: 100,
    }) === 1350,
    'must preserve full unused top-up and refill plan after light spend',
  )

  // Spent through plan into top-up
  assert(
    nextAllocationBalance(350, {
      previousAllocationCredits: 350,
      topupsSinceAllocation: 1000,
      netUsageSinceAllocation: 400,
    }) === 1300,
    'must carry remaining top-up after plan-first spend',
  )

  // No top-ups — classic monthly refill
  assert(
    nextAllocationBalance(350, {
      previousAllocationCredits: 350,
      topupsSinceAllocation: 0,
      netUsageSinceAllocation: 100,
    }) === 350,
    'no top-ups should refill to plan pool',
  )

  // Unused month with top-up still on balance
  assert(
    nextAllocationBalance(350, {
      previousAllocationCredits: 350,
      topupsSinceAllocation: 1000,
      netUsageSinceAllocation: 0,
    }) === 1350,
    'unused month must keep top-up surplus',
  )

  // Absolute wipe regression: old code set balance = planCredits only
  assert(
    nextAllocationBalance(350, {
      previousAllocationCredits: 350,
      topupsSinceAllocation: 1000,
      netUsageSinceAllocation: 100,
    }) !== 350,
    'must not collapse to plan pool when top-ups remain',
  )

  const creditsSrc = readFileSync(join(process.cwd(), 'lib/credits.ts'), 'utf8')
  assert(
    creditsSrc.includes('writeCreditAllocation') && creditsSrc.includes('preserveTopups'),
    'lib/credits.ts must route allocations through top-up-preserving writer',
  )
  assert(
    creditsSrc.includes('skipIfAllocatedThisMonth'),
    'lib/credits.ts must support same-month allocation idempotency',
  )

  const cronSrc = readFileSync(
    join(process.cwd(), 'app/api/cron/allocate-credits/route.ts'),
    'utf8',
  )
  assert(
    cronSrc.includes('skipIfAllocatedThisMonth: true'),
    'monthly cron must skip when already allocated this month',
  )

  const trialSrc = readFileSync(join(process.cwd(), 'lib/billing/trialCredits.ts'), 'utf8')
  assert(
    trialSrc.includes("preserveTopups: true") &&
      trialSrc.includes('grantFullPlanAllowance') &&
      trialSrc.includes("preserveTopups: false"),
    'trial→paid must preserve top-ups; trial grant must stay absolute',
  )

  console.log('verify-plan-allocation-topups: ok')
}

main()
