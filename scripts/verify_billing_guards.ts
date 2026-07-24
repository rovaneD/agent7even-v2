/**
 * Pure billing-guard assertions for trial/recovery regressions.
 * Usage: npx tsx scripts/verify_billing_guards.ts
 */
import {
  isAccessGrantingSubscriptionStatus,
  profileStatusFromSubscription,
} from '../lib/billing/subscriptionStatus'
import { hasPlatformAccess } from '../lib/plans'

let failures = 0
const assert = (ok: boolean, msg: string) => {
  if (!ok) {
    console.error('FAIL:', msg)
    failures++
  } else {
    console.log('OK:', msg)
  }
}

assert(profileStatusFromSubscription({ status: 'trialing' }) === 'active', 'trialing → active')
assert(profileStatusFromSubscription({ status: 'active' }) === 'active', 'active → active')
assert(profileStatusFromSubscription({ status: 'past_due' }) === 'paused', 'past_due → paused')
assert(profileStatusFromSubscription({ status: 'unpaid' }) === 'paused', 'unpaid → paused')
assert(profileStatusFromSubscription({ status: 'incomplete' }) === null, 'incomplete → null')
assert(profileStatusFromSubscription({ status: 'canceled' }) === null, 'canceled → null')

assert(isAccessGrantingSubscriptionStatus('trialing'), 'trialing grants access')
assert(isAccessGrantingSubscriptionStatus('active'), 'active grants access')
assert(!isAccessGrantingSubscriptionStatus('past_due'), 'past_due does not grant access')
assert(!isAccessGrantingSubscriptionStatus('unpaid'), 'unpaid does not grant access')

// Delinquent recovery must not unlock platform access after status mapping.
const recoveredPastDueStatus = profileStatusFromSubscription({ status: 'past_due' })
assert(
  !hasPlatformAccess('growth', recoveredPastDueStatus, false),
  'past_due mapped status blocks hasPlatformAccess',
)
assert(
  hasPlatformAccess('growth', profileStatusFromSubscription({ status: 'active' }), false),
  'active mapped status allows hasPlatformAccess',
)
assert(
  hasPlatformAccess('growth', 'paused', true),
  'billing_exempt still bypasses paused status',
)

if (failures) {
  console.error(`\n${failures} billing guard assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll billing guard assertions passed')
