'use client'

import { useState } from 'react'
import Link from 'next/link'
import { sanitizeUserFacingError } from '@/lib/agents/sanitizeProviderError'
import { VIDEO_MODEL_OPTIONS, DEFAULT_VIDEO_MODEL_ID } from '@/lib/agents/videoGeneration/videoModelCatalog'

export type VideoGenerateState =
  | { phase: 'idle' }
  | { phase: 'composing' }
  | { phase: 'pending'; jobId: string; taskId: string; model: string }
  | { phase: 'error'; message: string }

interface PostVideoGenerateProps {
  disabled?: boolean
  postContext?: Record<string, string>
  sceneDirection?: string
  initialPending?: { jobId: string; taskId: string; model: string }
  onJobStarted?: (opts: { jobId: string; taskId: string; model: string }) => void
}

export default function PostVideoGenerate({
  disabled = false,
  postContext,
  sceneDirection,
  initialPending,
  onJobStarted,
}: PostVideoGenerateProps) {
  const [state, setState]       = useState<VideoGenerateState>(
    initialPending
      ? { phase: 'pending', ...initialPending }
      : { phase: 'idle' },
  )
  const [modelId, setModelId]   = useState<string>(DEFAULT_VIDEO_MODEL_ID)

  async function handleGenerate() {
    if (disabled || state.phase === 'composing' || state.phase === 'pending') return
    setState({ phase: 'composing' })

    try {
      const res = await fetch('/api/posts/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postGoal:      postContext?.postGoal ?? '',
          platform:      postContext?.platform ?? '',
          offer:         postContext?.offer ?? '',
          audience:      postContext?.audience ?? '',
          sceneDirection: sceneDirection ?? '',
          videoModelId:  modelId,
        }),
      })

      const data = await res.json().catch(() => ({})) as {
        jobId?: string; taskId?: string; model?: string
        error?: string; message?: string
      }

      if (!res.ok || !data.jobId) {
        setState({ phase: 'error', message: sanitizeUserFacingError(data.message ?? data.error, 'video_generation') })
        return
      }

      const result = { jobId: data.jobId, taskId: data.taskId ?? '', model: data.model ?? '' }
      setState({ phase: 'pending', ...result })
      onJobStarted?.(result)
    } catch {
      setState({ phase: 'error', message: 'We couldn\'t start your video right now. Please try again in a few minutes.' })
    }
  }

  if (state.phase === 'pending') {
    return (
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          <p className="text-sm font-medium text-blue-900">Generating your video…</p>
        </div>
        <p className="mt-1 pl-4 text-xs text-blue-700">
          Using {state.model}. This usually takes 2–5 minutes.
        </p>
        <div className="mt-2 pl-4">
          <Link
            href="/dashboard/agents/approvals"
            className="text-xs font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700"
          >
            Check approval queue →
          </Link>
        </div>
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-sm text-red-700">{state.message}</p>
        <button
          type="button"
          onClick={() => setState({ phase: 'idle' })}
          className="mt-1.5 text-xs font-medium text-red-600 underline hover:text-red-700"
        >
          Try again
        </button>
      </div>
    )
  }

  const isLoading = state.phase === 'composing'
  const noGoal    = !postContext?.postGoal?.trim()

  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="mb-2 text-sm font-medium text-text-primary">Generate a short video</p>
      <p className="mb-3 text-xs text-text-sec">
        Maya writes a 9:16 video brief from your Foundation profile and generates a Reels/TikTok-ready clip in the background. 40 credits are deducted when submitted.
      </p>

      {/* Model selector */}
      <div className="mb-3">
        <label htmlFor="video-model-select" className="mb-1 block text-xs font-medium text-text-sec">
          Model
        </label>
        <select
          id="video-model-select"
          value={modelId}
          onChange={e => setModelId(e.target.value)}
          disabled={isLoading}
          className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
        >
          {VIDEO_MODEL_OPTIONS.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>

      {noGoal && (
        <p className="mb-2 text-xs text-amber-600">Set a post goal above before generating a video.</p>
      )}

      <button
        type="button"
        onClick={() => void handleGenerate()}
        disabled={disabled || isLoading || noGoal}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Composing brief…
          </>
        ) : (
          'Generate video (40 credits)'
        )}
      </button>
    </div>
  )
}
