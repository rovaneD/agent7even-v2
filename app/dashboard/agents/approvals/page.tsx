import { Suspense } from 'react'
import { auth } from '@clerk/nextjs/server'
import { getClerkSessionEmail } from '@/lib/clerk/sessionUser'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { loadDashboardSession } from '@/lib/profiles/getDashboardWorkspaceContext'
import { createPostAssetSignedUrl, readPostMediaRef } from '@/lib/postAssets'
import { getContentLifecycleCounts } from '@/lib/content/lifecycleCounts'
import { listPendingApprovalTasks } from '@/lib/agents/pendingApprovals'
import { resolveProfileDisplayNames } from '@/lib/profiles/resolveActorName'
import ApprovalsClient from './ApprovalsClient'

export default async function ApprovalsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const email = await getClerkSessionEmail()
  const { profile, workspace } = await loadDashboardSession(supabase, userId, email)

  if (!profile) redirect('/foundation')

  const workspaceProfile = workspace?.workspaceProfile ?? profile
  const dataUserId = workspace?.workspaceId ?? profile.id

  const lifecycleCounts = await getContentLifecycleCounts(
    dataUserId,
    (workspaceProfile.zernio_profile_id as string | null) ?? null,
    { zernioStatuses: ['draft'] },
  )

  const [tasks, { data: runningVideoRows }] = await Promise.all([
    listPendingApprovalTasks(supabase, dataUserId),

    supabase
      .from('agent_tasks')
      .select('id, input, created_at')
      .eq('user_id', dataUserId)
      .eq('agent', 'video_generation')
      .eq('status', 'running')
      .order('created_at', { ascending: false }),
  ])

  const actorIds = tasks
    .map(task => (task as { actor_profile_id?: string | null }).actor_profile_id)
    .filter((id): id is string => Boolean(id))
  const actorNames = await resolveProfileDisplayNames(supabase, actorIds)

  const tasksWithActors = tasks.map(task => {
    const row = task as { actor_profile_id?: string | null }
    const actorProfileId = row.actor_profile_id ?? null
    return {
      ...task,
      actor_profile_id: actorProfileId,
      actorName: actorProfileId ? actorNames.get(actorProfileId) ?? 'Team member' : 'You',
    }
  })

  const enrichedTasks = await Promise.all(tasksWithActors.map(async task => {
    const outputs = await Promise.all((task.agent_outputs ?? []).map(async (output: Record<string, unknown>) => {
      const content = (output.content ?? {}) as Record<string, unknown>
      const media = readPostMediaRef(content)
      const mediaPreviewUrl = media.media_storage_path
        ? await createPostAssetSignedUrl(media.media_storage_path)
        : null
      return { ...output, mediaPreviewUrl }
    }))
    return { ...task, agent_outputs: outputs }
  }))

  const runningVideoTasks = (runningVideoRows ?? []).map(t => ({
    id: t.id as string,
    createdAt: t.created_at as string,
    input: (t.input ?? {}) as Record<string, unknown>,
  }))

  return (
    <Suspense>
      <ApprovalsClient
        profileId={dataUserId}
        initialTasks={enrichedTasks}
        runningVideoTasks={runningVideoTasks}
        draftPostCount={lifecycleCounts.draft}
        postsConnected={lifecycleCounts.postsConnected}
        viralHooksHints={{
          audience: workspaceProfile.ideal_customer ?? undefined,
        }}
      />
    </Suspense>
  )
}
