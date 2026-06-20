'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import type { GeneratedImageOption } from '@/lib/agents/imageGeneration/types'

type Props = {
  disabled?: boolean
  sceneDirection?: string
  onOptionsReady: (payload: {
    briefId: string
    options: GeneratedImageOption[]
  }) => void
  onError?: (message: string) => void
}

export default function PostImageGenerate({
  disabled,
  sceneDirection,
  onOptionsReady,
  onError,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    if (disabled || loading) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/posts/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneDirection: sceneDirection?.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          (typeof data.message === 'string' ? data.message : null) ??
          (typeof data.error === 'string' ? data.error : null) ??
          'Generation failed'
        setError(msg)
        onError?.(msg)
        return
      }
      onOptionsReady({
        briefId: data.briefId as string,
        options: data.options as GeneratedImageOption[],
      })
    } catch {
      const msg = 'Generation failed. Try again.'
      setError(msg)
      onError?.(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-brand-primary/30 bg-brand-primary/5 p-4">
      <p className="text-sm font-semibold text-text-primary">Generate with Maya</p>
      <p className="mt-1 text-xs leading-5 text-text-sec">
        Maya composes a Foundation-grounded brief and returns three image options. After you pick one and it passes text QA, submit for approval — caption and image land in your queue together.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={disabled || loading}
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {loading ? 'Generating 3 options…' : 'Generate 3 options'}
      </button>
      {loading && (
        <p className="mt-2 text-xs text-text-soft">Usually 30–90 seconds. Stay on this page.</p>
      )}
    </div>
  )
}
