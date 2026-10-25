'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const PENDING_URLS = ['/api/posts/video-create?pending=1', '/api/posts/video-broll?pending=1']

/**
 * Presenter and B-roll videos finish only when their status route is polled. The create panel
 * unmounts when it is closed (the screen tells the owner they can close it). This keeps polling
 * from any dashboard page so a charged video still gets edited and lands in Approvals.
 */
export default function ResumeVideoJobs() {
  const router = useRouter()
  const seenCompleted = useRef(new Set<string>())

  useEffect(() => {
    let stopped = false

    const tick = async () => {
      if (stopped) return
      const bodies = await Promise.all(
        PENDING_URLS.map(url =>
          fetch(url)
            .then(r => (r.ok ? r.json() : null))
            .catch(() => null),
        ),
      )
      if (stopped) return
      let completed = false
      for (const body of bodies) {
        const rows = (body as { results?: Array<{ taskId?: string; status?: string }> } | null)?.results
        for (const row of rows ?? []) {
          if (row.status !== 'completed' || !row.taskId || seenCompleted.current.has(row.taskId)) continue
          seenCompleted.current.add(row.taskId)
          completed = true
        }
      }
      if (completed) router.refresh()
    }

    void tick()
    const id = setInterval(() => { void tick() }, 12_000)
    return () => {
      stopped = true
      clearInterval(id)
    }
  }, [router])

  return null
}
