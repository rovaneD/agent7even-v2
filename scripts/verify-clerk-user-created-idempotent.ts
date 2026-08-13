/**
 * Clerk user.created must be insert-only so retries cannot reset a live profile.
 *
 *   npx tsx scripts/verify-clerk-user-created-idempotent.ts
 */
import {
  decideClerkUserCreatedAction,
  isClerkProfileUniqueViolation,
} from '../lib/profiles/clerkUserCreatedWrite'
import { hasPlatformAccess } from '../lib/plans'

function assert(cond: unknown, message: string) {
  if (!cond) {
    console.error(`FAIL · ${message}`)
    process.exitCode = 1
  } else {
    console.log(`PASS · ${message}`)
  }
}

const clerkId = 'user_abc'

assert(
  decideClerkUserCreatedAction({
    existingByClerkUserId: { id: 'profile-1' },
    emailMatches: [{ clerk_user_id: clerkId }],
    incomingClerkUserId: clerkId,
  }) === 'noop',
  'redelivery of user.created is a no-op when clerk_user_id already exists',
)

assert(
  decideClerkUserCreatedAction({
    existingByClerkUserId: { id: 'profile-1' },
    emailMatches: [
      { clerk_user_id: clerkId },
      { clerk_user_id: 'user_other' },
    ],
    incomingClerkUserId: clerkId,
  }) === 'noop',
  'redelivery still no-ops even if other email-matching rows exist',
)

assert(
  decideClerkUserCreatedAction({
    existingByClerkUserId: null,
    emailMatches: [{ clerk_user_id: 'user_old' }],
    incomingClerkUserId: clerkId,
  }) === 'relink_email',
  'same email + new Clerk user relinks the canonical profile',
)

assert(
  decideClerkUserCreatedAction({
    existingByClerkUserId: null,
    emailMatches: [],
    incomingClerkUserId: clerkId,
  }) === 'insert',
  'first delivery with no matching profile inserts',
)

assert(
  decideClerkUserCreatedAction({
    existingByClerkUserId: null,
    emailMatches: [{ clerk_user_id: clerkId }],
    incomingClerkUserId: clerkId,
  }) === 'insert',
  'email rows that already belong to this Clerk id do not take the relink path',
)

assert(isClerkProfileUniqueViolation({ code: '23505' }), 'Postgres unique violation is idempotent')
assert(!isClerkProfileUniqueViolation({ code: '42501' }), 'other Postgres errors are not treated as success')
assert(!isClerkProfileUniqueViolation(null), 'missing error is not a unique violation')

// Impact lock-in: resetting status to onboarding must not keep paid access.
assert(
  hasPlatformAccess('starter', 'active') === true,
  'active paid plan has platform access',
)
assert(
  hasPlatformAccess('starter', 'onboarding') === false,
  'onboarding status after a clobbering upsert would lock out a paying user',
)
assert(
  hasPlatformAccess('proagent', 'onboarding', true) === true,
  'billing_exempt still has access even if status was reset',
)

if (process.exitCode) {
  console.error('\nClerk user.created idempotency checks failed')
  process.exit(1)
}

console.log('\nOK · user.created redelivery cannot reset live profile lifecycle fields')
