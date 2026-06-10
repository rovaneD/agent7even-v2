type ZernioProfileConnection = {
  zernio_profile_id?: string | null
  zernio_profile_ids?: unknown
}

export function getZernioProfileIds(profile: ZernioProfileConnection): string[] {
  const ids = Array.isArray(profile.zernio_profile_ids)
    ? profile.zernio_profile_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []

  if (profile.zernio_profile_id && !ids.includes(profile.zernio_profile_id)) {
    ids.push(profile.zernio_profile_id)
  }

  return ids
}

export function ownsZernioPost(
  post: { profileId?: string | null },
  profileIds: readonly string[],
): boolean {
  return typeof post.profileId === 'string' && profileIds.includes(post.profileId)
}
