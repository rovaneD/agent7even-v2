import { getTenantConnectedAccounts } from '@/lib/social/publisher'

/** Build the set of Zernio social account IDs a tenant may act on. */
export function collectOwnedAccountIds(accounts: Array<{ id: string }>): Set<string> {
  const ids = new Set<string>()
  for (const account of accounts) {
    if (account.id) ids.add(account.id)
  }
  return ids
}

/**
 * Shared ZERNIO_API_KEY means every route that accepts a client `accountId`
 * must allowlist against the caller's connected accounts. Missing/empty ids
 * fail closed.
 */
export function isOwnedZernioAccountId(
  ownedAccountIds: Set<string>,
  accountId: string | null | undefined,
): boolean {
  if (!accountId) return false
  return ownedAccountIds.has(accountId)
}

/** First accountId not in the owned set, or null when all are owned. */
export function findForeignAccountId(
  ownedAccountIds: Set<string>,
  accountIds: Iterable<string | null | undefined>,
): string | null {
  for (const id of accountIds) {
    if (!id) continue
    if (!ownedAccountIds.has(id)) return id
  }
  return null
}

/** Pull accountId strings from a platforms payload (create/update body). */
export function extractPlatformAccountIds(platforms: unknown): string[] {
  if (!Array.isArray(platforms)) return []
  const out: string[] = []
  for (const item of platforms) {
    if (!item || typeof item !== 'object') continue
    const accountId = (item as Record<string, unknown>).accountId
    if (typeof accountId === 'string' && accountId) out.push(accountId)
  }
  return out
}

/** Live connected-account allowlist for the tenant's Zernio profile ids. */
export async function loadOwnedAccountIdSet(profileIds: string[]): Promise<Set<string>> {
  const accounts = await getTenantConnectedAccounts(profileIds)
  return collectOwnedAccountIds(accounts)
}
