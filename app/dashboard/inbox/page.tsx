import { Suspense } from 'react'
import { auth } from '@clerk/nextjs/server'
import { getClerkSessionEmail } from '@/lib/clerk/sessionUser'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { getAnalyticsProfileForClerkUser } from '@/lib/profiles/getAnalyticsProfile'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'
import { getInboxState, type InboxDataState } from '@/lib/inbox/inboxDataState'
import * as publisher from '@/lib/social/publisher'
import InboxClient from './InboxClient'

export type { InboxDataState }

export default async function InboxPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const email = await getClerkSessionEmail()

  const memberProfile = await resolveClerkProfile(supabase, userId, 'id', email)
  if (memberProfile?.id) {
    const teamPerms = await getTeamPermissions(memberProfile.id)
    if (!hasPermission(teamPerms, 'analytics')) redirect('/dashboard')
  }

  // Workspace owner — team members have plan/zernio null on their own row.
  const profile = await getAnalyticsProfileForClerkUser(supabase, userId, email)

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
