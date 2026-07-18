'use client'

/**
 * BEFORE: SafeMetaballs / WebGL shader mounted immediately in hero + footer CTA.
 * That pulled @paper-design/shaders-react on first paint and drove mobile TBT/LCP.
 *
 * AFTER (mobile-only behavior): always paint a CSS gradient stand-in first.
 * WebGL Metaballs load only on desktop (min-width 981px), optionally after the
 * host enters the viewport. Desktop visual intent stays the same; mobile never
 * downloads the shader bundle.
 */

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, type CSSProperties } from 'react'

const SafeMetaballs = dynamic(() => import('./SafeMetaballs'), { ssr: false })

type Props = {
  className?: string
  speed?: number
  count?: number
  size?: number
  scale?: number
  colors?: string[]
  colorBack?: string
  /** When true, wait until this container is near the viewport before loading WebGL (desktop). */
  loadWhenVisible?: boolean
}

function GradientFallback({ style }: { style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        background: [
          'radial-gradient(circle at 32% 34%, rgba(245,52,155,0.85) 0%, rgba(245,52,155,0) 30%)',
          'radial-gradient(circle at 66% 28%, rgba(252,165,9,0.8) 0%, rgba(252,165,9,0) 28%)',
          'radial-gradient(circle at 52% 64%, rgba(50,134,254,0.85) 0%, rgba(50,134,254,0) 32%)',
          'radial-gradient(circle at 76% 68%, rgba(16,185,129,0.75) 0%, rgba(16,185,129,0) 24%)',
          'radial-gradient(circle at 26% 70%, rgba(238,83,59,0.75) 0%, rgba(238,83,59,0) 24%)',
        ].join(','),
        filter: 'blur(14px) saturate(1.05)',
        ...style,
      }}
    />
  )
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
      enable()
      return () => {
        cancelled = true
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
      <GradientFallback />
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
