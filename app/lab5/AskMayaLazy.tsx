'use client'

/**
 * BEFORE: AskMaya client bundle mounted as soon as the footer hydrated.
 * AFTER: On mobile, wait for first scroll/tap or a short idle timeout so the
 * chat widget JS stays off the critical path. Desktop mounts immediately.
 */

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const AskMaya = dynamic(() => import('./AskMaya'), { ssr: false })

export default function AskMayaLazy() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 720px)').matches
    if (!isMobile) {
      setReady(true)
      return
    }

    let done = false
    const enable = () => {
      if (done) return
      done = true
      setReady(true)
    }

    window.addEventListener('scroll', enable, { once: true, passive: true })
    window.addEventListener('pointerdown', enable, { once: true })
    const timer = window.setTimeout(enable, 4000)

    return () => {
      window.removeEventListener('scroll', enable)
      window.removeEventListener('pointerdown', enable)
      window.clearTimeout(timer)
    }
  }, [])

  if (!ready) return null
  return <AskMaya />
}
