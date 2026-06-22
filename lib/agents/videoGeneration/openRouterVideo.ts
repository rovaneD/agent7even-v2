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
}): Promise<VideoJobSubmitResult> {
  const body = {
    model: opts.model,
    prompt: opts.prompt,
    aspect_ratio: opts.aspectRatio ?? '9:16',
    duration: opts.duration ?? 8,
  }

  const res = await fetch(`${OPENROUTER_API_BASE}/videos`, {
    method: 'POST',
    headers: openRouterHeaders(),
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`OpenRouter video submit ${res.status}: ${text.slice(0, 400)}`)
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
