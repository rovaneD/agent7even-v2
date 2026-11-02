import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getWorkspaceAuthContext, workspaceDataUserId } from '@/lib/profiles/workspaceSession'
import { createPostAssetSignedUrl, downloadPostAsset } from '@/lib/postAssets'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'
import { posterFrame } from '@/lib/agents/videoGeneration/assemble'
import { assembleProductCut, type ProductShot, type ProductTransition } from '@/lib/agents/videoGeneration/productCut'
import { planSignature, type SignatureAsset, type SignatureAssets, type SignatureRole } from '@/lib/agents/videoGeneration/signatureTemplate'

/**
 * Internal (test accounts only): cut a Product ad from bake-off clips. No credits, no model calls.
 * Body { shots: [{ jobId | path | imagePath | layers{background, items[{path,x,y,w,angle,at}]}, from, to, zoom?, zoomSec?, step?, hold?, frostSec?, frostHold? }], clicks?, texts?: [{ text, start, end }], crossfade?, loop?, loopSec?, loopTransition? }.
 * Or { template: 'signature', assets: { <role>: { path, duration?, takes?, baked? } | [...] } } to fill the
 * owner's Signature edit (signatureTemplate.ts) with one product's assets; kind = video for .mp4/.mov.
 * Returns signed URLs for the video and its poster (and the planned shot list for templates).
 */
export const maxDuration = 180
export const runtime = 'nodejs'

const INTERNAL_EMAILS = new Set(['rovane@dursodesign.com', 'melissa@agent7even.com', 'rovdurs@gmail.com'])

type LayerItem = { path: string; x: number; y: number; w: number; angle?: number; at: number }
type AssetIn = { path: string; duration?: number; takes?: number[]; baked?: boolean }
type Body = {
  template?: 'signature'
  assets?: Partial<Record<SignatureRole, AssetIn | AssetIn[]>>
  shots?: Array<{
    jobId?: string; path?: string; imagePath?: string; from: number; to: number; zoom?: number; zoomSec?: number
    transition?: ProductTransition; transitionSec?: number
    step?: number; hold?: number; frostSec?: number; frostHold?: number; frostOut?: boolean; frostFog?: boolean
    layers?: { background: string; items: LayerItem[] }
    click?: boolean
  }>
  clicks?: boolean
  soundtrackPath?: string
  soundtrackOffset?: number
  texts?: Array<{ text: string; start: number; end: number }>
  crossfade?: number
  loop?: boolean
  loopSec?: number
  loopTransition?: ProductTransition
}

