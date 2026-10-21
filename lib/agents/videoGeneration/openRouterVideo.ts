import { openRouterHeaders } from '@/lib/agents/imageGeneration/openRouterImage'

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1'

export type VideoJobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type VideoJobSubmitResult = {
  id: string
  status: VideoJobStatus
}

export type VideoJobPollResult = {
  id: string
  status: VideoJobStatus
  unsigned_urls?: string[]
  error?: string
}

/** Submit async video generation job. Returns job_id immediately — does NOT wait for video. */
export async function submitVideoJob(opts: {
  model: string
  prompt: string
  aspectRatio?: string
  duration?: number
  /** Image URLs for visual guidance (character / product / place). Must be publicly fetchable (signed). */
  referenceUrls?: string[]
  /** Ask the model to generate audio (dialogue, ambience) where supported (Seedance). */
  generateAudio?: boolean
  resolution?: '480p' | '720p' | '1080p'
  /**
   * Provider passthrough, sent as provider.options (e.g. { heygen: { voice_id } } — Avatar IV needs a
   * voice when the prompt is a spoken script).
   */
  providerOptions?: Record<string, Record<string, unknown>>
}): Promise<VideoJobSubmitResult> {
  const body: Record<string, unknown> = {
    model: opts.model,
    prompt: opts.prompt,
    aspect_ratio: opts.aspectRatio ?? '9:16',
  }
  // duration 0 = let the model decide (Avatar IV: the length of the spoken script).
  if (opts.duration !== 0) body.duration = opts.duration ?? 8
  if (opts.providerOptions && Object.keys(opts.providerOptions).length) {
    body.provider = { options: opts.providerOptions }
  }
  if (opts.referenceUrls?.length) {
    body.input_references = opts.referenceUrls.map(url => ({ type: 'image_url', image_url: { url } }))
  }
  if (opts.generateAudio !== undefined) body.generate_audio = opts.generateAudio
  if (opts.resolution) body.resolution = opts.resolution

  const res = await fetch(`${OPENROUTER_API_BASE}/videos`, {
    method: 'POST',
    headers: openRouterHeaders(),
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`OpenRouter video submit ${res.status}: ${text.slice(0, 1500)}`)
  }

  const data = JSON.parse(text) as VideoJobSubmitResult
  if (!data.id) throw new Error('OpenRouter video submit returned no job id')
  return data
}

/** Poll job status (fallback when webhook doesn't fire within timeout). */
export async function pollVideoJob(jobId: string): Promise<VideoJobPollResult> {
  const res = await fetch(`${OPENROUTER_API_BASE}/videos/${jobId}`, {
    headers: openRouterHeaders(),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`OpenRouter video poll ${res.status}: ${text.slice(0, 200)}`)
  }

  return JSON.parse(text) as VideoJobPollResult
}
