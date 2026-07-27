/**
 * Static verification that credit top-up webhook fulfillment is idempotent.
 *
 * Usage: npx tsx scripts/verify-credit-topup-idempotency.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const failures: string[] = []

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

const helper = read('lib/billing/completeCreditTopup.ts')
const webhook = read('app/api/webhooks/stripe/route.ts')

if (!helper.includes('export async function completeCreditTopupOnce')) {
  failures.push('missing completeCreditTopupOnce helper')
}

if (!helper.includes(".eq('status', 'pending')")) {
  failures.push('top-up claim must require status=pending (CAS)')
}

if (!helper.includes("reason: 'already_completed'") && !helper.includes("reason: \"already_completed\"")) {
  failures.push('helper must short-circuit already_completed top-ups')
}

if (!helper.includes("status: 'pending'") || !helper.includes('.eq(\'status\', \'completed\')')) {
  failures.push('helper must revert claim to pending when grant fails')
}

if (!webhook.includes('completeCreditTopupOnce')) {
  failures.push('stripe webhook must call completeCreditTopupOnce')
}

// Old non-idempotent pattern: update by session id then always add credits.
const topupBlock = webhook.slice(
  webhook.indexOf('Credit top-up'),
  webhook.indexOf('Subscription activation'),
)

if (/prevBalance\s*\+\s*credits/.test(topupBlock) && !topupBlock.includes('completeCreditTopupOnce')) {
  failures.push('webhook still inlines non-idempotent balance += credits for top-ups')
}

if (topupBlock.includes(".update({") && topupBlock.includes('credit_topups') && !topupBlock.includes('completeCreditTopupOnce')) {
  failures.push('webhook must not update credit_topups inline without CAS helper')
}

if (failures.length) {
  console.error('verify-credit-topup-idempotency FAILED:')
  for (const f of failures) console.error(' -', f)
  process.exit(1)
}

console.log('verify-credit-topup-idempotency OK')
