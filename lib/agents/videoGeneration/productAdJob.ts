import { randomUUID } from 'node:crypto'
import type { createServiceClient } from '@/lib/supabase/server'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'
import { createPostAssetSignedUrl, downloadPostAsset } from '@/lib/postAssets'
import { generateImageForComparison, openRouterHeaders } from '@/lib/agents/imageGeneration/openRouterImage'
import { recordAgentTaskCost } from '@/lib/agents/taskInstrumentation'
import type { ActionCreditKey } from '@/lib/credits/actionCosts'
import { posterFrame } from './assemble'
import { failVideoTask } from './failVideoTask'
import { pollVideoJob } from './openRouterVideo'
import { assembleProductCut, type ProductShot } from './productCut'
import { planSignature, type SignatureAssets } from './signatureTemplate'

/**
 * Product ad (no person), owner-approved recipe (project doc claude/product_ad_format_spec.md):
 *  1. the user's own product photos → stills Maya makes for each shot type (label shot, angle, group,
 *     lifestyle, texture, texture being worked, wet glass). Every readable label comes from the user's
 *     photo; the user reviews every still (and can redo a few) before anything is animated.
 *  2. Kling animates only label-free stills (texture, spreading) plus the wet glass with its first AND
 *     last frame locked to the approved still, so only the water on the glass moves.
 *  3. the option's edit: Signature = the owner's Resolve cut as a template (signatureTemplate.ts).
 * Silent output: users add a sound in Instagram or TikTok (owner 2026-10-30).
 */

type Supabase = ReturnType<typeof createServiceClient>

export const PRODUCT_AD_AGENT = 'video_product_ad'
export const STILL_MODEL = 'google/gemini-3-pro-image'
export const CLIP_MODEL = 'kwaivgi/kling-v3.0-pro'
export const PRODUCT_AD_REDOS = 3
const USD = { still: 0.13, kling5s: 0.56, kling3s1080: 0.84 }

export type ProductAdOption = 'clean' | 'creative' | 'signature'
/** Options the edit can make today. Clean and Creative get their own templates next. */
export const PRODUCT_AD_READY_OPTIONS: ProductAdOption[] = ['signature']

export type ProductStillKey = 'hero' | 'angle' | 'group' | 'lifestyle' | 'texture' | 'apply' | 'wetGlass'

export type ProductAdTaskInput = {
  profileId: string
  typeId: 'product_ad'
  option: ProductAdOption
  productName: string
  /** What the product is and what's in it, in the user's words. Ingredients come only from here. */
  details: string
  /**
   * Which product leads (the label shot and the wet glass), when the photos show several. Allies of Skin
   * test 2026-11-03: one photo of four products gave a 2x2 grid as the "label shot".
   */
  leadProduct?: string
  /** The user's own product photos (storage paths). */
  photos: string[]
  stills: Partial<Record<ProductStillKey, string>>
  redosLeft: number
  stage: 'stills' | 'review' | 'rendering' | 'editing' | 'done'
  jobs?: { wetGlass?: string; texture?: string; apply?: string }
  title: string
  caption?: string
  editingSince?: string
}

const KEEP_PRODUCT =
  'The product must be exactly the product in the reference photo(s): same shape, proportions, colors, materials, cap and label. Copy every word, logo and mark on the label exactly as printed; never invent, fix or change any text. No extra text, no watermark.'
const ONE_FRAME = 'One single photograph: never a grid, collage, split screen or several panels.'
const STUDIO =
  'Premium beauty/product photography, soft diffused studio light with gentle shadows, warm neutral palette, minimal set, shallow depth of field, vertical 9:16, photoreal.'

type About = Pick<ProductAdTaskInput, 'productName' | 'details' | 'leadProduct'>
function lead(input: About): string {
  return input.leadProduct?.trim() || 'the main product'
}

function about(input: About): string {
  const d = input.details.trim()
  return `The product: ${input.productName.trim() || 'the product in the photo'}${d ? ` (${d})` : ''}.`
}

