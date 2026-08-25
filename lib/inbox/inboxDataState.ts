export type InboxDataState = 'mock' | 'live' | 'empty'

/** Plan + Zernio connection must come from the workspace owner profile, not the signed-in member. */
export function getInboxState(profile: {
  plan: string | null
  zernio_profile_id?: string | null
  zernio_connected_platforms?: string[] | null
}): InboxDataState {
  if (!profile.plan) return 'mock'
  if (!profile.zernio_profile_id || !profile.zernio_connected_platforms?.length) return 'empty'
  return 'live'
}
