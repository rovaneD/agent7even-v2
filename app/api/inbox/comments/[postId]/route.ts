import { NextRequest, NextResponse } from 'next/server'
import * as publisher from '@/lib/social/publisher'
import { withZernioProfileUsage } from '@/lib/social/requireZernioProfile'
import { parseInboxPostComments } from '@/lib/social/zernioInboxWorkspace'
import {
  isOwnedZernioAccountId,
  loadOwnedAccountIdSet,
} from '@/lib/social/zernioOwnedAccountIds'

type RouteContext = { params: Promise<{ postId: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  if (!process.env.ZERNIO_API_KEY) {
    return NextResponse.json({ error: 'zernio_not_configured' }, { status: 503 })
  }

  return withZernioProfileUsage(async (ctx) => {
    const { postId } = await context.params
    const accountId = req.nextUrl.searchParams.get('accountId') ?? ''
    if (!accountId) {
      return NextResponse.json({ error: 'accountId_required' }, { status: 400 })
    }

    const ownedAccountIds = await loadOwnedAccountIdSet(ctx.profileIds)
    if (!isOwnedZernioAccountId(ownedAccountIds, accountId)) {
      return NextResponse.json({ error: 'foreign_account' }, { status: 403 })
    }

    for (const profileId of ctx.profileIds) {
      const raw = await publisher.getInboxPostComments({ profileId, postId, accountId, limit: 50 })
      if (!raw) continue
      const parsed = parseInboxPostComments(raw)
      if (parsed.comments.length > 0 || (raw as Record<string, unknown>).status === 'success') {
        return NextResponse.json(
          parsed,
          { headers: { 'Cache-Control': 'no-store' } },
        )
      }
    }

    return NextResponse.json({ error: 'comments_not_found' }, { status: 404 })
  })
}

export async function POST(req: NextRequest, context: RouteContext) {
  if (!process.env.ZERNIO_API_KEY) {
    return NextResponse.json({ error: 'zernio_not_configured' }, { status: 503 })
  }

  return withZernioProfileUsage(async (ctx) => {
    const { postId } = await context.params
    let body: { accountId?: string; message?: string; commentId?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const accountId = typeof body.accountId === 'string' ? body.accountId.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    const commentId = typeof body.commentId === 'string' ? body.commentId.trim() : undefined
    if (!accountId) return NextResponse.json({ error: 'accountId_required' }, { status: 400 })
    if (!message) return NextResponse.json({ error: 'message_required' }, { status: 400 })

    const ownedAccountIds = await loadOwnedAccountIdSet(ctx.profileIds)
    if (!isOwnedZernioAccountId(ownedAccountIds, accountId)) {
      return NextResponse.json({ error: 'foreign_account' }, { status: 403 })
    }

    for (const profileId of ctx.profileIds) {
      const raw = await publisher.sendInboxCommentReply({
        profileId,
        postId,
        accountId,
        message,
        commentId,
      })
      if (raw) {
        return NextResponse.json({ ok: true, result: raw })
      }
    }

    return NextResponse.json({ error: 'send_failed' }, { status: 502 })
  })
}
