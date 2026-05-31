'use client'
import { useEffect } from 'react'
export default function CanvasContextDispatcher({ context }: { context: string }) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context } }))
  }, [context])
  return null
}
