import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import AnalyticsClient from './AnalyticsClient'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'

export type AnalyticsDataState = 'mock' | 'live' | 'empty'

function getAnalyticsState(profile: {
  plan: string | null
  trial_active?: boolean | null
  zernio_profile_id?: string | null
  zernio_connected_platforms?: string[] | null
}): AnalyticsDataState {
  const hasPlan = profile.plan && !profile.trial_active
  if (!hasPlan) return 'mock'
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
      trial_active,
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

  const dataState = getAnalyticsState({
    plan:                       profile?.plan ?? null,
    trial_active:               profile?.trial_active ?? null,
    zernio_profile_id:          profile?.zernio_profile_id ?? null,
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
