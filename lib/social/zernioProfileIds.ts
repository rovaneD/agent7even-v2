import * as publisher from '@/lib/social/publisher'

/** Deduped Zernio profile IDs for a tenant (primary + array). */
export function collectZernioProfileIds(profile: {
  zernio_profile_id?: string | null
  zernio_profile_ids?: string[] | null
}): string[] {
  const ids = [...((profile.zernio_profile_ids as string[] | null) ?? [])]
  const primary = profile.zernio_profile_id as string | null | undefined
  if (primary && !ids.includes(primary)) {
    ids.unshift(primary)
  }
  return Array.from(new Set(ids.filter(Boolean)))
}

/** Live platform list across every tenant Zernio profile. */
export async function syncTenantConnectedPlatforms(profileIds: string[]): Promise<string[]> {
  const platforms = new Set<string>()
  for (const profileId of profileIds) {
    for (const platform of await publisher.getConnectedPlatforms(profileId)) {
      platforms.add(platform.toLowerCase())
    }
    for (const account of await publisher.getProfileConnectedAccounts(profileId)) {
      if (account.platform) platforms.add(account.platform.toLowerCase())
    }
  }
  return Array.from(platforms)
}

/** Disconnect a platform (optionally one account) from whichever profile owns it. */
export async function disconnectPlatformFromTenant(
  profileIds: string[],
  platform: string,
  accountId?: string,
): Promise<{ ok: boolean; profileIds: string[] }> {
  const normalized = platform.toLowerCase()
  const touched = new Set<string>()

  for (const profileId of profileIds) {
    const accounts = await publisher.getProfileConnectedAccounts(profileId)
    const matches = accounts.filter((a) => {
      if (accountId) return a.id === accountId
      return a.platform.toLowerCase() === normalized
    })

    if (matches.length === 0) {
      const ok = await publisher.disconnectAccount(profileId, normalized)
      if (ok) touched.add(profileId)
      continue
    }

    for (const match of matches) {
      const slug = match.platform.toLowerCase()
      const ownerId = match.profileId ?? profileId
      let ok = await publisher.disconnectAccount(ownerId, slug)
      if (!ok && match.id) {
        ok = await publisher.disconnectAccountById(match.id)
      }
      if (ok) touched.add(ownerId)
    }
  }

  return { ok: touched.size > 0, profileIds: Array.from(touched) }
}

/** Disconnect every Zernio profile for a tenant. Fail-soft — one failure does not abort others. */
async function teardownZernioProfile(profileId: string): Promise<boolean> {
  const platforms = await publisher.getConnectedPlatforms(profileId)
  for (const platform of platforms) {
    await publisher.disconnectAccount(profileId, platform)
  }
  return publisher.disconnectAllAccounts(profileId)
}

export async function disconnectAllZernioProfiles(
  profileIds: string[],
): Promise<Array<{ id: string; ok: boolean }>> {
  const results: Array<{ id: string; ok: boolean }> = []
  for (const id of profileIds) {
    const ok = await teardownZernioProfile(id)
    results.push({ id, ok })
  }
  return results
}

export const ZERNIO_TEARDOWN_COLUMNS = {
  zernio_connected_platforms: [] as string[],
  zernio_profile_id: null as null,
  zernio_profile_ids: [] as string[],
}
