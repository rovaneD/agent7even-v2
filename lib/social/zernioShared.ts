/** Platforms that use Meta OAuth and should stay on our domain after auth (headless). */
export const ZERNIO_HEADLESS_PLATFORMS = new Set(['facebook', 'instagram', 'threads'])

export type ZernioConnectedAccountInfo = {
  id: string
  platform: string
  username: string
  displayName: string
  followersCount: number
  connectedAt: string | null
  profileId?: string
}
