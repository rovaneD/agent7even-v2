import { Suspense } from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { createPostAssetSignedUrl, readPostMediaRef } from '@/lib/postAssets'
import { getContentLifecycleCounts } from '@/lib/content/lifecycleCounts'
import { listPendingApprovalTasks } from '@/lib/agents/pendingApprovals'
import ApprovalsClient from './ApprovalsClient'

export default async function ApprovalsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, company_name, ideal_customer, zernio_profile_id')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  const profile = profileRows?.[0] ?? null
  if (!profile) redirect('/foundation')

  const lifecycleCounts = await getContentLifecycleCounts(
    profile.id,
    (profile.zernio_profile_id as string | null) ?? null,
  )

  const [tasks, { data: runningVideoRows }] = await Promise.all([
    listPendingApprovalTasks(supabase, profile.id),

    supabase
      .from('agent_tasks')
      .select('id, input, created_at')
      .eq('user_id', profile.id)
      .eq('agent', 'video_generation')
      .eq('status', 'running')
      .order('created_at', { ascending: false }),
  ])

  const enrichedTasks = await Promise.all(tasks.map(async task => {
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
        profileId={profile.id}
        initialTasks={enrichedTasks}
        runningVideoTasks={runningVideoTasks}
        draftPostCount={lifecycleCounts.draft}
        postsConnected={lifecycleCounts.postsConnected}
        viralHooksHints={{
          audience: profile.ideal_customer ?? undefined,
        }}
      />
    </Suspense>
  )
}
