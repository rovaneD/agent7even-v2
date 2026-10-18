import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getWorkspaceAuthContext, workspaceDataUserId } from '@/lib/profiles/workspaceSession'
import { createPostAssetSignedUrl, downloadPostAsset } from '@/lib/postAssets'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'
import { assembleVideo } from '@/lib/agents/videoGeneration/assemble'
import { loadBrandLogoReference } from '@/lib/agents/imageGeneration/postStyles'

/** Internal (test accounts only): run the edit step on a bake-off clip. No credits, no model calls. */
export const maxDuration = 180
export const runtime = 'nodejs'

const INTERNAL_EMAILS = new Set(['rovane@dursodesign.com', 'melissa@agent7even.com', 'rovdurs@gmail.com'])

async function fetchBytes(url: string): Promise<Buffer | null> {
  try {
    const r = await fetch(url)
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const supabase = createServiceClient()
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx?.email || !INTERNAL_EMAILS.has(ctx.email.toLowerCase())) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const profileId = workspaceDataUserId(ctx.session)
  const body = (await req.json().catch(() => ({}))) as {
    bakeoffJobId?: string
    lines?: string[]
    insert?: { path?: string; url?: string; line: number }
    endCard?: { text: string; useBrandLogo?: boolean; background?: string }
  }
  if (!body.bakeoffJobId || !body.lines?.length) return NextResponse.json({ error: 'bakeoffJobId_and_lines_required' }, { status: 400 })

  const srcPath = `${profileId}/bakeoff-video-${body.bakeoffJobId.replace(/[^a-zA-Z0-9-]/g, '')}.mp4`
  const video = await downloadPostAsset(srcPath)
  if (!video) return NextResponse.json({ error: 'source_not_found', srcPath }, { status: 404 })

  let insertImage: Buffer | null = null
  if (body.insert?.path) insertImage = await downloadPostAsset(body.insert.path)
  else if (body.insert?.url) insertImage = await fetchBytes(body.insert.url)
  const logoUrl = body.endCard?.useBrandLogo ? await loadBrandLogoReference(profileId) : null
  const logo = logoUrl ? await fetchBytes(logoUrl) : null

  const started = Date.now()
  try {
    const out = await assembleVideo({
      video,
      lines: body.lines,
      insert: insertImage && body.insert ? { image: insertImage, line: body.insert.line } : null,
      endCard: body.endCard ? { text: body.endCard.text, logo, background: body.endCard.background } : null,
    })
    const path = `${profileId}/assembled-${body.bakeoffJobId.replace(/[^a-zA-Z0-9-]/g, '')}-${Date.now()}.mp4`
    const { error } = await supabase.storage.from(POST_ASSETS_BUCKET).upload(path, out.video, { contentType: 'video/mp4', upsert: true })
    if (error) throw new Error(error.message)
    return NextResponse.json({
      url: await createPostAssetSignedUrl(path, 60 * 60 * 24),
      path,
      ms: Date.now() - started,
      durationSec: out.durationSec,
      lineTimes: out.lineTimes,
      chunks: out.chunks,
      logo: Boolean(logo),
      insert: Boolean(insertImage),
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message.slice(0, 1200) : String(err), ms: Date.now() - started }, { status: 500 })
  }
}
