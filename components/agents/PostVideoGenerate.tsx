'use client'

import { useState } from 'react'
import { sanitizeUserFacingError } from '@/lib/agents/sanitizeProviderError'

export type VideoGenerateState =
  | { phase: 'idle' }
  | { phase: 'composing' }
  | { phase: 'pending'; jobId: string; taskId: string; model: string }
  | { phase: 'error'; message: string }

interface PostVideoGenerateProps {
  disabled?: boolean
  postContext?: Record<string, string>
  sceneDirection?: string
  onJobStarted?: (opts: { jobId: string; taskId: string; model: string }) => void
}

export default function PostVideoGenerate({
  disabled = false,
  postContext,
  sceneDirection,
  onJobStarted,
}: PostVideoGenerateProps) {
  const [state, setState] = useState<VideoGenerateState>({ phase: 'idle' })

  async function handleGenerate() {
    if (disabled || state.phase === 'composing' || state.phase === 'pending') return

    setState({ phase: 'composing' })

    try {
      const res = await fetch('/api/posts/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postGoal: postContext?.postGoal ?? '',
          platform: postContext?.platform ?? '',
          offer: postContext?.offer ?? '',
          audience: postContext?.audience ?? '',
          sceneDirection: sceneDirection ?? '',
        }),
      })

      const data = await res.json().catch(() => ({})) as {
        jobId?: string
        taskId?: string
        model?: string
        error?: string
        message?: string
      }

      if (!res.ok || !data.jobId) {
        const msg = sanitizeUserFacingError(data.message ?? data.error, 'video_generation')
        setState({ phase: 'error', message: msg })
        return
      }

      const result = { jobId: data.jobId, taskId: data.taskId ?? '', model: data.model ?? '' }
      setState({ phase: 'pending', ...result })
      onJobStarted?.(result)
    } catch {
      setState({
        phase: 'error',
        message: 'We couldn\'t start your video right now. Please try again in a few minutes.',
      })
    }
  }

  function handleDismissError() {
    setState({ phase: 'idle' })
  }

  if (state.phase === 'pending') {
    return (
      <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-primary" />
          <p className="text-sm font-medium text-text-primary">Generating your video…</p>
        </div>
        <p className="mt-1 pl-4 text-xs text-text-sec">
          This usually takes 2–5 minutes. We'll show it in your approval queue when it's ready — you can close this tab.
        </p>
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-sm text-red-700">{state.message}</p>
        <button
          type="button"
          onClick={handleDismissError}
          className="mt-1.5 text-xs font-medium text-red-600 underline hover:text-red-700"
        >
          Try again
        </button>
      </div>
    )
  }

  const isLoading = state.phase === 'composing'
  const noGoal = !postContext?.postGoal?.trim()

  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="mb-2 text-sm font-medium text-text-primary">Generate a short video</p>
      <p className="mb-3 text-xs text-text-sec">
        Maya will write a 9:16 video brief from your Foundation profile and create a short Reels/TikTok-ready clip.
        Your credits will be deducted when you submit — the video generates in the background.
      </p>
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
