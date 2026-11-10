'use client'

import { useEffect, useState } from 'react'
import { videoPollAdvance } from '@/lib/agents/videoGeneration/videoPollAdvance'

type Job = {
  taskId: string
  status: 'starting' | 'rendering' | 'editing' | 'completed' | 'failed'
  videoUrl?: string | null
}

/**
 * Ask for status every 12 seconds until the video is completed or failed.
 * The request that moves clips into the edit can run for minutes and can die
 * without a response (function time limit). A failed read must schedule another
 * read; stopping here leaves the task running with the credits spent.
 */
export function useVideoJobPoll(
  job: Job | null,
  setJob: (update: (current: Job | null) => Job | null) => void,
  statusUrl: string,
) {
  const [generation, setGeneration] = useState(0)
  useEffect(() => {
    if (!job || (job.status !== 'rendering' && job.status !== 'editing')) return
    const phase = job.status
    const taskId = job.taskId
    let cancelled = false
    const handle = setTimeout(async () => {
      let advance = videoPollAdvance(phase, { httpOk: false })
      let videoUrl: string | null | undefined
      try {
        const r = await fetch(`${statusUrl}?taskId=${encodeURIComponent(taskId)}`)
        const d = (await r.json().catch(() => ({}))) as { status?: string | null; videoUrl?: string | null }
        advance = videoPollAdvance(phase, { httpOk: r.ok, status: d.status })
        videoUrl = d.videoUrl
      } catch {
        advance = videoPollAdvance(phase, { httpOk: false })
      }
      if (cancelled) return
      if (advance.status !== phase) {
        setJob(current => (
          current && current.taskId === taskId
            ? { ...current, status: advance.status, videoUrl: videoUrl ?? current.videoUrl }
            : current
        ))
      }
      if (advance.keepPolling && advance.status === phase) setGeneration(n => n + 1)
    }, 12_000)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [job, generation, setJob, statusUrl])
}
