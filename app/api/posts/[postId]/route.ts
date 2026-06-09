import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import * as publisher from '@/lib/social/publisher'
import { parseSinglePost } from '@/lib/social/zernioPostsParse'

async function requireZernioProfile() {
  const { userId } = await auth()
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, zernio_profile_id, zernio_profile_ids')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile?.plan) {
    return { error: NextResponse.json({ error: 'active_plan_required' }, { status: 403 }) }
  }

  return { ok: true as const }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const ctx = await requireZernioProfile()
  if ('error' in ctx && ctx.error) return ctx.error

  const { postId } = await params
  const raw = await publisher.getPost(postId)
  if (!raw) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const post = parseSinglePost(raw)
  if (!post) return NextResponse.json({ error: 'invalid_response' }, { status: 502 })

  return NextResponse.json({ post })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const ctx = await requireZernioProfile()
  if ('error' in ctx && ctx.error) return ctx.error

  const { postId } = await params
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
    })
    const post = parseSinglePost(raw)
    return NextResponse.json({ post, raw })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'update_failed'
    return NextResponse.json({ error: 'zernio_update_failed', detail: message }, { status: 502 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const ctx = await requireZernioProfile()
  if ('error' in ctx && ctx.error) return ctx.error

  const { postId } = await params
  const ok = await publisher.deletePost(postId)
  if (!ok) return NextResponse.json({ error: 'delete_failed' }, { status: 502 })
  return NextResponse.json({ ok: true })
}
