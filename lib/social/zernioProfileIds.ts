import * as publisher from '@/lib/social/publisher'

/** Deduped Zernio profile IDs for a tenant (primary + array). */
export function collectZernioProfileIds(profile: {
  zernio_profile_id?: string | null
  zernio_profile_ids?: string[] | null
}): string[] {
  const ids = [...((profile.zernio_profile_ids as string[] | null) ?? [])]
  const primary = profile.zernio_profile_id as string | null | undefined
  if (primary && !ids.includes(primary)) {
    ids.push(primary)
  }
  return ids
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
