'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { sanitizeUserFacingError } from '@/lib/agents/sanitizeProviderError'

export type VideoGenerateState =
  | { phase: 'idle' }
  | { phase: 'composing' }
  | { phase: 'pending'; jobId: string; taskId: string; model: string; headline?: string; idea?: string }
  | { phase: 'ready'; videoUrl: string | null; model: string; headline?: string; idea?: string }
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
  const [skills, setSkills]     = useState<VideoSkillCard[]>([])
  const [skillId, setSkillId]   = useState<string>('')
  const [checking, setChecking] = useState(false)
  const [checkMsg, setCheckMsg] = useState<string | null>(null)

  useEffect(() => {
    let off = false
    fetch('/api/posts/video-skills')
      .then(r => r.json())
      .then((d: { skills?: VideoSkillCard[] }) => {
        if (off || !d.skills?.length) return
        setSkills(d.skills)
        setSkillId(cur => cur || d.skills![0]!.id)
      })
      .catch(() => {})
    return () => { off = true }
  }, [])

  // Poll the job so the finished video shows here instead of an endless spinner.
  const pendingTaskId = state.phase === 'pending' ? state.taskId : null
  const pendingModel = state.phase === 'pending' ? state.model : ''
  const pendingHeadline = state.phase === 'pending' ? state.headline : undefined
  const pendingIdea = state.phase === 'pending' ? state.idea : undefined
  useEffect(() => {
    if (!pendingTaskId) return
    let stopped = false
    const tick = async () => {
      try {
        const res = await fetch(`/api/posts/video-status?taskId=${encodeURIComponent(pendingTaskId)}`)
        const data = await res.json().catch(() => ({})) as { status?: string; videoUrl?: string | null }
        if (stopped) return
        if (data.status === 'completed') {
          setState({ phase: 'ready', videoUrl: data.videoUrl ?? null, model: pendingModel, headline: pendingHeadline, idea: pendingIdea })
        } else if (data.status === 'failed') {
          setState({ phase: 'error', message: 'The video model could not finish this clip. You were not charged — try again.' })
        }
      } catch { /* keep polling */ }
    }
    void tick()
    const id = setInterval(() => void tick(), 10_000)
    return () => { stopped = true; clearInterval(id) }
  }, [pendingTaskId, pendingModel, pendingHeadline, pendingIdea])

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
          topic:          postContext?.topic ?? '',
          postGoal:       postContext?.postGoal ?? '',
          platform:       postContext?.platform ?? '',
          offer:          postContext?.offer ?? '',
          audience:       postContext?.audience ?? '',
          mustInclude:    postContext?.mustInclude ?? '',
          mustAvoid:      postContext?.mustAvoid ?? '',
          sceneDirection: sceneDirection ?? '',
          skillId:        skillId || undefined,
        }),
      })

      const data = await res.json().catch(() => ({})) as {
        jobId?: string; taskId?: string; model?: string; headline?: string; idea?: string
        error?: string; message?: string
      }

      if (!res.ok || !data.jobId) {
        setState({ phase: 'error', message: sanitizeUserFacingError(data.message ?? data.error, 'video_generation') })
        return
      }

      const result = { jobId: data.jobId, taskId: data.taskId ?? '', model: data.model ?? '' }
      setState({ phase: 'pending', ...result, headline: data.headline, idea: data.idea })
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
        {state.idea && <p className="mt-1.5 pl-4 text-xs text-blue-800">Idea: {state.idea}</p>}
        {state.headline && <p className="mt-0.5 pl-4 text-xs font-medium text-blue-900">Headline: “{state.headline}”</p>}
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

  if (state.phase === 'ready') {
    return (
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
        <p className="text-sm font-medium text-emerald-900">Your video is ready</p>
        {state.headline && <p className="mt-1 text-xs font-medium text-emerald-900">Headline: “{state.headline}”</p>}
        {state.idea && <p className="mt-0.5 text-xs text-emerald-800">{state.idea}</p>}
        {state.videoUrl && (
          <video
            src={state.videoUrl}
            controls
            playsInline
            className="mt-2 aspect-[9/16] w-full max-w-[260px] rounded-lg bg-black object-cover"
          />
        )}
        <div className="mt-2 flex items-center gap-3">
          <Link href="/dashboard/agents/approvals" className="text-xs font-medium text-emerald-700 underline underline-offset-2">
            Review in Approvals →
          </Link>
          <button
            type="button"
            onClick={() => setState({ phase: 'idle' })}
            className="text-xs text-emerald-700 hover:text-emerald-800"
          >
            Make another
          </button>
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
  const selected = skills.find(sk => sk.id === skillId)
  const creditCost = selected?.credits ?? 10
  const creditLabel = `${creditCost} credit${creditCost === 1 ? '' : 's'}`

  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="mb-2 text-sm font-medium text-text-primary">Generate a short video</p>
      <p className="mb-3 text-xs text-text-sec">
        Pick a style. Maya comes up with an idea for this post and makes a vertical clip for Reels and TikTok. {creditCost} credits are deducted when it starts; failed videos are refunded.
      </p>

      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        {skills.map(sk => (
          <button
            key={sk.id}
            type="button"
            onClick={() => setSkillId(sk.id)}
            disabled={isLoading}
            aria-pressed={sk.id === skillId}
            className={`rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-50 ${sk.id === skillId ? 'border-brand-primary bg-white ring-1 ring-brand-primary' : 'border-border bg-white hover:border-text-sec'}`}
          >
            {sk.examples.length > 0 && (
              <div className="mb-2 flex gap-1">
                {sk.examples.slice(0, 3).map(src => (
                  <video key={src} src={src} muted playsInline loop autoPlay className="aspect-[9/16] w-1/3 rounded bg-black object-cover" />
                ))}
              </div>
            )}
            <span className="block text-xs font-semibold text-text-primary">{sk.name}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-text-sec">{sk.tagline}</span>
            <span className="mt-1 block text-[11px] text-text-sec">{sk.seconds}s · {sk.credits} credits</span>
          </button>
        ))}
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
            Coming up with the idea…
          </>
        ) : (
          `Generate video (${creditLabel})`
        )}
      </button>
    </div>
  )
}

type VideoSkillCard = {
  id: string
  name: string
  tagline: string
  credits: number
  premium: boolean
  seconds: number
  examples: string[]
}
