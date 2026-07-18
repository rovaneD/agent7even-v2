'use client'

/**
 * Mobile-only optimization wrapper around SafeMetaballs.
 * Desktop: mount WebGL immediately (same as pre-perf-pass).
 * Mobile: empty host — CSS gradient on .hero-metaballs / .cta-orb paints instead.
 */

import dynamic from 'next/dynamic'
import { useLayoutEffect, useState, type CSSProperties } from 'react'

const SafeMetaballs = dynamic(() => import('./SafeMetaballs'), { ssr: false })

type Props = {
  className?: string
  speed?: number
  count?: number
  size?: number
  scale?: number
  colors?: string[]
  colorBack?: string
  /** Kept for API compat; desktop mounts immediately either way. */
  loadWhenVisible?: boolean
}

function prefersDesktopShader() {
  return (
    window.matchMedia('(min-width: 981px)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function DeferredMetaballs({
  className,
  loadWhenVisible: _loadWhenVisible = false,
  speed = 1,
  count = 10,
  size = 0.52,
  scale = 1,
  colors = ['#F5349B', '#EE533B', '#FCA509', '#10B981', '#3286FE'],
  colorBack = '#00000000',
}: Props) {
  const [desktop, setDesktop] = useState(false)

  useLayoutEffect(() => {
    setDesktop(prefersDesktopShader())
  }, [])

  // Mobile / SSR: CSS backgrounds handle the look — do not mount WebGL.
  if (!desktop) {
    return <div className={className} aria-hidden="true" />
  }

  return (
    <div className={className} aria-hidden="true">
      <SafeMetaballs
        speed={speed}
        count={count}
        size={size}
        scale={scale}
        colors={colors}
        colorBack={colorBack}
        style={{ width: '100%', height: '100%', display: 'block' } satisfies CSSProperties}
      />
    </div>
  )
}