/** Still prompt per shot type. Texture and spreading shots show no label (they get animated). */
export function productStillPrompt(key: ProductStillKey, input: About): string {
  const a = about(input)
  switch (key) {
    case 'hero':
      return [a, `Hero label shot of ONE product only: ${lead(input)}. If the reference shows several products, show only that one; leave the others out.`, 'It stands upright, centered, label facing the camera and sharp, on a simple stone or acrylic plinth.', KEEP_PRODUCT, ONE_FRAME, STUDIO].join(' ')
    case 'angle':
      return [a, 'The product(s) at an angle: tilted or leaning against small blocks, three-quarter view, labels still readable.', KEEP_PRODUCT, ONE_FRAME, STUDIO].join(' ')
    case 'group':
      return [a, 'All the products from the reference photos together in one composition, labels facing the camera, arranged on plinths at different heights.', KEEP_PRODUCT, ONE_FRAME, STUDIO].join(' ')
    case 'lifestyle':
      return [a, 'Styled top-down flat lay: the product lying on soft linen with a few simple props that suit it (a comb, a folded towel, a small dish). Do not add fruit, flowers or ingredients unless they are named in the product description.', KEEP_PRODUCT, ONE_FRAME, STUDIO].join(' ')
    case 'texture':
      return [a, 'Macro close-up of the product\'s own texture only (as it really looks: cream, gel, oil, serum or powder), a generous swirl or drop on a clean surface. No packaging, no label, no text in frame.', ONE_FRAME, STUDIO].join(' ')
    case 'apply':
      return [a, 'Close-up of the product\'s own texture being spread across a clean pale surface by a small metal spatula, a smooth ribbon of texture. No packaging, no label, no text in frame.', ONE_FRAME, STUDIO].join(' ')
    case 'wetGlass':
      return [
        'The exact same product, same position and framing as the reference image, photographed through a pane of glass placed right in front of the camera lens.',
        'The glass is covered in fine condensation with many beads of water and a few drops running down, the droplets in sharp focus on the glass. The glass is fogged enough that the product behind it is clearly soft and diffused: its shape, colors and large name read through, but small print on the label is not legible.',
        'Warm soft backlight, cream and amber tones, wet reflective surface under the product.',
        'Do not change the product, its shape, colors or label. Vertical 9:16 product photograph, no added text.',
        ONE_FRAME,
      ].join(' ')
  }
}

export const MOTION_PROMPTS = {
  wetGlass:
    'Locked-off static camera. Only the water on the glass in front of the lens moves: a few water droplets slowly run down the glass, leaving thin wet trails, tiny beads tremble. The product, its label, the light and the background stay completely still and unchanged. No camera movement, no zoom, nothing else moves.',
  texture:
    'Locked-off camera, macro. The texture moves naturally at real-time speed: it slowly folds, drips and settles under its own weight, true to how this product really behaves. No hands, no packaging, no text, no camera movement.',
  apply:
    'Locked-off camera, close-up. The metal spatula slowly spreads the texture across the surface in one smooth stroke, the texture behaving exactly as this product really does. No packaging, no label, no text, no camera movement.',
}

/** Which stills a product needs: group only when the user gave 2+ photos; wet glass is made from the hero. */
export function stillKeysFor(photoCount: number, severalProducts = false): ProductStillKey[] {
  return ['hero', 'angle', ...(photoCount >= 2 || severalProducts ? (['group'] as const) : []), 'lifestyle', 'texture', 'apply', 'wetGlass']
}

/** Generate one 9:16 still and store it; returns the storage path. */
export async function makeProductStill(supabase: Supabase, profileId: string, prompt: string, refUrls: string[]): Promise<string> {
  const { bytes } = await generateImageForComparison(STILL_MODEL, prompt, '9:16', refUrls, '2K')
  const path = `${profileId}/product-still-${randomUUID()}.png`
  const { error } = await supabase.storage.from(POST_ASSETS_BUCKET).upload(path, bytes, { contentType: 'image/png', upsert: false })
  if (error) throw new Error(`storage: ${error.message}`)
  return path
}

