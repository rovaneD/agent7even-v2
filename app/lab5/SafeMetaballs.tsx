'use client'

import { Component, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { Metaballs } from '@paper-design/shaders-react'

type MetaballsProps = ComponentProps<typeof Metaballs>

// Static stand-in that echoes the metaballs palette when WebGL is unavailable
// or the context gets reclaimed (common on Android Chrome).
function GradientFallback({ style }: { style?: React.CSSProperties }) {
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

class ShaderErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export default function SafeMetaballs(props: MetaballsProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (failed) return
    const wrap = wrapRef.current
    if (!wrap) return

    let canvas: HTMLCanvasElement | null = null
    const onLost = (e: Event) => {
      e.preventDefault()
      setFailed(true)
    }

    // The shader mounts its canvas asynchronously; give it a moment before
    // deciding WebGL never came up.
    const timer = window.setTimeout(() => {
      canvas = wrap.querySelector('canvas')
      if (!canvas) {
        setFailed(true)
        return
      }
      canvas.addEventListener('webglcontextlost', onLost)
    }, 800)

    return () => {
      window.clearTimeout(timer)
      canvas?.removeEventListener('webglcontextlost', onLost)
    }
  }, [failed])

  if (failed) return <GradientFallback style={props.style as React.CSSProperties} />

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%', display: 'block' }}>
      <ShaderErrorBoundary fallback={<GradientFallback style={props.style as React.CSSProperties} />}>
        <Metaballs {...props} />
      </ShaderErrorBoundary>
    </div>
  )
}
