import { randomUUID } from 'node:crypto'
import type { createServiceClient } from '@/lib/supabase/server'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'
import { createPostAssetSignedUrl, downloadPostAsset } from '@/lib/postAssets'
import { generateImageForComparison, openRouterHeaders } from '@/lib/agents/imageGeneration/openRouterImage'
import { recordAgentTaskCost } from '@/lib/agents/taskInstrumentation'
import { generateText } from 'ai'
import { openrouter } from '@/lib/ai/client'
import { VISION_CAPTION_MODEL } from '@/lib/agents/visionCaption'
import { compressImageForApiPayload } from '@/lib/postAssetsImagePayload'
import type { ActionCreditKey } from '@/lib/credits/actionCosts'
import { posterFrame } from './assemble'
import { failVideoTask } from './failVideoTask'
import { pollVideoJobSafely } from './videoPoll'
import { assembleProductCut, type ProductShot } from './productCut'
import { planProductTemplate, type SignatureAssets } from './signatureTemplate'

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

export type StillCheck = { passed: boolean; issues: string[] }

export type ProductAdOption = 'clean' | 'creative' | 'signature'
/** Options the edit can make today. Clean and Creative get their own templates next. */
export const PRODUCT_AD_READY_OPTIONS: ProductAdOption[] = ['clean', 'creative', 'signature']
/** Clean has no reveal moment, so it skips the reveal still and its clip (~$1 less). */
export const needsReveal = (option: ProductAdOption) => option !== 'clean'

/**
 * The reveal look (owner 2026-11-03): the wet glass is lovely but would get repetitive, so each video gets
 * one of four looks, all made the same safe way (a still from the approved label shot, animated with the
 * first AND last frame locked so only the surroundings move). Tested on Allies of Skin: product locked in
 * every clip. The still key stays 'wetGlass' for the reveal still, whatever the look.
 */
export type RevealLook = 'wetGlass' | 'shadow' | 'silk' | 'water'
export const REVEAL_LOOKS: RevealLook[] = ['wetGlass', 'shadow', 'silk', 'water']
export const REVEAL_LOOK_LABELS: Record<RevealLook, string> = { wetGlass: 'Wet glass', shadow: 'Shadow play', silk: 'Silk', water: 'Water ripple' }

/**
 * Owner 2026-11-03, after seeing shadow/silk/water inside full Signature cuts: "they feel disconnected and
 * no purpose ... superfluous rather than meaningful"; the wet glass "has a strong visual impact". Until he
 * decides how to add variety, every video uses the wet glass. The other looks stay in code, unused.
 */
export const LIVE_REVEAL_LOOKS: RevealLook[] = ['wetGlass']
export function pickRevealLook(_last: RevealLook | null | undefined): RevealLook {
  return LIVE_REVEAL_LOOKS[0]!
}

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
  /** The reveal look for this video (still + locked clip). Older tasks: wet glass. */
  revealLook?: RevealLook
  /** The user's own product photos (storage paths). */
  photos: string[]
  stills: Partial<Record<ProductStillKey, string>>
  redosLeft: number
  /** Automatic product check per still (owner 2026-11-03: an eye-cream bottle came back as a jar). */
  checks?: Partial<Record<ProductStillKey, StillCheck>>
  /** Stills already remade once by the check (free, never counted against the user's redos). */
  autoRedone?: ProductStillKey[]
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

/**
 * Allies of Skin test (2026-11-03): with four products and no description, the texture shot showed four
 * swatches, one an invented brown, and a hand came into the spreading clip. Now: one texture (the lead
 * product's), its look from the user's words, and no people.
 */
const NO_PEOPLE = 'No hands, no fingers, no person, no packaging, no label, no text in frame.'
function textureLine(input: About): string {
  const whose = input.leadProduct?.trim() ? `the texture of ${input.leadProduct.trim()}` : 'the main product\'s own texture'
  const how = input.details.trim()
    ? `Show ${whose} exactly as the customer describes it (${input.details.trim()}); do not invent another color or texture.`
    : `Show ${whose} as it really looks for this kind of product, in a natural neutral color; do not invent bright or dark colors.`
  return how
}

