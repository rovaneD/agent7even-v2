/**
 * Static verification that Stripe charge.refunded claws back credit top-ups.
 *
 * Usage: npx tsx scripts/verify-topup-refund-clawback.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const failures: string[] = []

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

const helper = read('lib/billing/clawbackTopupOnRefund.ts')
const webhook = read('app/api/webhooks/stripe/route.ts')
const schema = read('03_credit_topups.sql')

if (!helper.includes('export async function clawbackCompletedTopupOnce')) {
  failures.push('missing clawbackCompletedTopupOnce helper')
}

if (!helper.includes("status: 'refunded'") || !helper.includes(".eq('status', 'completed')")) {
  failures.push('clawback must CAS-claim credit_topups completed → refunded')
}

if (!helper.includes("status: 'completed'") || !helper.includes(".eq('status', 'refunded')")) {
  failures.push('clawback must revert claim to completed when deduct fails')
}

if (!helper.includes('deductCredits')) {
  failures.push('clawback must deduct credits after claiming the top-up row')
}

if (!helper.includes('export function isFullyRefundedCharge')) {
  failures.push('missing isFullyRefundedCharge guard for partial refunds')
}

if (!webhook.includes("event.type === 'charge.refunded'")) {
  failures.push('stripe webhook must handle charge.refunded')
}

if (!webhook.includes('clawbackCompletedTopupOnce')) {
  failures.push('stripe webhook must call clawbackCompletedTopupOnce')
}

if (!webhook.includes('isFullyRefundedCharge')) {
  failures.push('stripe webhook must ignore partial refunds until fully refunded')
}

if (!schema.includes('refunded')) {
  failures.push('credit_topups schema must allow refunded status')
}

// Must not acknowledge refund clawback failures with 200 (Stripe would not retry).
const refundBlockStart = webhook.indexOf("event.type === 'charge.refunded'")
const refundBlock = webhook.slice(refundBlockStart, refundBlockStart + 1200)
if (refundBlockStart < 0 || !refundBlock.includes('status: 500')) {
  failures.push('charge.refunded handler must return 500 when clawback throws')
}

if (failures.length) {
  console.error('verify-topup-refund-clawback FAILED:')
  for (const f of failures) console.error(' -', f)
  process.exit(1)
}

console.log('verify-topup-refund-clawback OK')
