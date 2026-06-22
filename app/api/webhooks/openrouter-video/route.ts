import { createHmac, timingSafeEqual } from 'crypto'
import { randomUUID } from 'crypto'
import { after, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logProviderError } from '@/lib/agents/sanitizeProviderError'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'

export const maxDuration = 60

type VideoWebhookPayload = {
  id?: string
  status?: string
  unsigned_urls?: string[]
  error?: string
}

/** JSON-minify so our HMAC matches Convoy's (it strips whitespace before signing). */
function minifyJson(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw)) } catch { return raw }
}

function hmacHex(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  try {
    if (a.length !== b.length) return false
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch { return false }
}

/**
 * Verify an OpenRouter/Convoy HMAC-SHA256 signature.
 *
 * Convoy sends one of two formats:
 *   Simple:   "<hex>"
 *   Advanced: "t=<ts>,v1=<hex>[,v0=<hex>]"  — signed over "<ts>,<minified-body>"
 *
 * In both cases Convoy signs the JSON-minified body, not the raw bytes.
 * We also fall back to the raw body in case OpenRouter skips minification.
 */
function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false

  const minified = minifyJson(body)

  // ── Advanced Convoy format: t=<ts>,v1=<hex> ───────────────────────────
  if (signature.startsWith('t=')) {
    const parts = signature.split(',')
    const tsPart = parts.find(p => p.startsWith('t='))
    if (!tsPart) return false
    const ts = tsPart.slice(2)
    const hashes = parts
      .filter(p => /^v\d+=/.test(p))
      .map(p => p.slice(p.indexOf('=') + 1))

    if (hashes.length === 0) return false

    // Signed payload is "<timestamp>,<minified-body>"
    const signedPayload = `${ts},${minified}`
    const expected = hmacHex(secret, signedPayload)

    return hashes.some(h => safeEqual(h, expected))
  }

  // ── Simple format: raw hex of (minified body) ──────────────────────────
  const expectedMin = hmacHex(secret, minified)
  if (safeEqual(signature, expectedMin)) return true

  // ── Fallback: raw body (in case OpenRouter doesn't minify) ─────────────
  const expectedRaw = hmacHex(secret, body)
  return safeEqual(signature, expectedRaw)
}

export async function POST(req: Request) {
  const secret = process.env.OPENROUTER_VIDEO_WEBHOOK_SECRET
  if (!secret) {
    console.error('[openrouter-video] OPENROUTER_VIDEO_WEBHOOK_SECRET not configured')
    return NextResponse.json({ ok: true })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('X-OpenRouter-Signature')

  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let payload: VideoWebhookPayload
  try {
    payload = JSON.parse(rawBody) as VideoWebhookPayload
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // Return 200 immediately — process asynchronously after response is sent
  after(async () => {
    await handleVideoWebhook(payload).catch(err => {
      logProviderError('openrouter-video webhook', err)
    })
  })

  return NextResponse.json({ ok: true })
}

async function handleVideoWebhook(payload: VideoWebhookPayload): Promise<void> {
  const jobId = payload.id
  if (!jobId) {
    console.error('[openrouter-video] Missing job id in webhook payload')
    return
  }

  const supabase = createServiceClient()

  // Find the agent_task with this job_id stored in input jsonb
  const { data: tasks, error: taskError } = await supabase
    .from('agent_tasks')
    .select('id, user_id, input')
    .eq('input->>video_job_id', jobId)
    .limit(1)

  if (taskError || !tasks || tasks.length === 0) {
    console.error('[openrouter-video] No task found for job_id:', jobId, taskError?.message)
    return
  }

  const task = tasks[0]!
  const taskId = task.id as string
  const userId = task.user_id as string
  const input = (task.input ?? {}) as Record<string, unknown>
  const profileId = input.profileId as string | undefined
  const videoModel = (input.video_model as string | undefined) ?? 'unknown'
  const briefExcerpt = (input.brief_excerpt as string | undefined) ?? ''

  if (!profileId) {
    console.error('[openrouter-video] Task missing profileId, task:', taskId)
    await supabase
      .from('agent_tasks')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', taskId)
    return
  }

  // Handle failed job
  if (payload.status === 'failed') {
    await supabase
      .from('agent_tasks')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', taskId)
    console.log('[openrouter-video] Job failed, task marked failed:', taskId)
    return
  }

  // Ignore non-terminal statuses (pending, processing)
  if (payload.status !== 'completed') {
    console.log('[openrouter-video] Intermediate status ignored:', payload.status, 'job:', jobId)
    return
  }

  const videoUrl = payload.unsigned_urls?.[0]
  if (!videoUrl) {
    console.error('[openrouter-video] No video URL in completed payload, task:', taskId)
    await supabase
      .from('agent_tasks')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', taskId)
    return
  }

  // Download video from OpenRouter
  let videoBytes: Buffer
  try {
    const dlRes = await fetch(videoUrl)
    if (!dlRes.ok) throw new Error(`Download failed: ${dlRes.status}`)
    videoBytes = Buffer.from(await dlRes.arrayBuffer())
  } catch (err) {
    logProviderError('openrouter-video download', err)
    await supabase
      .from('agent_tasks')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', taskId)
    return
  }

  // Ensure bucket allows video/mp4 (bucket was originally created for images only)
  await ensureBucketAllowsVideo(supabase)

  // Upload to post-assets bucket
  const storagePath = `${profileId}/${randomUUID()}.mp4`
  const { error: uploadError } = await supabase.storage
    .from(POST_ASSETS_BUCKET)
    .upload(storagePath, videoBytes, { contentType: 'video/mp4', upsert: false })

  if (uploadError) {
    console.error('[openrouter-video] Storage upload failed:', uploadError.message, 'task:', taskId)
    await supabase
      .from('agent_tasks')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', taskId)
    return
  }

  // Insert agent_outputs row as pending_approval — same shape as image generation
  const content = {
    raw: 'Generated video ready for review.',
    media_storage_path: storagePath,
    media_mime: 'video/mp4',
    generated: {
      model: videoModel,
      job_id: jobId,
      brief_excerpt: briefExcerpt,
      qa_passed: true,
    },
  }

  const { error: outputError } = await supabase.from('agent_outputs').insert({
    task_id:     taskId,
    user_id:     userId,
    agent:       'video_generation',
    output_type: 'social_post',
    title:       'Generated video',
    content,
    status:      'pending_approval',
  })

  if (outputError) {
    console.error('[openrouter-video] agent_outputs insert failed:', outputError.message, 'task:', taskId)
  }

  // Mark task completed
  await supabase
    .from('agent_tasks')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', taskId)

  console.log('[openrouter-video] Video ready, task:', taskId, 'path:', storagePath)
}

type SupabaseClient = ReturnType<typeof createServiceClient>

/** Update post-assets bucket to allow video/mp4 uploads (idempotent). */
async function ensureBucketAllowsVideo(supabase: SupabaseClient): Promise<void> {
  const { data: bucket } = await supabase.storage.getBucket(POST_ASSETS_BUCKET)
  const currentTypes = (bucket as { allowed_mime_types?: string[] | null } | null)?.allowed_mime_types
  if (Array.isArray(currentTypes) && currentTypes.includes('video/mp4')) return
  const updated = [...(currentTypes ?? []), 'video/mp4']
  const { error } = await supabase.storage.updateBucket(POST_ASSETS_BUCKET, {
    public: false,
    allowedMimeTypes: updated,
  })
  if (error) {
    console.error('[openrouter-video] Failed to update bucket MIME types:', error.message)
  }
}
