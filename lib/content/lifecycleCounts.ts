import { getPendingApprovalCount } from '@/lib/agents/pendingApprovals'
import { createServiceClient } from '@/lib/supabase/server'
import * as publisher from '@/lib/social/publisher'
import { parsePostsList } from '@/lib/social/zernioPostsParse'

export type ContentLifecycleCounts = {
  review: number
  draft: number
  scheduled: number
  published: number
  postsConnected: boolean
}

async function countPostsByStatus(
  profileId: string,
  userId: string,
  status: 'draft' | 'scheduled' | 'published',
): Promise<number> {
  if (!process.env.ZERNIO_API_KEY) return 0
  return publisher.withZernioUsageContext(
    { userId, zernioProfileId: profileId },
    async () => {
      const raw = await publisher.listPosts({ profileId, status, limit: 1, page: 1 })
      if (!raw) return 0
      return parsePostsList(raw).pagination.total
    },
  )
}

/** Aggregate approval queue + Zernio post statuses for lifecycle surfacing. */
export async function getContentLifecycleCounts(
  profileId: string,
  zernioProfileId: string | null,
): Promise<ContentLifecycleCounts> {
  const supabase = createServiceClient()

  const review = await getPendingApprovalCount(supabase, profileId)

  if (!zernioProfileId) {
    return {
      review,
      draft: 0,
      scheduled: 0,
      published: 0,
      postsConnected: false,
    }
  }

  const [draft, scheduled, published] = await Promise.all([
    countPostsByStatus(zernioProfileId, profileId, 'draft'),
    countPostsByStatus(zernioProfileId, profileId, 'scheduled'),
    countPostsByStatus(zernioProfileId, profileId, 'published'),
  ])

  return {
    review,
    draft,
    scheduled,
    published,
    postsConnected: true,
  }
}
