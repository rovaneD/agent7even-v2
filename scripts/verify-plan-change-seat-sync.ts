/**
 * Static verification that plan changes sync Stripe extra-seat quantity.
 *
 * Usage: npx tsx scripts/verify-plan-change-seat-sync.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { extraSeatsRequired, includedSeatsForPlan } from '../lib/billing/planSeatLimits'

const root = process.cwd()
const failures: string[] = []

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

const helper = read('lib/billing/syncExtraSeatQuantity.ts')
const limits = read('lib/billing/planSeatLimits.ts')
const checkout = read('app/api/stripe/checkout/route.ts')
const webhook = read('app/api/webhooks/stripe/route.ts')

if (!limits.includes('starter: 1') || !limits.includes('growth: 3') || !limits.includes('proagent: 5')) {
  failures.push('plan seat limits must remain starter=1 growth=3 proagent=5')
}

if (includedSeatsForPlan('growth') !== 3) {
  failures.push('includedSeatsForPlan(growth) expected 3')
}

// Owner + 2 members on Starter → 2 extra seats billable.
if (extraSeatsRequired('starter', 2) !== 2) {
  failures.push('extraSeatsRequired(starter, 2 members) expected 2')
}

// Owner + 2 members on Growth → within included (3) → 0 extras.
if (extraSeatsRequired('growth', 2) !== 0) {
  failures.push('extraSeatsRequired(growth, 2 members) expected 0')
}

// Concrete downgrade hole: ProAgent with 4 members (within 5) → Starter.
if (extraSeatsRequired('proagent', 4) !== 0) {
  failures.push('proagent with 4 members should need 0 extras before downgrade')
}
if (extraSeatsRequired('starter', 4) !== 4) {
  failures.push('starter with 4 members after downgrade must require 4 paid extras')
}

if (!helper.includes('export async function syncExtraSeatQuantityForProfile')) {
  failures.push('missing syncExtraSeatQuantityForProfile helper')
}

if (!helper.includes('STRIPE_SEAT_PRICE_ID')) {
  failures.push('seat sync must target STRIPE_SEAT_PRICE_ID')
}

if (!helper.includes('subscriptionItems.create') || !helper.includes('subscriptionItems.update')) {
  failures.push('seat sync must create/update/delete seat subscription items')
}

if (!checkout.includes('syncExtraSeatQuantityForProfile')) {
  failures.push('in-place plan change checkout must sync seat quantity')
}

if (!webhook.includes('syncExtraSeatQuantityForProfile')) {
  failures.push('subscription.updated webhook must sync seats on item changes')
}

if (!webhook.includes('previousStoredPlan') || !webhook.includes('previousStoredPlan !== plan')) {
  failures.push('webhook must detect plan changes via stored profiles.plan (not seat-only edits)')
}

if (!webhook.includes("select('id, plan')")) {
  failures.push('webhook must read profiles.plan before overwriting it on subscription.updated')
}

if (failures.length) {
  console.error('verify-plan-change-seat-sync FAILED:')
  for (const f of failures) console.error(' -', f)
  process.exit(1)
}

console.log('verify-plan-change-seat-sync OK')
