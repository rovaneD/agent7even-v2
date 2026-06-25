'use client'

import { useState } from 'react'
import Link from 'next/link'
import { sanitizeUserFacingError } from '@/lib/agents/sanitizeProviderError'
import { VIDEO_MODEL_OPTIONS, DEFAULT_VIDEO_MODEL_ID } from '@/lib/agents/videoGeneration/videoModelCatalog'
import { videoCreditCost } from '@/lib/credits/actionCosts'

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
  const [checking, setChecking] = useState(false)
  const [checkMsg, setCheckMsg] = useState<string | null>(null)

  async function handleCheckReady() {
    if (checking) return
    setChecking(true)
    setCheckMsg(null)
    try {
      const res  = await fetch('/api/posts/reconcile-video', { method: 'POST' })
      const data = await res.json().catch(() => ({})) as { processed?: number; still_running?: number }
      if ((data.processed ?? 0) > 0) {
        setCheckMsg('Your video is ready! Check the approval queue.')
      } else if ((data.still_running ?? 0) > 0) {
        setCheckMsg('Still generating — check back in a minute.')
      } else {
        setCheckMsg('No active video jobs found.')
      }
    } catch {
      setCheckMsg('Could not check status. Try again.')
    } finally {
      setChecking(false)
    }
  }

  async function handleGenerate() {
    if (disabled || state.phase === 'composing' || state.phase === 'pending') return
    setState({ phase: 'composing' })

    try {
      const res = await fetch('/api/posts/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postGoal:       postContext?.postGoal ?? '',
          platform:       postContext?.platform ?? '',
          offer:          postContext?.offer ?? '',
          audience:       postContext?.audience ?? '',
          mustInclude:    postContext?.mustInclude ?? '',
          mustAvoid:      postContext?.mustAvoid ?? '',
          sceneDirection: sceneDirection ?? '',
          videoModelId:   modelId,
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
          Using {state.model}. Usually 2–5 minutes.
        </p>
        <div className="mt-2 pl-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleCheckReady()}
            disabled={checking}
            className="text-xs font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700 disabled:opacity-50"
          >
            {checking ? 'Checking…' : 'Check if ready'}
          </button>
          <Link
            href="/dashboard/agents/approvals"
            className="text-xs text-blue-500 hover:text-blue-600"
          >
            Approval queue →
          </Link>
        </div>
        {checkMsg && (
          <p className="mt-1.5 pl-4 text-xs font-medium text-blue-800">{checkMsg}</p>
        )}
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
  const creditCost = videoCreditCost(modelId, undefined)
  const creditLabel =
    creditCost === -1
      ? 'ProAgent only'
      : `${creditCost} credit${creditCost === 1 ? '' : 's'}`

  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="mb-2 text-sm font-medium text-text-primary">Generate a short video</p>
      <p className="mb-3 text-xs text-text-sec">
        Maya writes a 9:16 video brief from your Foundation Creative Direction and generates a Reels/TikTok-ready clip in the background.{' '}
        {creditCost === -1
          ? 'Premium models require ProAgent.'
          : `${creditCost} credits are deducted when submitted.`}
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
          `Generate video (${creditLabel})`
        )}
      </button>
    </div>
  )
}
