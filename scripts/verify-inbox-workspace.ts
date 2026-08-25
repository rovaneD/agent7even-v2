/**
 * Lock in Inbox workspace tenancy: team members must see the owner's live
 * social inbox, not demo mode from their own unpaid profile row.
 *
 * Usage: npx tsx scripts/verify-inbox-workspace.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { getInboxState } from '../lib/inbox/inboxDataState'

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exitCode = 1
  } else {
    console.log('ok:', msg)
  }
}

assert(getInboxState({ plan: null, zernio_profile_id: null, zernio_connected_platforms: [] }) === 'mock', 'member with no plan is mock')
assert(
  getInboxState({
    plan: 'growth',
    zernio_profile_id: 'zernio_abc',
    zernio_connected_platforms: ['instagram'],
  }) === 'live',
  'owner with plan + connected Zernio is live',
)
assert(
  getInboxState({
    plan: 'starter',
    zernio_profile_id: null,
    zernio_connected_platforms: [],
  }) === 'empty',
  'paid owner with no social accounts is empty',
)

const page = readFileSync(join(process.cwd(), 'app/dashboard/inbox/page.tsx'), 'utf8')
assert(page.includes('getAnalyticsProfileForClerkUser'), 'inbox page loads workspace analytics profile')
assert(page.includes('getTeamPermissions(memberProfile.id)'), 'inbox permission check stays on the signed-in member')
assert(
  !/const profile = await resolveClerkProfile/.test(page),
  'inbox zernio/plan profile is not the member row',
)
assert(page.includes('getInboxState'), 'inbox page uses shared getInboxState')

if (process.exitCode) {
  console.error('\nverify-inbox-workspace failed')
  process.exit(1)
}

console.log('\nverify-inbox-workspace passed')