type About = Pick<ProductAdTaskInput, 'productName' | 'details' | 'leadProduct' | 'revealLook'>
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
      // Owner 2026-11-04: a comb next to a skincare routine was "probably not ideal": the props came from
      // a fixed list (comb, towel, dish) written for the Being Frens body/hair products. Props must fit
      // how THIS product is used.
      return [a, 'Styled top-down flat lay: the product lying on soft linen with one or two simple, neutral styling props that belong to how this kind of product is actually used (for skincare: a folded cotton towel, a small ceramic dish or a smooth stone; for haircare: a comb or brush; for a candle: a matchbox). Never a prop from a different product category. Do not add fruit, flowers, leaves or ingredients unless they are named in the product description.', KEEP_PRODUCT, ONE_FRAME, STUDIO].join(' ')
    case 'texture':
      return [a, textureLine(input), 'Macro close-up of that ONE texture only: a single generous swirl or drop on a clean surface. One texture, one color, one swatch; no other swatches.', NO_PEOPLE, ONE_FRAME, STUDIO].join(' ')
    case 'apply':
      return [a, textureLine(input), 'Close-up of that ONE texture being spread across a clean pale surface by the tip of a small metal spatula entering from the edge of the frame, a smooth ribbon of texture. One texture only.', NO_PEOPLE, ONE_FRAME, STUDIO].join(' ')
    case 'wetGlass':
      return revealStillPrompt(input.revealLook ?? 'wetGlass')
  }
}

const KEEP_SCENE =
  'Keep the product exactly as in the reference image: same product, same position, size and framing, same label text, colors and cap. Do not change the product. Vertical 9:16 product photograph, photoreal, no added text.'

function revealStillPrompt(look: RevealLook): string {
  switch (look) {
    case 'wetGlass':
      return [
        'The exact same product, same position and framing as the reference image, photographed through a pane of glass placed right in front of the camera lens.',
        'The glass is covered in fine condensation with many beads of water and a few drops running down, the droplets in sharp focus on the glass. The glass is fogged enough that the product behind it is clearly soft and diffused: its shape, colors and large name read through, but small print on the label is not legible.',
        'Warm soft backlight, cream and amber tones, wet reflective surface under the product.',
        'Do not change the product, its shape, colors or label. Vertical 9:16 product photograph, no added text.',
        ONE_FRAME,
      ].join(' ')
    case 'shadow':
      return ['The exact same scene as the reference image, now lit by warm low sunlight through leaves: soft dappled shadows of leaves fall across the back wall, the surface and part of the product, with gentle contrast.', KEEP_SCENE, ONE_FRAME].join(' ')
    case 'silk':
      return ['The exact same scene as the reference image, with a sheer translucent cream silk fabric floating in the foreground, draped diagonally across the lower part of the frame and partly in front of the base of the product, catching the soft light. The label stays visible above the silk.', KEEP_SCENE, ONE_FRAME].join(' ')
    case 'water':
      return ['The same product as the reference image standing on a shallow, perfectly still water surface, its clear mirrored reflection in the water below it, soft warm studio light, minimal neutral background.', KEEP_SCENE, ONE_FRAME].join(' ')
  }
}

const STILL_REST = ' The product, its label, the camera and everything else stay completely still and unchanged. No camera movement, no zoom.'
export const REVEAL_MOTION: Record<RevealLook, string> = {
  wetGlass:
    'Locked-off static camera. Only the water on the glass in front of the lens moves: a few water droplets slowly run down the glass, leaving thin wet trails, tiny beads tremble. The product, its label, the light and the background stay completely still and unchanged. No camera movement, no zoom, nothing else moves.',
  shadow: 'Locked-off static camera. Only the leaf shadows move: the soft dappled shadows sway slowly across the wall, the surface and the product, as if a light breeze moves branches outside the window.' + STILL_REST,
  silk: 'Locked-off static camera. Only the sheer silk moves: it slowly drifts, ripples and floats in a gentle breeze in front of the base of the product, catching the light.' + STILL_REST,
  water: 'Locked-off static camera. Only the water moves: a few gentle ripples spread slowly across the water surface around the base of the product, softly distorting the reflection, then settle.' + STILL_REST,
}

/** Motion for the label-free texture clips (the reveal's motion is REVEAL_MOTION). */
export const MOTION_PROMPTS = {
  texture:
    'Locked-off camera, macro. The texture moves naturally at real-time speed: it slowly folds, drips and settles under its own weight, true to how this product really behaves. No hands, no fingers, no person, no packaging, no text, no camera movement, no new colors.',
  apply:
    'Locked-off camera, close-up. Only the tip of the metal spatula is in frame: it slowly spreads the texture across the surface in one smooth stroke, the texture behaving exactly as this product really does. No hand, no fingers, no person ever enters the frame. No packaging, no label, no text, no camera movement, no new colors.',
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

/**
 * Stills are made at 2K (1536x2752 PNG) for sharp label print; the edit is 1080x1920. Each still is fed
 * to ffmpeg many times (one input per shot), and at 2K the first real run (2026-11-03) ran the function
 * out of memory. Scale once to the output frame as a JPEG first.
 */
export async function toFrame(png: Buffer): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default
    return await sharp(png).resize(1080, 1920, { fit: 'cover' }).jpeg({ quality: 92 }).toBuffer()
  } catch {
    return png
  }
}

