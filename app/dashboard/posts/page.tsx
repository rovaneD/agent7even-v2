import { Suspense } from 'react'
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { loadDashboardSession } from '@/lib/profiles/getDashboardWorkspaceContext'
import { getAnalyticsProfileForClerkUser } from '@/lib/profiles/getAnalyticsProfile'
import PostsClient from './PostsClient'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'
import { approvalQueueKind } from '@/lib/agents/contentPosting'
import { getContentLifecycleCounts } from '@/lib/content/lifecycleCounts'
import * as publisher from '@/lib/social/publisher'

export type PostsDataState = 'mock' | 'live' | 'empty'

function getPostsState(profile: {
  plan: string | null
  zernio_profile_id?: string | null
  zernio_connected_platforms?: string[] | null
}): PostsDataState {
  if (!profile.plan) return 'mock'
  if (!profile.zernio_profile_id || !profile.zernio_connected_platforms?.length) return 'empty'
  return 'live'
}

export default async function PostsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  const { profile, workspace } = await loadDashboardSession(supabase, userId, email)

  if (profile?.id) {
    const teamPerms = await getTeamPermissions(profile.id)
    if (!hasPermission(teamPerms, 'analytics')) redirect('/dashboard')
  }

  const workspaceProfile = await getAnalyticsProfileForClerkUser(supabase, userId, email)
  const dataUserId = workspace?.workspaceId ?? profile?.id

  const profileIds = (workspaceProfile?.zernio_profile_ids as string[] | null) ?? []
  const primaryProfileId = workspaceProfile?.zernio_profile_id ?? profileIds[0] ?? null
  if (primaryProfileId && !profileIds.includes(primaryProfileId)) {
    profileIds.unshift(primaryProfileId)
  }

  let zernioConnectedPlatforms = (workspaceProfile?.zernio_connected_platforms as string[] | null) ?? []
  let accounts: Array<{ id: string; platform: string; username: string }> = []

  if (primaryProfileId && dataUserId) {
    try {
      await publisher.withZernioUsageContext(
        { userId: dataUserId, zernioProfileId: primaryProfileId },
        async () => {
          accounts = await publisher.getProfileAccounts(primaryProfileId)
          const connectedPlatforms = await publisher.getConnectedPlatforms(primaryProfileId)
          if (connectedPlatforms.length > 0) zernioConnectedPlatforms = connectedPlatforms
        },
      )
    } catch (err) {
      console.error('[posts/page] account fetch failed:', err)
    }
  }

  const dataState = getPostsState({
    plan: workspaceProfile?.plan ?? null,
    zernio_profile_id: primaryProfileId,
    zernio_connected_platforms: zernioConnectedPlatforms,
  })

  let pendingPostApprovalCount = 0
  if (dataUserId) {
    const { data: pendingApprovalTasks } = await supabase
      .from('agent_tasks')
      .select('id, agent, input, agent_outputs(content, created_at)')
      .eq('user_id', dataUserId)
      .eq('requires_approval', true)
      .eq('status', 'completed')
      .is('approved_at', null)
      .is('rejected_at', null)

    pendingPostApprovalCount = (pendingApprovalTasks ?? []).filter(
      task => approvalQueueKind(task) === 'post',
    ).length
  }

  const lifecycleCounts = dataUserId
    ? await getContentLifecycleCounts(dataUserId, primaryProfileId)
    : undefined

  return (
    <Suspense>
      <PostsClient
        companyName={workspaceProfile?.company_name ?? ''}
        plan={workspaceProfile?.plan ?? ''}
        dataState={dataState}
        zernioProfileId={primaryProfileId}
        zernioProfileIds={profileIds}
        zernioConnectedPlatforms={zernioConnectedPlatforms}
        accounts={accounts}
        pendingPostApprovalCount={pendingPostApprovalCount}
        lifecycleCounts={lifecycleCounts}
        isTeamMember={workspace?.isTeamMember ?? false}
      />
    </Suspense>
  )
}
