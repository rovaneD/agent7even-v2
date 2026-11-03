'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Product ads finish only when GET /api/posts/video-product is polled. The create panel unmounts
 * when it is closed (the screen tells the owner they can close it). This keeps polling from any
 * dashboard page so a charged video still gets edited and lands in Approvals.
 */
export default function ResumeProductAdJobs() {
  const router = useRouter()
  const seenCompleted = useRef(new Set<string>())

  useEffect(() => {
    let stopped = false

    const tick = async () => {
      if (stopped) return
      const body = await fetch('/api/posts/video-product?pending=1')
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null)
      if (stopped || !body) return
      let completed = false
      const rows = (body as { results?: Array<{ taskId?: string; status?: string }> }).results
      for (const row of rows ?? []) {
        if (row.status !== 'completed' || !row.taskId || seenCompleted.current.has(row.taskId)) continue
        seenCompleted.current.add(row.taskId)
        completed = true
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