/** Make one still: the wet glass uses the approved hero still; every other still uses the user's photos. */
export async function makeStillFor(supabase: Supabase, input: ProductAdTaskInput, key: ProductStillKey): Promise<string> {
  const sign = (p: string) => createPostAssetSignedUrl(p, 60 * 60)
  const refs = key === 'wetGlass'
    ? [await sign(input.stills.hero ?? '')]
    : await Promise.all(input.photos.slice(0, 4).map(sign))
  if (refs.some(r => !r)) throw new Error(`could not sign the references for ${key}`)
  return makeProductStill(supabase, input.profileId, productStillPrompt(key, input), refs as string[])
}

export async function signedProductStills(stills: ProductAdTaskInput['stills']): Promise<Partial<Record<ProductStillKey, string | null>>> {
  const out: Partial<Record<ProductStillKey, string | null>> = {}
  await Promise.all(Object.entries(stills).map(async ([k, p]) => { out[k as ProductStillKey] = p ? await createPostAssetSignedUrl(p, 60 * 60 * 6) : null }))
  return out
}

async function fetchBytes(url: string, headers?: Record<string, string>): Promise<Buffer | null> {
  try {
    const r = await fetch(url, headers ? { headers } : undefined)
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null
  } catch {
    return null
  }
}

/** Signature: fill the owner's edit template with this product's stills and clips. */
export function signatureShots(input: ProductAdTaskInput, stills: Partial<Record<ProductStillKey, Buffer>>, clips: { wetGlass: Buffer; texture: Buffer; apply: Buffer }): ProductShot[] {
  const buf = new Map<string, Buffer>()
  const img = (k: ProductStillKey) => (stills[k] ? (buf.set(k, stills[k]!), { ref: k, kind: 'image' as const }) : undefined)
  buf.set('clip:wetGlass', clips.wetGlass).set('clip:texture', clips.texture).set('clip:apply', clips.apply)
  const assets: SignatureAssets<string> = {
    hero: img('hero'),
    hero2: img('angle'),
    group: img('group'),
    angle: img('angle'),
    lifestyle: img('lifestyle'),
    textureStill: { ref: 'clip:texture', kind: 'video', duration: 5 },
    pour: { ref: 'clip:texture', kind: 'video', duration: 5 },
    textureMotion: { ref: 'clip:apply', kind: 'video', duration: 5 },
    apply: { ref: 'clip:apply', kind: 'video', duration: 5 },
    frost: { ref: 'clip:wetGlass', kind: 'video', duration: 3, baked: true, wetGlass: true },
  }
  for (const k of Object.keys(assets) as Array<keyof typeof assets>) if (!assets[k]) delete assets[k]
  return planSignature(assets).map(({ ref, kind, role: _role, ...rest }) => ({ ...rest, ...(kind === 'image' ? { image: buf.get(ref)! } : { video: buf.get(ref)! }) }))
}

/**
 * Move a product ad forward. 'review' waits for the user; 'rendering' polls the three Kling jobs; when
 * all are done one caller claims the edit, assembles and puts the video in Approvals. Any failed render
 * fails the task and refunds everything it was charged.
 */
