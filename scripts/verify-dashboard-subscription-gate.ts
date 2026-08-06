/**
 * Static + unit guard: unpaid owners cannot reach dashboard deep links or
 * zero-credit LLM routes without a subscription/trial/comp bypass.
 *
 * Usage:
 *   npx tsx scripts/verify-dashboard-subscription-gate.ts
 *   npm run verify:dashboard-subscription-gate
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { hasPlatformAccess } from '../lib/plans'
import { profileBypassesSubscriptionGate } from '../lib/billing/subscriptionGate'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertContains(source: string, needle: string, label: string) {
  if (!source.includes(needle)) {
    throw new Error(`Missing expected pattern in ${label}: ${needle}`)
  }
}

function assertNotContains(source: string, needle: string, label: string) {
  if (source.includes(needle)) {
    throw new Error(`Forbidden pattern still present in ${label}: ${needle}`)
  }
}

function main() {
  const root = resolve(__dirname, '..')
  const layout = readFileSync(resolve(root, 'app/dashboard/layout.tsx'), 'utf8')
  const home = readFileSync(resolve(root, 'app/dashboard/page.tsx'), 'utf8')
  const maya = readFileSync(resolve(root, 'app/api/maya/chat/route.ts'), 'utf8')
  const campaigns = readFileSync(resolve(root, 'app/api/campaigns/generate/route.ts'), 'utf8')

  assertContains(layout, 'ensurePaidSubscriptionForClerkUser', 'dashboard layout')
  assertContains(layout, 'startTrialPath()', 'dashboard layout')
  assertContains(layout, 'isTeamMember', 'dashboard layout')
  assertContains(layout, 'redirect(startTrialPath())', 'dashboard layout')

  // Home page must not be the only gate (and must not fail-open on null billing).
  assertNotContains(home, 'getBillingProfileForClerkUser', 'dashboard home')
  assertNotContains(home, 'profileBypassesSubscriptionGate', 'dashboard home')
  assertContains(home, 'app/dashboard/layout.tsx', 'dashboard home')

  assertContains(maya, 'NO_ACTIVE_PLAN', 'maya/chat')
  assertContains(maya, 'profileBypassesSubscriptionGate', 'maya/chat')
  assertContains(maya, 'hasPlatformAccess', 'maya/chat')

  assertContains(campaigns, 'NO_ACTIVE_PLAN', 'campaigns/generate')
  assertContains(campaigns, 'profileBypassesSubscriptionGate', 'campaigns/generate')
  assertContains(campaigns, 'hasPlatformAccess', 'campaigns/generate')
  assertContains(campaigns, 'getWorkspaceAuthContext', 'campaigns/generate')

  // Unit: unpaid owner fails; admin/comp/paid pass; team workspace uses hasPlatformAccess.
  assert(
    !profileBypassesSubscriptionGate({
      role: 'client',
      billing_exempt: false,
      stripe_subscription_id: null,
      plan: null,
      status: null,
    }),
    'unpaid client must not bypass subscription gate',
  )
  assert(
    profileBypassesSubscriptionGate({
      role: 'admin',
      billing_exempt: false,
      stripe_subscription_id: null,
      plan: null,
      status: null,
    }),
    'admin must bypass subscription gate',
  )
  assert(
    profileBypassesSubscriptionGate({
      role: 'client',
      billing_exempt: true,
      stripe_subscription_id: null,
      plan: 'growth',
      status: 'active',
    }),
    'billing_exempt must bypass subscription gate',
  )
  assert(
    profileBypassesSubscriptionGate({
      role: 'client',
      billing_exempt: false,
      stripe_subscription_id: 'sub_123',
      plan: 'starter',
      status: 'active',
    }),
    'active paid subscription must bypass subscription gate',
  )
  assert(
    !profileBypassesSubscriptionGate({
      role: 'client',
      billing_exempt: false,
      stripe_subscription_id: 'sub_123',
      plan: 'starter',
      status: 'paused',
    }),
    'paused subscription must not bypass subscription gate',
  )
  assert(
    !hasPlatformAccess(null, null, false),
    'null plan must not have platform access',
  )
  assert(
    hasPlatformAccess('growth', 'active', false),
    'active growth must have platform access',
  )

  console.log('verify-dashboard-subscription-gate: ok')
}

main()
