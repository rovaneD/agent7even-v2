import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import AnalyticsClient from './AnalyticsClient'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'
import * as publisher from '@/lib/social/publisher'
import { collectZernioProfileIds, syncTenantConnectedPlatforms } from '@/lib/social/zernioProfileIds'
import type { ZernioConnectedAccountInfo } from '@/lib/social/publisher'

export type AnalyticsDataState = 'mock' | 'live' | 'empty'

function getAnalyticsState(profile: {
  plan: string | null
  zernio_profile_id?: string | null
  zernio_connected_platforms?: string[] | null
}): AnalyticsDataState {
  if (!profile.plan) return 'mock'
  if (!profile.zernio_profile_id || !profile.zernio_connected_platforms?.length) return 'empty'
  return 'live'
}

export default async function AnalyticsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      id,
      company_name,
      plan,
      ga_connected,
      ga_measurement_id,
      ga_oauth_email,
      meta_connected,
      instagram_handle,
      meta_ad_account_id,
      zernio_profile_id,
      zernio_profile_ids,
      zernio_connected_platforms
    `)
    .eq('clerk_user_id', userId)
    .single()

  if (profile?.id) {
    const teamPerms = await getTeamPermissions(profile.id)
    if (!hasPermission(teamPerms, 'analytics')) redirect('/dashboard')
  }

  const zernioProfileIds = profile ? collectZernioProfileIds(profile) : []
  const zernioProfileId = zernioProfileIds[0] ?? null
  let zernioConnectedPlatforms = (profile?.zernio_connected_platforms as string[] | null) ?? []
  let zernioConnectedAccounts: ZernioConnectedAccountInfo[] = []

  if (zernioProfileIds.length > 0 && profile?.id) {
    try {
      await publisher.withZernioUsageContext(
        { userId: profile.id as string, zernioProfileId: zernioProfileId ?? undefined },
        async () => {
          zernioConnectedAccounts = await publisher.getTenantConnectedAccounts(zernioProfileIds)
          const syncedPlatforms = await syncTenantConnectedPlatforms(zernioProfileIds)
          if (syncedPlatforms.length > 0) {
            zernioConnectedPlatforms = syncedPlatforms
          } else if (zernioConnectedAccounts.length > 0) {
            zernioConnectedPlatforms = Array.from(
              new Set(zernioConnectedAccounts.map((a) => a.platform.toLowerCase()).filter(Boolean)),
            )
          }
        },
      )
    } catch (err) {
      console.error('[analytics/page] connected account fetch failed:', err)
    }
  }

  const dataState = getAnalyticsState({
    plan:                       profile?.plan ?? null,
    zernio_profile_id:          zernioProfileId,
    zernio_connected_platforms: zernioConnectedPlatforms,
  })

  return (
    <AnalyticsClient
      companyName={profile?.company_name ?? ''}
      plan={profile?.plan ?? ''}
      dataState={dataState}
      gaMeasurementId={profile?.ga_measurement_id ?? null}
      gaOAuthConnected={profile?.ga_connected ?? false}
      gaOAuthEmail={profile?.ga_oauth_email ?? null}
      zernioConnectedPlatforms={zernioConnectedPlatforms}
      zernioConnectedAccounts={zernioConnectedAccounts}
    />
  )
}
