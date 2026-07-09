import { getPendingApprovalCount } from '@/lib/agents/pendingApprovals'
import { countApprovedPostPipelineOutputs } from '@/lib/content/agentOutputLifecycle'
import { createServiceClient } from '@/lib/supabase/server'
import * as publisher from '@/lib/social/publisher'
import { parsePostsList } from '@/lib/social/zernioPostsParse'

export type ContentLifecycleCounts = {
  review: number
  approved: number
  draft: number
  scheduled: number
  published: number
  postsConnected: boolean
}

export type ContentLifecycleZernioStatus = 'draft' | 'scheduled' | 'published'

export type ContentLifecycleCountsOptions = {
  /** Limit Zernio listPosts calls — defaults to all three statuses. */
  zernioStatuses?: ContentLifecycleZernioStatus[]
}

async function countPostsByStatus(
  profileId: string,
  userId: string,
  status: ContentLifecycleZernioStatus,
): Promise<number> {
  if (!process.env.ZERNIO_API_KEY) return 0
  try {
    return await publisher.withZernioUsageContext(
      { userId, zernioProfileId: profileId },
      async () => {
        const raw = await publisher.listPosts({ profileId, status, limit: 1, page: 1 })
        if (!raw) return 0
        return parsePostsList(raw).pagination.total
      },
    )
  } catch {
    return 0
  }
}

/** Aggregate approval queue + Zernio post statuses for lifecycle surfacing. */
export async function getContentLifecycleCounts(
  profileId: string,
  zernioProfileId: string | null,
  options?: ContentLifecycleCountsOptions,
): Promise<ContentLifecycleCounts> {
  const supabase = createServiceClient()

  const review = await getPendingApprovalCount(supabase, profileId)
  const approved = await countApprovedPostPipelineOutputs(supabase, profileId)

  if (!zernioProfileId) {
    return {
      review,
      approved,
      draft: 0,
      scheduled: 0,
      published: 0,
      postsConnected: false,
    }
  }

  const statuses = options?.zernioStatuses ?? ['draft', 'scheduled', 'published']
  const counts: Record<ContentLifecycleZernioStatus, number> = {
    draft: 0,
    scheduled: 0,
    published: 0,
  }

  const results = await Promise.allSettled(
    statuses.map(async (status) => {
      counts[status] = await countPostsByStatus(zernioProfileId, profileId, status)
    }),
  )

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('[lifecycleCounts] Zernio post count failed:', result.reason)
    }
  }

  return {
    review,
    approved,
    draft: counts.draft,
    scheduled: counts.scheduled,
    published: counts.published,
    postsConnected: true,
  }
}
