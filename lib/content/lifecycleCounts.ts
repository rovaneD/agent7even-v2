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
  status: 'draft' | 'scheduled' | 'published',
): Promise<number> {
  if (!process.env.ZERNIO_API_KEY) return 0
  const raw = await publisher.listPosts({ profileId, status, limit: 1, page: 1 })
  if (!raw) return 0
  return parsePostsList(raw).pagination.total
}

/** Aggregate approval queue + Zernio post statuses for lifecycle surfacing. */
export async function getContentLifecycleCounts(
  profileId: string,
  zernioProfileId: string | null,
): Promise<ContentLifecycleCounts> {
  const supabase = createServiceClient()

  const { count: review } = await supabase
    .from('agent_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profileId)
    .eq('requires_approval', true)
    .eq('status', 'completed')
    .is('approved_at', null)
    .is('rejected_at', null)

  if (!zernioProfileId) {
    return {
      review: review ?? 0,
      draft: 0,
      scheduled: 0,
      published: 0,
      postsConnected: false,
    }
  }

  const [draft, scheduled, published] = await Promise.all([
    countPostsByStatus(zernioProfileId, 'draft'),
    countPostsByStatus(zernioProfileId, 'scheduled'),
    countPostsByStatus(zernioProfileId, 'published'),
  ])

  return {
    review: review ?? 0,
    draft,
    scheduled,
    published,
    postsConnected: true,
  }
}
