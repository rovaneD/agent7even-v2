'use client'

/**
 * BEFORE: WebGL shader (or even a React gradient fallback) hydrated in the hero
 * on mobile and competed with LCP.
 * AFTER: Mobile uses pure CSS on .hero-metaballs / .cta-orb (no React paint).
 * Desktop still mounts WebGL SafeMetaballs after mount / when visible.
 */

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

const SafeMetaballs = dynamic(() => import('./SafeMetaballs'), { ssr: false })

type Props = {
  className?: string
  speed?: number
  count?: number
  size?: number
  scale?: number
  colors?: string[]
  colorBack?: string
  loadWhenVisible?: boolean
}

function prefersDesktopShader() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(min-width: 981px)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function DeferredMetaballs({
  className,
  loadWhenVisible = false,
  speed = 1,
  count = 10,
  size = 0.52,
  scale = 1,
  colors = ['#F5349B', '#EE533B', '#FCA509', '#10B981', '#3286FE'],
  colorBack = '#00000000',
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [mountShader, setMountShader] = useState(false)

  useEffect(() => {
    if (!prefersDesktopShader()) return

    let cancelled = false
    const enable = () => {
      if (!cancelled) setMountShader(true)
    }

    if (!loadWhenVisible) {
      // Desktop: mount WebGL after first paint frame so LCP text isn't blocked.
      const raf = window.requestAnimationFrame(() => enable())
      return () => {
        cancelled = true
        window.cancelAnimationFrame(raf)
      }
    }

    const host = hostRef.current
    if (!host) {
      enable()
      return () => {
        cancelled = true
      }
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          io.disconnect()
          enable()
        }
      },
      { rootMargin: '120px' },
    )
    io.observe(host)
    return () => {
      cancelled = true
      io.disconnect()
    }
  }, [loadWhenVisible])

  return (
    <div ref={hostRef} className={className} aria-hidden="true">
      {mountShader ? (
        <div className="deferred-metaballs-shader">
          <SafeMetaballs
            speed={speed}
            count={count}
            size={size}
            scale={scale}
            colors={colors}
            colorBack={colorBack}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
      ) : null}
    </div>
  )
}
