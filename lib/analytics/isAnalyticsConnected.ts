import { collectZernioProfileIds } from '@/lib/social/zernioProfileIds'

/** Minimal profile fields for dashboard / checklist analytics status. */
export type AnalyticsConnectionFields = {
  ga_connected?: boolean | null
  ga_refresh_token?: string | null
  ga_measurement_id?: string | null
  meta_connected?: boolean | null
  meta_ad_account_id?: string | null
  zernio_profile_id?: string | null
  zernio_profile_ids?: string[] | null
  zernio_connected_platforms?: string[] | null
}

/** True when GA OAuth, legacy Meta flags, or Zernio social analytics are connected. */
export function isAnalyticsConnected(
  profile: AnalyticsConnectionFields | null | undefined,
): boolean {
  if (!profile) return false

  if (profile.ga_connected || profile.ga_refresh_token || profile.ga_measurement_id) {
    return true
  }

  if (profile.meta_connected || profile.meta_ad_account_id) {
    return true
  }

  const zernioIds = collectZernioProfileIds(profile)
  return zernioIds.length > 0 && (profile.zernio_connected_platforms?.length ?? 0) > 0
}
