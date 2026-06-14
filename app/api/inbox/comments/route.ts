import { NextRequest, NextResponse } from 'next/server'
import * as publisher from '@/lib/social/publisher'
import { requireZernioProfile } from '@/lib/social/requireZernioProfile'
import { mergeCommentPosts, parseInboxComments } from '@/lib/social/zernioInboxWorkspace'

export async function GET(req: NextRequest) {
  if (!process.env.ZERNIO_API_KEY) {
    return NextResponse.json({ error: 'zernio_not_configured' }, { status: 503 })
  }

  const ctx = await requireZernioProfile()
  if ('error' in ctx) return ctx.error

  const { searchParams } = req.nextUrl
  const limit = Math.min(Number(searchParams.get('limit') ?? '50') || 50, 100)
  const page = Number(searchParams.get('page') ?? '1') || 1

  const batches = await Promise.all(
    ctx.profileIds.map(async (profileId) => {
      const raw = await publisher.listInboxComments({ profileId, limit, page })
      if (!raw) return { comments: [], pagination: { hasMore: false, nextCursor: null as string | null } }
      return parseInboxComments(raw)
    }),
  )

  const comments = mergeCommentPosts(batches.flatMap(b => b.comments))
  const hasMore = batches.some(b => b.pagination.hasMore)

  return NextResponse.json(
    { comments, pagination: { hasMore, nextCursor: null } },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
