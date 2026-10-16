import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getWorkspaceAuthContext, workspaceDataUserId } from '@/lib/profiles/workspaceSession'
import { createPostAssetSignedUrl, uploadPostAsset } from '@/lib/postAssets'
import { generateImageForComparison, type ImageAspectRatio } from '@/lib/agents/imageGeneration/openRouterImage'

/**
 * Internal image-model bake-off: renders every prompt × model combination and returns
 * signed URLs. Internal test accounts only (plan coordination rule 8). Not linked in the UI.
 */
export const maxDuration = 300

const INTERNAL_EMAILS = new Set([
  'rovane@dursodesign.com',
  'melissa@agent7even.com',
  'rovdurs@gmail.com',
])

type Body = { prompts?: string[]; models?: string[]; aspectRatio?: ImageAspectRatio; label?: string; references?: string[] }

function sniffMime(b: Buffer): { mime: string; ext: string } {
  if (b[0] === 0x89 && b[1] === 0x50) return { mime: 'image/png', ext: 'png' }
  if (b[0] === 0xff && b[1] === 0xd8) return { mime: 'image/jpeg', ext: 'jpg' }
  return { mime: 'image/webp', ext: 'webp' }
}

export async function POST(req: Request) {
  const supabase = createServiceClient()
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx || !ctx.email || !INTERNAL_EMAILS.has(ctx.email.toLowerCase())) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const body = (await req.json().catch(() => ({}))) as Body
  const prompts = (body.prompts ?? []).map(p => p.trim()).filter(Boolean).slice(0, 6)
  const models = (body.models ?? []).map(m => m.trim()).filter(Boolean).slice(0, 8)
  if (prompts.length === 0 || models.length === 0) {
    return NextResponse.json({ error: 'prompts_and_models_required' }, { status: 400 })
  }
  const profileId = workspaceDataUserId(ctx.session)
  const run = `bakeoff-${Date.now()}`

  const jobs = prompts.flatMap((prompt, pi) => models.map(model => ({ prompt, pi, model })))
  const results = await Promise.all(jobs.map(async ({ prompt, pi, model }) => {
    const started = Date.now()
    try {
      const references = (body.references ?? []).filter(u => /^https:\/\//.test(u)).slice(0, 4)
      const { bytes, costUsd, route } = await generateImageForComparison(model, prompt, body.aspectRatio ?? '4:5', references)
      const { mime, ext } = sniffMime(bytes)
      const { storagePath } = await uploadPostAsset({
        profileId,
        filename: `${run}-p${pi + 1}-${model.replace(/[^a-z0-9.-]/gi, '_')}.${ext}`,
        mime,
        bytes,
      })
      const url = await createPostAssetSignedUrl(storagePath, 60 * 60 * 24)
      return { prompt: pi + 1, model, route, costUsd, ms: Date.now() - started, url, storagePath }
    } catch (err) {
      return { prompt: pi + 1, model, ms: Date.now() - started, error: err instanceof Error ? err.message.slice(0, 300) : String(err) }
    }
  }))

  console.info(`[image-bakeoff] ${run} ${body.label ?? ''}`, JSON.stringify(results.map(r => ({ p: r.prompt, m: r.model, ok: !('error' in r), ms: r.ms }))))
  return NextResponse.json({ run, results })
}
