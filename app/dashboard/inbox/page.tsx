import { Suspense } from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'
import * as publisher from '@/lib/social/publisher'
import InboxClient from './InboxClient'

export type InboxDataState = 'mock' | 'live' | 'empty'

function getInboxState(profile: {
  plan: string | null
  zernio_profile_id?: string | null
  zernio_connected_platforms?: string[] | null
}): InboxDataState {
  if (!profile.plan) return 'mock'
  if (!profile.zernio_profile_id || !profile.zernio_connected_platforms?.length) return 'empty'
  return 'live'
}

export default async function InboxPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      id,
      company_name,
      plan,
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

  const profileIds = (profile?.zernio_profile_ids as string[] | null) ?? []
  const primaryProfileId = profile?.zernio_profile_id ?? profileIds[0] ?? null
  if (primaryProfileId && !profileIds.includes(primaryProfileId)) {
    profileIds.unshift(primaryProfileId)
  }

  let zernioConnectedPlatforms = (profile?.zernio_connected_platforms as string[] | null) ?? []
  if (primaryProfileId && profile?.id) {
    try {
      await publisher.withZernioUsageContext(
        { userId: profile.id, zernioProfileId: primaryProfileId },
        async () => {
          const connectedPlatforms = await publisher.getConnectedPlatforms(primaryProfileId)
          if (connectedPlatforms.length > 0) zernioConnectedPlatforms = connectedPlatforms
        },
      )
    } catch (err) {
      console.error('[inbox/page] connected platform fetch failed:', err)
    }
  }

  const dataState = getInboxState({
    plan: profile?.plan ?? null,
    zernio_profile_id: primaryProfileId,
    zernio_connected_platforms: zernioConnectedPlatforms,
  })

  return (
    <Suspense>
      <InboxClient
        companyName={profile?.company_name ?? ''}
        dataState={dataState}
        zernioConnectedPlatforms={zernioConnectedPlatforms}
      />
    </Suspense>
  )
}
