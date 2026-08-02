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

/**
 * OAuth callback `profileId` query values may only bind IDs this tenant already owns.
 * Connect creates/stores the Zernio profile before issuing the auth URL; accepting an
 * unbound id would let an attacker attach another customer's shared-key profile.
 * Omitting profileId is allowed (does not expand ownership).
 */
export function isOwnedZernioCallbackProfileId(
  profile: {
    zernio_profile_id?: string | null
    zernio_profile_ids?: string[] | null
  },
  profileId: string | null | undefined,
): boolean {
  if (!profileId) return true
  return collectZernioProfileIds(profile).includes(profileId)
}