export async function POST(req: Request) {
  const supabase = createServiceClient()
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx?.email || !INTERNAL_EMAILS.has(ctx.email.toLowerCase())) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const profileId = workspaceDataUserId(ctx.session)
  const body = (await req.json().catch(() => ({}))) as Body
  let plan: ReturnType<typeof planSignature<string>> | null = null
  if (body.template === 'signature') {
    const assets: SignatureAssets<string> = {}
    for (const [role, v] of Object.entries(body.assets ?? {}) as Array<[SignatureRole, AssetIn | AssetIn[]]>) {
      const arr = (Array.isArray(v) ? v : [v]).filter(a => a && typeof a.path === 'string').slice(0, 12)
      assets[role] = arr.map((a): SignatureAsset<string> => ({
        ref: a.path, kind: /\.(mp4|mov)$/i.test(a.path) ? 'video' : 'image',
        duration: a.duration != null ? Number(a.duration) : undefined,
        takes: Array.isArray(a.takes) ? a.takes.map(Number).filter(Number.isFinite) : undefined,
        baked: a.baked === true,
      }))
    }
    try { plan = planSignature(assets) } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'bad_assets' }, { status: 400 }) }
    body.shots = plan.map(p => ({
      ...(p.kind === 'image' ? { imagePath: p.ref } : { path: p.ref }),
      from: p.from, to: p.to, zoom: p.zoom, zoomSec: p.zoomSec, frostSec: p.frostSec, frostHold: p.frostHold, frostFog: p.frostFog, click: p.click,
    }))
  }
  const list = (body.shots ?? []).slice(0, 80) // Signature edits run 30+ shots (owner edit: 33)
  if (!list.length) return NextResponse.json({ error: 'shots_required' }, { status: 400 })

  const cache = new Map<string, Buffer>()
  const shots: ProductShot[] = []
  const load = async (p: string | null) => {
    if (!p || !p.startsWith(`${profileId}/`)) return { error: NextResponse.json({ error: 'bad_shot', path: p }, { status: 400 }) }
    let v = cache.get(p) ?? null
    if (!v) {
      v = await downloadPostAsset(p)
      if (!v) return { error: NextResponse.json({ error: 'shot_not_found', path: p }, { status: 404 }) }
      cache.set(p, v)
    }
    return { buf: v }
  }
  const num = (x: unknown) => (x != null ? Number(x) : undefined)
  for (const s of list) {
    const common = {
      from: Number(s.from), to: Number(s.to), zoom: num(s.zoom), zoomSec: num(s.zoomSec),
      transition: s.transition, transitionSec: num(s.transitionSec),
      step: num(s.step), hold: num(s.hold), frostSec: num(s.frostSec), frostHold: num(s.frostHold), frostOut: s.frostOut === true, frostFog: s.frostFog === false ? false : undefined, click: s.click === false ? false : undefined,
    }
    if (s.layers) {
      const bg = await load(s.layers.background)
      if (bg.error) return bg.error
      const items: NonNullable<ProductShot['layers']>['items'] = []
      for (const it of (s.layers.items ?? []).slice(0, 16)) {
        const r = await load(it.path)
        if (r.error) return r.error
        items.push({ image: r.buf!, x: Number(it.x), y: Number(it.y), w: Number(it.w), angle: num(it.angle), at: Number(it.at) })
      }
      shots.push({ ...common, layers: { background: bg.buf!, items } })
      continue
    }
    const r = await load(s.imagePath ?? s.path ?? (s.jobId ? `${profileId}/bakeoff-video-${s.jobId.replace(/[^a-zA-Z0-9-]/g, '')}.mp4` : null))
    if (r.error) return r.error
    shots.push({ ...common, ...(s.imagePath ? { image: r.buf! } : { video: r.buf! }) })
  }

  let soundtrack: Buffer | undefined
  if (body.soundtrackPath) {
    const r = await load(body.soundtrackPath)
    if (r.error) return r.error
    soundtrack = r.buf
  }

  const started = Date.now()
  try {
    const out = await assembleProductCut({ shots, clicks: body.clicks, soundtrack, soundtrackOffset: body.soundtrackOffset, texts: body.texts, crossfade: body.crossfade, loop: body.loop, loopSec: body.loopSec, loopTransition: body.loopTransition })
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
      ...(plan ? { plan: plan.map(p => ({ role: p.role, ref: p.ref.split('/').pop(), from: p.from, to: p.to })) } : {}),
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message.slice(-1200) : String(err) }, { status: 500 })
  }
}

/**
 * GET ?path=<profileId>/product-cut-*.mp4 → fresh signed URL for an earlier cut. Long cuts (30+ shots
 * with 1080p clips) can finish after the gateway gives up on the POST (~90s); the file is still saved.
 */
export async function GET(req: Request) {
  const supabase = createServiceClient()
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx?.email || !INTERNAL_EMAILS.has(ctx.email.toLowerCase())) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const profileId = workspaceDataUserId(ctx.session)
  const p = new URL(req.url).searchParams.get('path') ?? ''
  if (!p.startsWith(`${profileId}/product-cut-`) || p.includes('..')) return NextResponse.json({ error: 'bad_path' }, { status: 400 })
  return NextResponse.json({ path: p, url: await createPostAssetSignedUrl(p, 60 * 60 * 24) })
}
