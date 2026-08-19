/**
 * Lock in: retryable Zernio publish failures must restore pending_approval
 * so a second Approve is not stuck on 409 not_pending.
 *
 *   npx tsx scripts/verify-approve-publish-retry.ts
 *   npm run verify:approve-publish-retry
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  NON_RETRYABLE_PUBLISH_SKIP_DETAILS,
  shouldRevertApprovalAfterPublish,
} from '../lib/agents/publishApprovedOutput'

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    process.exitCode = 1
  } else {
    console.log(`PASS: ${msg}`)
  }
}

const cases: Array<{
  name: string
  intendedToPublish: boolean
  publish: { scheduled: boolean; detail?: string } | null
  revert: boolean
}> = [
  { name: 'weekly/other skip', intendedToPublish: false, publish: null, revert: false },
  { name: 'draft created', intendedToPublish: true, publish: { scheduled: true, detail: undefined }, revert: false },
  { name: 'not connected stays approved', intendedToPublish: true, publish: { scheduled: false, detail: 'not_connected' }, revert: false },
  { name: 'no account stays approved', intendedToPublish: true, publish: { scheduled: false, detail: 'no_account_for_platform' }, revert: false },
  { name: 'video skip stays approved', intendedToPublish: true, publish: { scheduled: false, detail: 'video_not_supported' }, revert: false },
  { name: 'zernio unconfigured stays approved', intendedToPublish: true, publish: { scheduled: false, detail: 'zernio_not_configured' }, revert: false },
  { name: 'no media stays approved', intendedToPublish: true, publish: { scheduled: false, detail: 'no_media' }, revert: false },
  { name: 'presign failure reverts', intendedToPublish: true, publish: { scheduled: false, detail: 'presign_failed' }, revert: true },
  { name: 'upload failure reverts', intendedToPublish: true, publish: { scheduled: false, detail: 'zernio_upload_failed' }, revert: true },
  { name: 'media download failure reverts', intendedToPublish: true, publish: { scheduled: false, detail: 'media_download_failed' }, revert: true },
  { name: 'insufficient credits reverts', intendedToPublish: true, publish: { scheduled: false, detail: 'insufficient_credits' }, revert: true },
  { name: 'accounts fetch failure reverts', intendedToPublish: true, publish: { scheduled: false, detail: 'accounts_fetch_failed' }, revert: true },
  { name: 'Zernio 500 message reverts', intendedToPublish: true, publish: { scheduled: false, detail: '[publisher] Zernio 500: oops' }, revert: true },
  { name: 'thrown/null result reverts', intendedToPublish: true, publish: null, revert: true },
  { name: 'empty detail reverts', intendedToPublish: true, publish: { scheduled: false }, revert: true },
]

console.log('=== Approve publish retry (revert decision) ===\n')

for (const row of cases) {
  const got = shouldRevertApprovalAfterPublish({
    intendedToPublish: row.intendedToPublish,
    publish: row.publish,
  })
  assert(got === row.revert, `${row.name} → revert=${row.revert}`)
}

assert(
  NON_RETRYABLE_PUBLISH_SKIP_DETAILS.includes('not_connected'),
  'not_connected is a documented non-retryable skip',
)

const routePath = resolve('app/api/agents/tasks/[id]/approve/route.ts')
const route = readFileSync(routePath, 'utf8')
assert(route.includes('shouldRevertApprovalAfterPublish'), 'approve route calls shouldRevertApprovalAfterPublish')
assert(route.includes('revertClaimedApproval'), 'approve route restores pending_approval after publish failure')
assert(route.includes("status: 'pending_approval'"), 'revert writes status pending_approval')
assert(route.includes('status: 502'), 'retryable publish failure returns 502 (not 200)')
assert(route.includes("error: 'publish_failed'"), 'retryable publish failure returns publish_failed')
assert(
  route.includes('failed to link zernio_post_id after draft create'),
  'successful draft + link failure stays approved (no second Zernio post)',
)

const publisherPath = resolve('lib/social/publisher.ts')
const publisher = readFileSync(publisherPath, 'utf8')
assert(publisher.includes('export async function getProfileAccountsStrict'), 'strict account listing exists')

const publishPath = resolve('lib/agents/publishApprovedOutput.ts')
const publishSrc = readFileSync(publishPath, 'utf8')
assert(publishSrc.includes('getProfileAccountsStrict'), 'publish path uses strict account listing')
assert(!/getProfileAccounts\(zernioProfileId\)/.test(publishSrc), 'publish path does not use fail-soft account listing')

if (process.exitCode) {
  console.error('\nVerify failed.')
  process.exit(process.exitCode)
}
console.log('\nAll approve-publish retry checks passed.')
