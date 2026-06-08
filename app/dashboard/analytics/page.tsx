import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import AnalyticsClient from './AnalyticsClient'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'
import * as publisher from '@/lib/social/publisher'

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
      zernio_connected_platforms
    `)
    .eq('clerk_user_id', userId)
    .single()

  if (profile?.id) {
    const teamPerms = await getTeamPermissions(profile.id)
    if (!hasPermission(teamPerms, 'analytics')) redirect('/dashboard')
  }

  // Auto-recover zernio_profile_id when platforms are connected but ID is missing.
  // This handles cases where profile creation succeeded in Zernio but the DB save failed.
  let zernioProfileId = (profile?.zernio_profile_id as string | null) ?? null
  if (!zernioProfileId && profile?.zernio_connected_platforms?.length && profile?.id) {
    try {
      const profiles = await publisher.listProfiles()
      console.log('[analytics/page] recovery attempt — profiles:', JSON.stringify(profiles.map(p => ({ id: p.id, name: p.name }))))
      const baseName = (profile.company_name as string | null) ?? 'tenant'
      const profileName = `${baseName}-${(profile.id as string).slice(0, 8)}`
      const found =
        profiles.find(p => p.name === profileName) ??
        profiles.find(p => p.name.startsWith(baseName)) ??
        (profiles.length === 1 ? profiles[0] : null)
      if (found?.id) {
        zernioProfileId = found.id
        console.log('[analytics/page] recovered zernio_profile_id:', zernioProfileId)
        const supabase2 = createServiceClient()
        await supabase2
          .from('profiles')
          .update({ zernio_profile_id: zernioProfileId })
          .eq('id', profile.id)
      }
    } catch (err) {
      console.error('[analytics/page] recovery failed:', err)
    }
  }

  const dataState = getAnalyticsState({
    plan:                       profile?.plan ?? null,
    zernio_profile_id:          zernioProfileId,
    zernio_connected_platforms: profile?.zernio_connected_platforms ?? null,
  })

  return (
    <AnalyticsClient
      companyName={profile?.company_name ?? ''}
      plan={profile?.plan ?? ''}
      dataState={dataState}
      gaMeasurementId={profile?.ga_measurement_id ?? null}
      gaOAuthConnected={profile?.ga_connected ?? false}
      gaOAuthEmail={profile?.ga_oauth_email ?? null}
      zernioConnectedPlatforms={(profile?.zernio_connected_platforms as string[] | null) ?? []}
    />
  )
}
