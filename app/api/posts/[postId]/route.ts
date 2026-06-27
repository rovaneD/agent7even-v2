import { NextRequest, NextResponse } from 'next/server'
import * as publisher from '@/lib/social/publisher'
import { withZernioProfileUsage } from '@/lib/social/requireZernioProfile'
import { parseSinglePost, readZernioPostProfileId } from '@/lib/social/zernioPostsParse'

async function loadOwnedPost(postId: string, profileIds: string[]) {
  const raw = await publisher.getPost(postId)
  if (!raw) {
    return { error: NextResponse.json({ error: 'not_found' }, { status: 404 }) }
  }

  const postProfileId = readZernioPostProfileId(raw)
  if (!postProfileId || !profileIds.includes(postProfileId)) {
    return { error: NextResponse.json({ error: 'not_found' }, { status: 404 }) }
  }

  return { raw }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  return withZernioProfileUsage(async (ctx) => {
    const { postId } = await params
    const owned = await loadOwnedPost(postId, ctx.profileIds)
    if ('error' in owned) return owned.error

    const post = parseSinglePost(owned.raw)
    if (!post) return NextResponse.json({ error: 'invalid_response' }, { status: 502 })

    return NextResponse.json({ post })
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  return withZernioProfileUsage(async (ctx) => {
    const { postId } = await params
    const owned = await loadOwnedPost(postId, ctx.profileIds)
    if ('error' in owned) return owned.error

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    try {
      const raw = await publisher.updatePost(postId, {
        content: typeof body.content === 'string' ? body.content : undefined,
        title: typeof body.title === 'string' ? body.title : undefined,
        platforms: Array.isArray(body.platforms) ? body.platforms as publisher.ZernioPostPlatformTarget[] : undefined,
        scheduledFor: typeof body.scheduledFor === 'string' ? body.scheduledFor : undefined,
        timezone: typeof body.timezone === 'string' ? body.timezone : undefined,
        publishNow: body.publishNow === true,
        isDraft: body.isDraft === true,
        queuedFromProfile: typeof body.queuedFromProfile === 'string' ? body.queuedFromProfile : undefined,
        mediaItems: Array.isArray(body.mediaItems)
          ? body.mediaItems as Array<{ url: string; type: string; title?: string }>
          : undefined,
      })
      const post = parseSinglePost(raw)
      return NextResponse.json({ post, raw })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'update_failed'
      return NextResponse.json({ error: 'zernio_update_failed', detail: message }, { status: 502 })
    }
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  return withZernioProfileUsage(async (ctx) => {
    const { postId } = await params
    const owned = await loadOwnedPost(postId, ctx.profileIds)
    if ('error' in owned) return owned.error

    const ok = await publisher.deletePost(postId)
    if (!ok) return NextResponse.json({ error: 'delete_failed' }, { status: 502 })
    return NextResponse.json({ ok: true })
  })
}
