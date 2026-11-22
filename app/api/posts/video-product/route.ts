import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolvePostsWorkspace } from '@/lib/profiles/resolvePostsWorkspace'
import { hasPlatformAccess } from '@/lib/plans'
import { deductCredits } from '@/lib/credits'
import { ACTION_CREDIT_COST } from '@/lib/credits/actionCosts'
import { createPostAssetSignedUrl } from '@/lib/postAssets'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'
import { submitVideoJob } from '@/lib/agents/videoGeneration/openRouterVideo'
import { failVideoTask } from '@/lib/agents/videoGeneration/failVideoTask'
import { presenterVideoUrl } from '@/lib/agents/videoGeneration/presenterJob'
import {
  advanceProductAdTask,
  checkProductStill,
  CLIP_MODEL,
  makeStillFor,
  MOTION_PROMPTS,
  pickRevealLook,
  LIVE_REVEAL_LOOKS,
  REVEAL_MOTION,
  PRODUCT_AD_AGENT,
  PRODUCT_AD_READY_OPTIONS,
  needsReveal,
  PRODUCT_AD_REDOS,
  signedProductStills,
  stillKeysFor,
  type ProductAdOption,
  type ProductAdTaskInput,
  type ProductStillKey,
  type RevealLook,
} from '@/lib/agents/videoGeneration/productAdJob'
import {
  applyStillChecks,
  isReviewStillKey,
  mergeProductRedo,
  requestedStillKeys,
  reviewStillGuards,
} from '@/lib/agents/videoGeneration/productAdReview'

export const maxDuration = 300

const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_PHOTO_BYTES = 4 * 1024 * 1024 // the client downsizes phone photos first (request limit ~4.5 MB)

type Body = {
  action?: 'stills' | 'redo' | 'create' | 'check'
  taskId?: string
  option?: ProductAdOption
  productName?: string
  leadProduct?: string
  revealLook?: RevealLook | 'auto'
  details?: string
  photos?: string[]
  title?: string
  caption?: string
  which?: ProductStillKey
  /** check: which stills (default all). redo: auto = the check's one free remake. */
  keys?: ProductStillKey[]
  auto?: boolean
}

const clean = (s: unknown, max: number) => String(s ?? '').trim().slice(0, max)

type Db = ReturnType<typeof createServiceClient>

async function readReviewInput(supabase: Db, taskId: string): Promise<ProductAdTaskInput | null> {
  const { data, error } = await supabase.from('agent_tasks').select('input').eq('id', taskId).maybeSingle()
  if (error || !data?.input) return null
  return data.input as ProductAdTaskInput
}

/** Save a review-stage input only if those stills are still the ones we merged onto. */
async function commitReviewInput(supabase: Db, taskId: string, next: ProductAdTaskInput, basedOn: ProductAdTaskInput['stills']): Promise<boolean> {
  let update = supabase
    .from('agent_tasks')
    .update({ input: next })
    .eq('id', taskId)
    .eq('status', 'running')
    .eq('input->>stage', 'review')
  for (const [key, path] of reviewStillGuards(basedOn)) {
    update = update.eq(`input->stills->>${key}`, path)
  }
  const { data, error } = await update.select('id')
  return !error && (data?.length ?? 0) > 0
}

/**
 * Product ad (no person), in two paid steps so nobody pays to animate a still with a wrong label:
 *  - multipart POST with `file` (free): upload one product photo; returns its storage path
 *  - action 'stills' (product_ad_stills): Maya's stills from the user's photos, to review
 *  - action 'redo' (free, up to 3 per video): remake one still
 *  - action 'create' (product_ad_<option>): animate the label-free stills + the wet glass; GET edits
 * Any failure refunds everything the task was charged.
 */
