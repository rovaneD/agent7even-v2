import { Suspense } from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import PostsClient from './PostsClient'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'
import { approvalQueueKind } from '@/lib/agents/contentPosting'
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
  let accounts: Array<{ id: string; platform: string; username: string }> = []

  if (primaryProfileId) {
    try {
      accounts = await publisher.getProfileAccounts(primaryProfileId)
      const connectedPlatforms = await publisher.getConnectedPlatforms(primaryProfileId)
      if (connectedPlatforms.length > 0) zernioConnectedPlatforms = connectedPlatforms
    } catch (err) {
      console.error('[posts/page] account fetch failed:', err)
    }
  }

  const dataState = getPostsState({
    plan: profile?.plan ?? null,
    zernio_profile_id: primaryProfileId,
    zernio_connected_platforms: zernioConnectedPlatforms,
  })

  let pendingPostApprovalCount = 0
  if (profile?.id) {
    const { data: pendingApprovalTasks } = await supabase
      .from('agent_tasks')
      .select('id, agent, input, agent_outputs(content, created_at)')
      .eq('user_id', profile.id)
      .eq('requires_approval', true)
      .eq('status', 'completed')
      .is('approved_at', null)
      .is('rejected_at', null)

    pendingPostApprovalCount = (pendingApprovalTasks ?? []).filter(
      task => approvalQueueKind(task) === 'post',
    ).length
  }

  return (
    <Suspense>
      <PostsClient
        companyName={profile?.company_name ?? ''}
        plan={profile?.plan ?? ''}
        dataState={dataState}
        zernioProfileId={primaryProfileId}
        zernioProfileIds={profileIds}
        zernioConnectedPlatforms={zernioConnectedPlatforms}
        accounts={accounts}
        pendingPostApprovalCount={pendingPostApprovalCount}
      />
    </Suspense>
  )
}
