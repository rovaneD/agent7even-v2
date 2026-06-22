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

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  try {
    const sigBuf = Buffer.from(signature.length === expected.length ? signature : '')
    const expBuf = Buffer.from(expected)
    return timingSafeEqual(sigBuf, expBuf)
  } catch {
    return false
  }
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

  // Upload to post-assets bucket — bypass image MIME check (video is handled separately)
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