/** Fill the chosen option's edit template (Clean / Creative / Signature) with this product's stills and clips. */
export function templateShots(input: ProductAdTaskInput, stills: Partial<Record<ProductStillKey, Buffer>>, clips: { wetGlass?: Buffer; texture: Buffer; apply: Buffer }): ProductShot[] {
  const buf = new Map<string, Buffer>()
  const img = (k: ProductStillKey) => (stills[k] ? (buf.set(k, stills[k]!), { ref: k, kind: 'image' as const }) : undefined)
  buf.set('clip:texture', clips.texture).set('clip:apply', clips.apply)
  if (clips.wetGlass) buf.set('clip:wetGlass', clips.wetGlass)
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
    frost: clips.wetGlass ? { ref: 'clip:wetGlass', kind: 'video', duration: 3, baked: true, wetGlass: true } : undefined,
  }
  for (const k of Object.keys(assets) as Array<keyof typeof assets>) if (!assets[k]) delete assets[k]
  return planProductTemplate(input.option, assets).map(({ ref, kind, role: _role, ...rest }) => ({ ...rest, ...(kind === 'image' ? { image: buf.get(ref)! } : { video: buf.get(ref)! }) }))
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
  const reveal = needsReveal(input.option)
  const ids = [...(reveal ? [input.jobs?.wetGlass] : []), input.jobs?.texture, input.jobs?.apply]
  if (ids.some(id => !id)) {
    await failVideoTask(supabase, task.id, task.user_id)
    return { status: 'failed' }
  }
  const polls = await Promise.all(ids.map(id => pollVideoJobSafely(id!)))
  if (polls.some(p => !p)) return { status: 'rendering' }
  if (polls.some(p => p!.status === 'failed')) {
    await failVideoTask(supabase, task.id, task.user_id)
    return { status: 'failed' }
  }
  if (polls.some(p => p!.status !== 'completed')) return { status: 'rendering' }

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
      const src = p!.unsigned_urls?.[0]
      return src ? fetchBytes(src, openRouterHeaders()) : Promise.resolve(null)
    }))
    if (videos.some(v => !v)) throw new Error('could not download a rendered clip')
    const vids = videos as Buffer[]
    const wetGlass = reveal ? vids[0] : undefined
    const [texture, apply] = reveal ? vids.slice(1) : vids
    // Keep the raw clips so the edit can be redone (or another option cut) without new renders.
    await Promise.all(
      ((reveal ? ['wetGlass', 'texture', 'apply'] : ['texture', 'apply']) as Array<'wetGlass' | 'texture' | 'apply'>).map((k, i) =>
        supabase.storage.from(POST_ASSETS_BUCKET).upload(`${input.profileId}/product-raw-${task.id}-${k}.mp4`, (videos as Buffer[])[i]!, { contentType: 'video/mp4', upsert: true }),
      ),
    ).catch(() => {})
    const stills: Partial<Record<ProductStillKey, Buffer>> = {}
    await Promise.all(Object.entries(input.stills).map(async ([k, p]) => {
      const b = p ? await downloadPostAsset(p) : null
      if (b) stills[k as ProductStillKey] = await toFrame(b)
    }))
    if (!stills.hero) throw new Error('hero still missing')

    const out = await assembleProductCut({ shots: templateShots(input, stills, { wetGlass, texture: texture!, apply: apply! }) })

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
    const cost = stillsMade * USD.still + (reveal ? USD.kling3s1080 : 0) + 2 * USD.kling5s
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

const CHECK_LABEL_SHOT = `You are a strict packaging proofreader. You check AI-made product photos against the customer's real product photos before anyone pays to animate them.
The FIRST image(s) are the customer's real product photo(s). The LAST image is the AI-made still to check.

Work in this order and be strict:
1. For each product in the AI still, find the same product in the real photo(s).
2. Shape: container type (bottle / jar / tube / pump bottle / dropper), proportions (tall vs squat), cap/pump/lid shape and color, body color. Any change fails.
3. Text: for each product, transcribe every readable line of the label in the AI still EXACTLY as painted (OCR, never autocorrect), then transcribe the same lines from the real photo, and compare word by word. Numbers and percentages, ingredient names, step numbers and the brand name must match exactly. Fail on any wrong number, misspelled or invented word, doubled word, or a line that is missing. Also fail on an icon/logo taken from a different product.
4. Fail if a product is invented or duplicated, or if the still is a grid/collage of panels.
Only skip text that is physically hidden or blurred in the AI still by glass, water, fabric, shadow or depth of field, or that is not legible in the real photo either.

Return ONLY JSON: {"passed": true|false, "issues": ["short, specific problem a customer would understand, e.g. 'Firming treatment label says 12 Brighteners, real label says 13'"]}`

