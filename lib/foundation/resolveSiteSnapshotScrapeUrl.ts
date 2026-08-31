import { normalizeWebsiteUrl } from '../maya/canonicalWebsite'

/**
 * Pick the URL to scrape for a workspace site snapshot.
 *
 * Snapshots are stored on the workspace owner and injected into agent context.
 * Teammate Settings / Foundation hub URLs live on the member row. Generate
 * sends that member URL as `websiteUrl`; using it would replace the owner's
 * agent-facing snapshot with the wrong site.
 *
 * Only the workspace owner may scrape a URL other than the saved workspace site.
 */
export function resolveSiteSnapshotScrapeUrl(opts: {
  memberId: string
  workspaceId: string
  workspaceWebsiteUrl: string | null | undefined
  requestedWebsiteUrl?: string | null
}): string | null {
  const workspaceUrl = normalizeWebsiteUrl(opts.workspaceWebsiteUrl ?? null)
  const requested = normalizeWebsiteUrl(opts.requestedWebsiteUrl ?? null)
  if (opts.memberId === opts.workspaceId) {
    return requested ?? workspaceUrl
  }
  return workspaceUrl
}