export async function POST(req: Request) {
  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { workspaceId, profile } = ws
  if (!hasPlatformAccess(profile.plan, profile.status, profile.billing_exempt ?? false)) {
    return NextResponse.json({ error: 'active_plan_required', message: 'Video needs an active plan.' }, { status: 403 })
  }

  if ((req.headers.get('content-type') ?? '').startsWith('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'file_required' }, { status: 400 })
    if (!PHOTO_TYPES.has(file.type)) return NextResponse.json({ error: 'unsupported_type', message: 'Use a JPG, PNG or WebP photo.' }, { status: 400 })
    if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: 'too_big', message: 'That photo is too large (4 MB max).' }, { status: 413 })
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${workspaceId}/product-photo-${randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(POST_ASSETS_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
    if (error) return NextResponse.json({ error: 'upload_failed', message: 'The photo could not be uploaded.' }, { status: 500 })
    return NextResponse.json({ path, url: await createPostAssetSignedUrl(path, 60 * 60 * 6) })
  }

  const body = (await req.json().catch(() => ({}))) as Body

  if (body.action === 'redo' || body.action === 'create' || body.action === 'check') {
    const { data: task } = await supabase
      .from('agent_tasks')
      .select('id,user_id,status,input,action_type')
      .eq('id', body.taskId ?? '')
      .eq('user_id', workspaceId)
      .eq('agent', PRODUCT_AD_AGENT)
      .maybeSingle()
    if (!task || task.status !== 'running') return NextResponse.json({ error: 'not_found', message: 'This video is no longer open. Make the stills again.' }, { status: 404 })
    const input = task.input as ProductAdTaskInput
    if (input.stage !== 'review') return NextResponse.json({ error: 'wrong_stage', message: 'This video is already being made.' }, { status: 409 })

    if (body.action === 'check') {
      // Free. Runs in its own request so the stills request stays well under the ~100s gateway limit.
      // The verdict is for the stills we just read. A remake that lands while the vision call runs
      // must keep its new picture, and a task that has started filming must not be rewound.
      const keys = requestedStillKeys(body.keys, input.stills)
      const results = await Promise.all(keys.map(k => checkProductStill(input, k)))
      for (let attempt = 0; attempt < 2; attempt++) {
        const cur = await readReviewInput(supabase, task.id)
        if (!cur) return NextResponse.json({ error: 'not_found', message: 'This video is no longer open. Make the stills again.' }, { status: 404 })
        const applied = applyStillChecks(input, cur, keys, results)
        if (!applied) return NextResponse.json({ error: 'wrong_stage', message: 'This video is already being made.' }, { status: 409 })
        if (await commitReviewInput(supabase, task.id, applied.input, cur.stills)) {
          return NextResponse.json({ taskId: task.id, checks: applied.checks, autoRedone: cur.autoRedone ?? [] })
        }
      }
      const cur = await readReviewInput(supabase, task.id)
      return NextResponse.json({
        error: 'still_changed',
        message: 'Those stills changed while they were being checked.',
        ...(cur ? { checks: cur.checks ?? {}, autoRedone: cur.autoRedone ?? [], stills: await signedProductStills(cur.stills), redosLeft: cur.redosLeft } : {}),
      }, { status: 409 })
    }

    if (body.action === 'redo') {
      const key = body.which
      if (!isReviewStillKey(key) || !input.stills[key]) return NextResponse.json({ error: 'bad_still' }, { status: 400 })
      const auto = body.auto === true
      if (auto && (input.autoRedone ?? []).includes(key)) return NextResponse.json({ error: 'already_redone' }, { status: 429 })
      if (!auto && input.redosLeft <= 0) return NextResponse.json({ error: 'no_redos', message: 'No redos left for this video.' }, { status: 429 })
      try {
        const madeStill = await makeStillFor(supabase, input, key)
        // The wet glass is made from the label shot: remake it too when the label shot changes.
        const madeWet = key === 'hero' && input.stills.wetGlass
          ? await makeStillFor(supabase, { ...input, stills: { ...input.stills, hero: madeStill } }, 'wetGlass')
          : undefined
        for (let attempt = 0; attempt < 2; attempt++) {
          const cur = await readReviewInput(supabase, task.id)
          if (!cur) return NextResponse.json({ error: 'not_found', message: 'This video is no longer open. Make the stills again.' }, { status: 404 })
          const merged = mergeProductRedo(input, cur, key, { still: madeStill, wetGlass: madeWet }, auto)
          if (!merged.ok) {
            if (merged.reason === 'no_redos') return NextResponse.json({ error: 'no_redos', message: 'No redos left for this video.', redosLeft: cur.redosLeft }, { status: 429 })
            if (merged.reason === 'already_redone') return NextResponse.json({ error: 'already_redone', redosLeft: cur.redosLeft, autoRedone: cur.autoRedone ?? [] }, { status: 429 })
            if (merged.reason === 'wrong_stage') return NextResponse.json({ error: 'wrong_stage', message: 'This video is already being made.' }, { status: 409 })
            return NextResponse.json({
              error: 'still_changed',
              message: 'That still was already updated.',
              stills: await signedProductStills(cur.stills),
              redosLeft: cur.redosLeft,
              checks: cur.checks ?? {},
              autoRedone: cur.autoRedone ?? [],
            }, { status: 409 })
          }
          if (await commitReviewInput(supabase, task.id, merged.input, cur.stills)) {
            return NextResponse.json({
              taskId: task.id,
              stills: await signedProductStills(merged.input.stills),
              redosLeft: merged.input.redosLeft,
              checks: merged.input.checks,
              autoRedone: merged.input.autoRedone ?? [],
            })
          }
        }
        const cur = await readReviewInput(supabase, task.id)
        return NextResponse.json({
          error: 'still_changed',
          message: 'That still was already updated.',
          ...(cur ? { stills: await signedProductStills(cur.stills), redosLeft: cur.redosLeft, checks: cur.checks ?? {}, autoRedone: cur.autoRedone ?? [] } : {}),
        }, { status: 409 })
      } catch (err) {
        console.error('[video-product] redo failed', err instanceof Error ? err.message : err)
        return NextResponse.json({ error: 'redo_failed', message: 'That still could not be remade. Try again.' }, { status: 502 })
      }
    }

    // create
    const actionType = `product_ad_${input.option}` as const
    const cost = ACTION_CREDIT_COST[actionType as keyof typeof ACTION_CREDIT_COST]
    if (cost == null) return NextResponse.json({ error: 'option_not_ready' }, { status: 422 })
    try {
      await deductCredits(workspaceId, cost, `Video — Product ad (${input.option})`, task.id)
    } catch (err) {
      const insufficient = err instanceof Error && err.message === 'INSUFFICIENT_CREDITS'
      return NextResponse.json(
        { error: insufficient ? 'insufficient_credits' : 'charge_failed', message: insufficient ? `Making the video uses ${cost} credits.` : 'Could not start the video. Nothing was charged.' },
        { status: insufficient ? 402 : 500 },
      )
    }
    const caption = body.caption !== undefined ? clean(body.caption, 2200) : input.caption
    try {
      const reveal = needsReveal(input.option)
      const [wetUrl, textureUrl, applyUrl] = await Promise.all(
        [input.stills.wetGlass, input.stills.texture, input.stills.apply].map(p => (p ? createPostAssetSignedUrl(p, 60 * 60 * 6) : Promise.resolve(null))),
      )
      if ((reveal && !wetUrl) || !textureUrl || !applyUrl) throw new Error('could not sign the stills')
      const [wetGlass, texture, apply] = await Promise.all([
        // First AND last frame locked to the approved still: only the surroundings can move.
        reveal
          ? submitVideoJob({ model: CLIP_MODEL, prompt: REVEAL_MOTION[input.revealLook ?? 'wetGlass'], aspectRatio: '9:16', duration: 3, resolution: '1080p', firstFrameUrl: wetUrl!, lastFrameUrl: wetUrl!, generateAudio: false })
          : Promise.resolve(null),
        submitVideoJob({ model: CLIP_MODEL, prompt: MOTION_PROMPTS.texture, aspectRatio: '9:16', duration: 5, resolution: '1080p', referenceUrls: [textureUrl], generateAudio: false }),
        submitVideoJob({ model: CLIP_MODEL, prompt: MOTION_PROMPTS.apply, aspectRatio: '9:16', duration: 5, resolution: '1080p', referenceUrls: [applyUrl], generateAudio: false }),
      ])
      await supabase
        .from('agent_tasks')
        .update({ action_type: actionType, input: { ...input, caption, stage: 'rendering', jobs: { ...(wetGlass ? { wetGlass: wetGlass.id } : {}), texture: texture.id, apply: apply.id } } })
        .eq('id', task.id)
      return NextResponse.json({ taskId: task.id, status: 'rendering', credits: cost })
    } catch (err) {
      console.error('[video-product] create failed', task.id, err instanceof Error ? err.message : err)
      await failVideoTask(supabase, task.id, workspaceId)
      return NextResponse.json({ error: 'start_failed', message: 'The video could not be started. Your credits were refunded.' }, { status: 502 })
    }
  }

  // action: 'stills'
  const option: ProductAdOption = body.option === 'clean' || body.option === 'creative' ? body.option : 'signature'
  if (!PRODUCT_AD_READY_OPTIONS.includes(option)) {
    return NextResponse.json({ error: 'option_not_ready', message: `${option[0]!.toUpperCase()}${option.slice(1)} is coming soon. Try Signature.` }, { status: 422 })
  }
  const photos = (body.photos ?? []).filter(p => typeof p === 'string' && p.startsWith(`${workspaceId}/product-photo-`)).slice(0, 4)
  if (!photos.length) return NextResponse.json({ error: 'photos_required', message: 'Add at least one photo of your product.' }, { status: 422 })
  const productName = clean(body.productName, 120)
  if (!productName) return NextResponse.json({ error: 'name_required', message: 'Say what the product is.' }, { status: 422 })

  const cost = ACTION_CREDIT_COST.product_ad_stills
  const total = cost + ACTION_CREDIT_COST[`product_ad_${option}` as 'product_ad_signature']
  const { data: bal } = await supabase.from('credit_balances').select('balance').eq('user_id', workspaceId).maybeSingle()
  if (Number(bal?.balance ?? 0) < total) {
    return NextResponse.json({ error: 'insufficient_credits', message: `This video uses ${total} credits in total and your balance is ${Number(bal?.balance ?? 0)}.` }, { status: 402 })
  }

  // Reveal look: the user's pick, or rotate so nobody gets the same look twice in a row.
  let revealLook: RevealLook
  if (body.revealLook && body.revealLook !== 'auto' && LIVE_REVEAL_LOOKS.includes(body.revealLook)) revealLook = body.revealLook
  else {
    const { data: last } = await supabase
      .from('agent_tasks')
      .select('input')
      .eq('user_id', workspaceId)
      .eq('agent', PRODUCT_AD_AGENT)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    revealLook = pickRevealLook(((last?.input as ProductAdTaskInput | null)?.revealLook) ?? 'wetGlass')
  }

  const input: ProductAdTaskInput = {
    profileId: workspaceId,
    typeId: 'product_ad',
    option,
    productName,
    details: clean(body.details, 400),
    leadProduct: clean(body.leadProduct, 120) || undefined,
    revealLook,
    photos,
    stills: {},
    redosLeft: PRODUCT_AD_REDOS,
    stage: 'stills',
    title: clean(body.title, 80) || `${productName} — product ad`,
    caption: clean(body.caption, 2200),
  }
  const { data: task, error: taskErr } = await supabase
    .from('agent_tasks')
    .insert({
      user_id: workspaceId,
      agent: PRODUCT_AD_AGENT,
      job_type: 'video_product_ad',
      action_type: 'product_ad_stills',
      model: CLIP_MODEL,
      input,
      status: 'running',
      started_at: new Date().toISOString(),
      trigger_type: 'user',
      priority: 'normal',
      requires_approval: true,
    })
    .select('id')
    .single()
  if (taskErr || !task) return NextResponse.json({ error: 'task_create_failed', message: 'Could not start. Nothing was charged.' }, { status: 500 })
  const taskId = task.id as string
  try {
    await deductCredits(workspaceId, cost, 'Video — Product ad stills', taskId)
  } catch (err) {
    await supabase.from('agent_tasks').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', taskId)
    const insufficient = err instanceof Error && err.message === 'INSUFFICIENT_CREDITS'
    return NextResponse.json({ error: insufficient ? 'insufficient_credits' : 'charge_failed', message: 'Could not start. Nothing was charged.' }, { status: insufficient ? 402 : 500 })
  }
  try {
    const keys = stillKeysFor(photos.length, !!input.leadProduct).filter(k => k !== 'wetGlass')
    const made = await Promise.all(keys.map(k => makeStillFor(supabase, input, k)))
    const next: ProductAdTaskInput = { ...input, stills: Object.fromEntries(keys.map((k, i) => [k, made[i]!])) }
    // The wet glass is made from the hero still so the product and framing match exactly.
    if (needsReveal(option)) next.stills.wetGlass = await makeStillFor(supabase, next, 'wetGlass')
    next.stage = 'review'
    await supabase.from('agent_tasks').update({ input: next }).eq('id', taskId)
    return NextResponse.json({ taskId, stills: await signedProductStills(next.stills), revealLook, redosLeft: PRODUCT_AD_REDOS, credits: cost })
  } catch (err) {
    console.error('[video-product] stills failed', taskId, err instanceof Error ? err.message : err)
    await failVideoTask(supabase, taskId, workspaceId)
    return NextResponse.json({ error: 'stills_failed', message: 'The stills could not be made. Your credits were refunded.' }, { status: 502 })
  }
}

/** ?taskId= → status (moves it forward). ?pending=1 → finish this workspace's product ads in progress. */
export async function GET(req: Request) {
  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const params = new URL(req.url).searchParams
  if (params.get('pending')) {
    const { data: tasks } = await supabase
      .from('agent_tasks')
      .select('id,user_id,status,input,action_type')
      .eq('user_id', ws.workspaceId)
      .eq('agent', PRODUCT_AD_AGENT)
      .eq('status', 'running')
      .in('input->>stage', ['rendering', 'editing'])
      .limit(5)
    const results = []
    for (const t of tasks ?? []) results.push({ taskId: t.id, ...(await advanceProductAdTask(supabase, t as never)) })
    return NextResponse.json({ results })
  }
  const taskId = params.get('taskId')
  if (!taskId) return NextResponse.json({ error: 'taskId_required' }, { status: 400 })
  const { data: task } = await supabase
    .from('agent_tasks')
    .select('id,user_id,status,input,action_type')
    .eq('id', taskId)
    .eq('user_id', ws.workspaceId)
    .eq('agent', PRODUCT_AD_AGENT)
    .maybeSingle()
  if (!task) return NextResponse.json({ status: 'unknown' }, { status: 404 })
  const r = await advanceProductAdTask(supabase, task as never)
  return NextResponse.json({ ...r, videoUrl: r.status === 'completed' ? await presenterVideoUrl(supabase, taskId) : null })
}