/**
 * Owner 2026-11-03 (option B): multi-product shots (group, angle, flat lay) are on screen for 1-5 frames
 * at phone size and almost always garble some secondary small print, so there the check stays strict on
 * shapes, invented/duplicated products and big text, but lets small print go. The label shot and the
 * reveal are proofread word for word.
 */
const CHECK_WIDE_SHOT = `You check an AI-made product photo (a wide shot with several products) against the customer's real product photos before anyone pays to animate it.
The FIRST image(s) are the customer's real product photo(s). The LAST image is the AI-made still.

Fail only on what a viewer would notice in a fast cut on a phone:
- a product with the wrong container type or shape (bottle vs jar vs tube vs pump; tall vs squat), wrong cap/pump/lid, or wrong body color
- an invented product, a duplicated product, or a product missing that the shot clearly needs
- the brand name or a product NAME (the big headline text on the label) misspelled, doubled or wrong
- a grid/collage of panels
Do NOT fail on small print (step lines, usage lines, ingredient lists, small numbers): ignore it entirely.

Return ONLY JSON: {"passed": true|false, "issues": ["short, specific problem a customer would understand"]}`

const CHECK_TEXTURE_SHOT = `You check an AI-made close-up of a skincare/product texture before it is animated.
Fail if any packaging, label, text, logo or a hand/person appears, or if the image is a grid/collage.
Return ONLY JSON: {"passed": true|false, "issues": ["short, specific problem"]}`

/**
 * Compare one still with the user's photos (vision model). Owner 2026-11-03: the stills invented a jar,
 * doubled "VITAMIN C" and made up small print; the user should not be the one who has to spot that.
 * Never blocks: on any error the still counts as unchecked (passed, no issues).
 */
/**
 * Load an image for the check at high resolution: at the default 1536px the 2K still's small print is
 * unreadable to the checker, so it passed a label that said "12 Brighteners + 3 Antioxidants" for
 * "13 + 9" (Allies of Skin, 2026-11-03).
 */
async function loadForCheck(path: string): Promise<{ dataUrl: string } | null> {
  const bytes = await downloadPostAsset(path)
  if (!bytes) return null
  const c = await compressImageForApiPayload(bytes, { maxDimension: 2752 })
  return { dataUrl: `data:${c.mime};base64,${c.bytes.toString('base64')}` }
}

export async function checkProductStill(input: Pick<ProductAdTaskInput, 'stills' | 'photos' | 'productName' | 'details'>, key: ProductStillKey): Promise<StillCheck> {
  const still = input.stills[key]
  if (!still) return { passed: true, issues: [] }
  try {
    const texture = key === 'texture' || key === 'apply'
    const refs = texture ? [] : input.photos.slice(0, 4)
    const loaded = await Promise.all([...refs, still].map(p => loadForCheck(p)))
    if (loaded.some(l => !l)) return { passed: true, issues: [] }
    const result = await generateText({
      model: openrouter(VISION_CAPTION_MODEL),
      messages: [{
        role: 'user',
        content: [
          ...loaded.map(l => ({ type: 'image' as const, image: new URL(l!.dataUrl) })),
          { type: 'text' as const, text: `${texture ? CHECK_TEXTURE_SHOT : key === 'hero' || key === 'wetGlass' ? CHECK_LABEL_SHOT : CHECK_WIDE_SHOT}\n\nWhat the customer said the product is: ${input.productName}${input.details ? ` (${input.details})` : ''}.` },
        ],
      }],
      maxOutputTokens: 1500,
      temperature: 0,
    })
    const m = result.text.match(/\{[\s\S]*\}/)
    const parsed = m ? (JSON.parse(m[0]) as Partial<StillCheck>) : null
    if (!parsed || typeof parsed.passed !== 'boolean') return { passed: true, issues: [] }
    return { passed: parsed.passed, issues: (parsed.issues ?? []).map(String).slice(0, 4) }
  } catch (err) {
    console.error('[product-ad] check failed', key, err instanceof Error ? err.message : err)
    return { passed: true, issues: [] }
  }
}
