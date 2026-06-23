import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import * as publisher from '@/lib/social/publisher'
import { parsePostsList, parseSinglePost } from '@/lib/social/zernioPostsParse'
import {
  buildZernioPlatformTargets,
  parsePlatformTargets,
  validatePost,
} from '@/lib/social/postConstraints'

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

  const profileIds = (profile.zernio_profile_ids as string[] | null) ?? []
  if (profile.zernio_profile_id && !profileIds.includes(profile.zernio_profile_id)) {
    profileIds.push(profile.zernio_profile_id)
  }

  if (profileIds.length === 0) {
    return { error: NextResponse.json({ error: 'not_connected' }, { status: 404 }) }
  }

  return { profileIds, primaryProfileId: profileIds[0] }
}

export async function GET(req: NextRequest) {
  if (!process.env.ZERNIO_API_KEY) {
    return NextResponse.json(
      { error: 'zernio_not_configured', message: 'Social publishing is not configured on this server.' },
      { status: 503 },
    )
  }

  const ctx = await requireZernioProfile()
  if ('error' in ctx && ctx.error) return ctx.error
  const { profileIds, primaryProfileId } = ctx as { profileIds: string[]; primaryProfileId: string }

  const { searchParams } = req.nextUrl
  const profileId = searchParams.get('profileId') ?? primaryProfileId
  if (!profileIds.includes(profileId)) {
    return NextResponse.json({ error: 'invalid_profile' }, { status: 400 })
  }

  const status = searchParams.get('status') as 'draft' | 'scheduled' | 'published' | 'failed' | null
  const raw = await publisher.listPosts({
    profileId,
    accountId: searchParams.get('accountId') ?? undefined,
    platform: searchParams.get('platform') ?? undefined,
    status: status ?? undefined,
    page: Number(searchParams.get('page') ?? '1') || 1,
    limit: Math.min(Number(searchParams.get('limit') ?? '20') || 20, 100),
    sortBy: searchParams.get('sortBy') ?? 'scheduled-desc',
    search: searchParams.get('search') ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
  })

  if (!raw) {
    return NextResponse.json({ error: 'zernio_api_error' }, { status: 502 })
  }

  const parsed = parsePostsList(raw)
  const accounts = await publisher.getProfileAccounts(profileId)

  return NextResponse.json({
    ...parsed,
    profileId,
    accounts,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  if (!process.env.ZERNIO_API_KEY) {
    return NextResponse.json(
      { error: 'zernio_not_configured', message: 'Social publishing is not configured on this server.' },
      { status: 503 },
    )
  }

  const ctx = await requireZernioProfile()
  if ('error' in ctx && ctx.error) return ctx.error
  const { profileIds, primaryProfileId } = ctx as { profileIds: string[]; primaryProfileId: string }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const profileId = String(body.profileId ?? primaryProfileId)
  if (!profileIds.includes(profileId)) {
    return NextResponse.json({ error: 'invalid_profile' }, { status: 400 })
  }

  const mode = String(body.mode ?? 'schedule')
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const mediaItems = Array.isArray(body.mediaItems)
    ? (body.mediaItems as Array<{ url?: string; type?: string; title?: string }>)
        .filter(item => typeof item?.url === 'string' && item.url.length > 0)
        .map(item => ({
          url: String(item.url),
          type: String(item.type ?? 'image'),
          ...(typeof item.title === 'string' && item.title ? { title: item.title } : {}),
        }))
    : []
  const hasMedia = mediaItems.length > 0
  const platformTargets = parsePlatformTargets(Array.isArray(body.platforms) ? body.platforms : [])

  const validationErrors = validatePost({
    content,
    mediaItems,
    mode,
    platforms: platformTargets,
  })
  if (validationErrors.length > 0) {
    return NextResponse.json(
      { error: 'validation_failed', messages: validationErrors, message: validationErrors[0] },
      { status: 400 },
    )
  }

  const zernioPlatforms = buildZernioPlatformTargets(platformTargets)

  try {
    const raw = await publisher.createPost({
      profileId,
      content: content || undefined,
      title: typeof body.title === 'string' ? body.title : undefined,
      platforms: zernioPlatforms,
      scheduledFor: typeof body.scheduledFor === 'string' ? body.scheduledFor : undefined,
      timezone: typeof body.timezone === 'string' ? body.timezone : 'America/Los_Angeles',
      publishNow: mode === 'now',
      isDraft: mode === 'draft',
      queuedFromProfile: mode === 'queue' ? profileId : undefined,
      queueId: typeof body.queueId === 'string' && body.queueId ? body.queueId : undefined,
      mediaItems: hasMedia ? mediaItems : undefined,
      requestId: typeof body.requestId === 'string' ? body.requestId : crypto.randomUUID(),
    })

    const post = parseSinglePost(raw)
    return NextResponse.json({ post, raw }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'create_failed'
    console.error('[posts] create failed:', message)
    return NextResponse.json({ error: 'zernio_create_failed', detail: message }, { status: 502 })
  }
}
