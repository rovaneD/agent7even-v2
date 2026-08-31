/**
 * Locks site-snapshot scrape URL selection so teammates cannot overwrite
 * the workspace owner snapshot with a member Settings / Foundation URL.
 *
 *   npm run verify:site-snapshot-workspace
 */
import assert from 'node:assert/strict'
import { resolveSiteSnapshotScrapeUrl } from '../lib/foundation/resolveSiteSnapshotScrapeUrl'

const OWNER = 'owner-profile-id'
const MEMBER = 'member-profile-id'

function scrape(opts: {
  memberId: string
  workspaceId: string
  workspaceWebsiteUrl: string | null
  requestedWebsiteUrl?: string | null
}) {
  return resolveSiteSnapshotScrapeUrl(opts)
}

assert.equal(
  scrape({
    memberId: OWNER,
    workspaceId: OWNER,
    workspaceWebsiteUrl: 'https://company.com',
    requestedWebsiteUrl: 'https://new.company.com',
  }),
  'https://new.company.com',
  'owner Generate may scrape a newly typed URL before save',
)

assert.equal(
  scrape({
    memberId: OWNER,
    workspaceId: OWNER,
    workspaceWebsiteUrl: 'https://company.com/',
    requestedWebsiteUrl: null,
  }),
  'https://company.com',
  'owner without override uses the saved workspace website',
)

assert.equal(
  scrape({
    memberId: MEMBER,
    workspaceId: OWNER,
    workspaceWebsiteUrl: 'https://company.com',
    requestedWebsiteUrl: 'https://teammate.personal.site',
  }),
  'https://company.com',
  'teammate Generate must not scrape a member Settings URL onto the owner snapshot',
)

assert.equal(
  scrape({
    memberId: MEMBER,
    workspaceId: OWNER,
    workspaceWebsiteUrl: null,
    requestedWebsiteUrl: 'https://teammate.personal.site',
  }),
  null,
  'teammate cannot create a workspace snapshot from a member-only URL',
)

assert.equal(
  scrape({
    memberId: MEMBER,
    workspaceId: OWNER,
    workspaceWebsiteUrl: 'company.com',
    requestedWebsiteUrl: undefined,
  }),
  'https://company.com',
  'teammate Refresh without body URL still scrapes the workspace site',
)

console.log('verify-site-snapshot-workspace: PASS')
