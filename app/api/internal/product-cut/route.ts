import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getWorkspaceAuthContext, workspaceDataUserId } from '@/lib/profiles/workspaceSession'
import { createPostAssetSignedUrl, downloadPostAsset } from '@/lib/postAssets'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'
import { posterFrame } from '@/lib/agents/videoGeneration/assemble'
import { assembleProductCut, type ProductShot } from '@/lib/agents/videoGeneration/productCut'

/**
 * Internal (test accounts only): cut a Product ad from bake-off clips. No credits, no model calls.
 * Body { shots: [{ jobId | path | imagePath, from, to, zoom?, zoomSec? }], texts?: [{ text, start, end }], crossfade? }.
 * Returns signed URLs for the video and its poster.
 */
export const maxDuration = 180
export const runtime = 'nodejs'

const INTERNAL_EMAILS = new Set(['rovane@dursodesign.com', 'melissa@agent7even.com', 'rovdurs@gmail.com'])

type Body = {
  shots?: Array<{ jobId?: string; path?: string; imagePath?: string; from: number; to: number; zoom?: number; zoomSec?: number }>
  texts?: Array<{ text: string; start: number; end: number }>
  crossfade?: number
}

export async function POST(req: Request) {
  const supabase = createServiceClient()
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx?.email || !INTERNAL_EMAILS.has(ctx.email.toLowerCase())) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const profileId = workspaceDataUserId(ctx.session)
  const body = (await req.json().catch(() => ({}))) as Body
  const list = (body.shots ?? []).slice(0, 24)
  if (!list.length) return NextResponse.json({ error: 'shots_required' }, { status: 400 })

  const cache = new Map<string, Buffer>()
  const shots: ProductShot[] = []
  for (const s of list) {
    const p = s.imagePath ?? s.path ?? (s.jobId ? `${profileId}/bakeoff-video-${s.jobId.replace(/[^a-zA-Z0-9-]/g, '')}.mp4` : null)
    if (!p || !p.startsWith(`${profileId}/`)) return NextResponse.json({ error: 'bad_shot', path: p }, { status: 400 })
    let v = cache.get(p) ?? null
    if (!v) {
      v = await downloadPostAsset(p)
      if (!v) return NextResponse.json({ error: 'shot_not_found', path: p }, { status: 404 })
      cache.set(p, v)
    }
    shots.push({ ...(s.imagePath ? { image: v } : { video: v }), from: Number(s.from), to: Number(s.to), zoom: s.zoom != null ? Number(s.zoom) : undefined, zoomSec: s.zoomSec != null ? Number(s.zoomSec) : undefined })
  }

  const started = Date.now()
  try {
    const out = await assembleProductCut({ shots, texts: body.texts, crossfade: body.crossfade })
    const stamp = Date.now()
    const path = `${profileId}/product-cut-${stamp}.mp4`
    const { error } = await supabase.storage.from(POST_ASSETS_BUCKET).upload(path, out.video, { contentType: 'video/mp4', upsert: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const poster = await posterFrame(out.video, 1)
    let posterUrl: string | null = null
    if (poster) {
      const pp = `${path}.jpg`
      const up = await supabase.storage.from(POST_ASSETS_BUCKET).upload(pp, poster, { contentType: 'image/jpeg', upsert: true })
      if (!up.error) posterUrl = await createPostAssetSignedUrl(pp, 60 * 60 * 24)
    }
    return NextResponse.json({
      path,
      url: await createPostAssetSignedUrl(path, 60 * 60 * 24),
      posterUrl,
      durationSec: Number(out.durationSec.toFixed(2)),
      ms: Date.now() - started,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message.slice(-1200) : String(err) }, { status: 500 })
  }
}
