import { NextRequest, NextResponse } from 'next/server'
import * as publisher from '@/lib/social/publisher'
import { withZernioProfileUsage } from '@/lib/social/requireZernioProfile'
import { mergeConversations, parseInboxConversations } from '@/lib/social/zernioInboxWorkspace'

export async function GET(req: NextRequest) {
  if (!process.env.ZERNIO_API_KEY) {
    return NextResponse.json({ error: 'zernio_not_configured' }, { status: 503 })
  }

  return withZernioProfileUsage(async (ctx) => {
    const { searchParams } = req.nextUrl
    const limit = Math.min(Number(searchParams.get('limit') ?? '50') || 50, 100)
    const cursor = searchParams.get('cursor') ?? undefined

    const batches = await Promise.all(
      ctx.profileIds.map(async (profileId) => {
        const raw = await publisher.listInboxConversations({ profileId, limit, cursor })
        if (!raw) return { conversations: [], pagination: { hasMore: false, nextCursor: null as string | null } }
        return parseInboxConversations(raw)
      }),
    )

    const conversations = mergeConversations(batches.flatMap(b => b.conversations))
    const hasMore = batches.some(b => b.pagination.hasMore)
    const nextCursor = batches.find(b => b.pagination.nextCursor)?.pagination.nextCursor ?? null

    return NextResponse.json(
      { conversations, pagination: { hasMore, nextCursor } },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  })
}
