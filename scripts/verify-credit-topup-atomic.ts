/**
 * Static verification: credit top-up fulfillment uses atomic balance grants.
 *
 * Concurrent distinct Stripe top-up sessions must not read-modify-write
 * credit_balances (last writer wins → silent loss of purchased credits).
 *
 * Usage: npx tsx scripts/verify-credit-topup-atomic.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const failures: string[] = []

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

const creditsLib = read('lib/credits.ts')
const webhook = read('app/api/webhooks/stripe/route.ts')
const sql = read('47_add_credits_rpc.sql')

if (!creditsLib.includes('export async function addCredits')) {
  failures.push('lib/credits.ts must export addCredits')
}

if (!creditsLib.includes("rpc('add_credits'") && !creditsLib.includes('rpc("add_credits"')) {
  failures.push('addCredits must call the add_credits RPC (atomic SQL increment)')
}

if (!sql.includes('create or replace function public.add_credits')) {
  failures.push('47_add_credits_rpc.sql must define public.add_credits')
}

if (!sql.includes('on conflict (user_id) do update')) {
  failures.push('add_credits must atomically upsert with balance = balance + amount')
}

if (!sql.includes('credit_balances.balance + excluded.balance')) {
  failures.push('add_credits conflict update must add onto the existing balance')
}

if (!webhook.includes('addCredits')) {
  failures.push('stripe webhook must grant top-ups via addCredits')
}

const topupBlock = webhook.slice(
  webhook.indexOf('Credit top-up'),
  webhook.indexOf('Subscription activation'),
)

// Legacy non-atomic pattern: read balance, add in JS, upsert absolute value.
if (/prevBalance\s*\+\s*credits/.test(topupBlock)) {
  failures.push('webhook top-up path still uses non-atomic prevBalance + credits RMW')
}

if (
  topupBlock.includes(".from('credit_balances')") &&
  topupBlock.includes('.upsert(') &&
  topupBlock.includes('balance:')
) {
  failures.push('webhook must not absolute-upsert credit_balances for top-ups')
}

if (failures.length) {
  console.error('verify-credit-topup-atomic FAILED:')
  for (const f of failures) console.error(' -', f)
  process.exit(1)
}

console.log('verify-credit-topup-atomic OK')