export async function advanceProductAdTask(
  supabase: Supabase,
  task: { id: string; user_id: string; status: string; input: unknown; action_type?: string | null },
): Promise<{ status: 'review' | 'rendering' | 'editing' | 'completed' | 'failed' }> {
  if (task.status === 'completed') return { status: 'completed' }
  if (task.status === 'failed') return { status: 'failed' }
  const input = task.input as ProductAdTaskInput
  if (input.stage === 'stills' || input.stage === 'review') return { status: 'review' }
  if (input.stage === 'editing') {
    const since = input.editingSince ? Date.parse(input.editingSince) : 0
    if (Date.now() - since < 6 * 60_000) return { status: 'editing' }
  }
  const ids = [input.jobs?.wetGlass, input.jobs?.texture, input.jobs?.apply]
  if (ids.some(id => !id)) {
    await failVideoTask(supabase, task.id, task.user_id)
    return { status: 'failed' }
  }
  const polls = await Promise.all(ids.map(id => pollVideoJob(id!)))
  if (polls.some(p => p.status === 'failed')) {
    await failVideoTask(supabase, task.id, task.user_id)
    return { status: 'failed' }
  }
  if (polls.some(p => p.status !== 'completed')) return { status: 'rendering' }

  const claimed = { ...input, stage: 'editing' as const, editingSince: new Date().toISOString() }
  const { data: won } = await supabase
    .from('agent_tasks')
    .update({ input: claimed })
    .eq('id', task.id)
    .eq('status', 'running')
    .eq('input->>stage', input.stage)
    .select('id')
  if (!won?.length) return { status: 'editing' }

  try {
    const videos = await Promise.all(polls.map(p => {
      const src = p.unsigned_urls?.[0]
      return src ? fetchBytes(src, openRouterHeaders()) : Promise.resolve(null)
    }))
    if (videos.some(v => !v)) throw new Error('could not download a rendered clip')
    const [wetGlass, texture, apply] = videos as Buffer[]
    // Keep the raw clips so the edit can be redone (or another option cut) without new renders.
    await Promise.all(
      (['wetGlass', 'texture', 'apply'] as const).map((k, i) =>
        supabase.storage.from(POST_ASSETS_BUCKET).upload(`${input.profileId}/product-raw-${task.id}-${k}.mp4`, (videos as Buffer[])[i]!, { contentType: 'video/mp4', upsert: true }),
      ),
    ).catch(() => {})
    const stills: Partial<Record<ProductStillKey, Buffer>> = {}
    await Promise.all(Object.entries(input.stills).map(async ([k, p]) => {
      const b = p ? await downloadPostAsset(p) : null
      if (b) stills[k as ProductStillKey] = b
    }))
    if (!stills.hero) throw new Error('hero still missing')

    if (input.option !== 'signature') throw new Error(`option ${input.option} not ready`)
    const out = await assembleProductCut({ shots: signatureShots(input, stills, { wetGlass: wetGlass!, texture: texture!, apply: apply! }) })

    const storagePath = `${input.profileId}/${randomUUID()}.mp4`
    const { error: upErr } = await supabase.storage.from(POST_ASSETS_BUCKET).upload(storagePath, out.video, { contentType: 'video/mp4', upsert: false })
    if (upErr) throw new Error(`storage: ${upErr.message}`)
    const poster = await posterFrame(out.video, 1)
    const posterPath = poster ? `${storagePath}.jpg` : null
    if (poster && posterPath) await supabase.storage.from(POST_ASSETS_BUCKET).upload(posterPath, poster, { contentType: 'image/jpeg', upsert: true })

    await supabase.from('agent_outputs').insert({
      task_id: task.id,
      user_id: task.user_id,
      agent: 'video_generation',
      output_type: 'social_post',
      title: input.title || 'Product ad',
      content: {
        raw: input.caption?.trim() || input.productName,
        media_storage_path: storagePath,
        media_mime: 'video/mp4',
        media_poster_path: posterPath,
        generated: {
          model: `${STILL_MODEL} + ${CLIP_MODEL}`,
          video_type: input.typeId,
          option: input.option,
          duration_sec: out.durationSec,
          stills: input.stills,
          silent: true,
        },
      },
      status: 'pending_approval',
      lifecycle_stage: 'review',
    })

    const stillsMade = Object.keys(input.stills).length + (PRODUCT_AD_REDOS - input.redosLeft)
    const cost = stillsMade * USD.still + USD.kling3s1080 + 2 * USD.kling5s
    await recordAgentTaskCost(task.id, {
      action_type: (task.action_type as ActionCreditKey) ?? 'product_ad_signature',
      cost_usd: Math.round(cost * 100) / 100,
      add_cost_usd: true,
      model: CLIP_MODEL,
    })
    await supabase
      .from('agent_tasks')
      .update({ status: 'completed', completed_at: new Date().toISOString(), input: { ...claimed, stage: 'done' } })
      .eq('id', task.id)
    return { status: 'completed' }
  } catch (err) {
    console.error('[product-ad] edit failed', task.id, err instanceof Error ? err.message : err)
    await failVideoTask(supabase, task.id, task.user_id)
    return { status: 'failed' }
  }
}
