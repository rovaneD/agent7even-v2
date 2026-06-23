'use client'

import { useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import {
  IMAGE_GENERATION_MODEL_CATALOG,
  type ImageGenerationModelId,
} from '@/lib/agents/imageGeneration/imageModelCatalog'
import type { GeneratedImageOption } from '@/lib/agents/imageGeneration/types'
import type { ImageAspectRatio } from '@/lib/agents/imageGeneration/openRouterImage'
import { sanitizeUserFacingError } from '@/lib/agents/sanitizeProviderError'

type Props = {
  disabled?: boolean
  sceneDirection?: string
  postContext?: Record<string, string>
  brandKitAvailable?: boolean
  hasUploadedLogo?: boolean
  aspectRatio?: ImageAspectRatio
  onOptionsReady: (payload: {
    briefId: string
    options: GeneratedImageOption[]
    imageModelId?: string
    imageModelLabel?: string
  }) => void
  onError?: (message: string) => void
}

const DEFAULT_MODEL_ID: ImageGenerationModelId = 'balanced'

/** Step 2 — brand + model, then generate three options. */
export default function PostImageGenerate({
  disabled,
  sceneDirection,
  postContext,
  brandKitAvailable = false,
  hasUploadedLogo = false,
  aspectRatio = '4:5',
  onOptionsReady,
  onError,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useBrandKit, setUseBrandKit] = useState(brandKitAvailable)
  const [includeLogo, setIncludeLogo] = useState(false)
  const [imageModelId, setImageModelId] = useState<ImageGenerationModelId>(DEFAULT_MODEL_ID)

  useEffect(() => {
    setUseBrandKit(brandKitAvailable)
    if (!brandKitAvailable) setIncludeLogo(false)
  }, [brandKitAvailable])

  useEffect(() => {
    if (!useBrandKit) setIncludeLogo(false)
  }, [useBrandKit])

  async function handleGenerate() {
    if (disabled || loading) return
    if (!postContext?.postGoal?.trim()) {
      const msg = 'Choose a Post goal in the setup form above before generating.'
      setError(msg)
      onError?.(msg)
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/posts/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneDirection: sceneDirection?.trim() || undefined,
          useBrandKit: useBrandKit && brandKitAvailable,
          includeLogo: includeLogo && useBrandKit && hasUploadedLogo,
          imageModelId,
          postContext,
          aspectRatio,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const raw =
          (typeof data.message === 'string' ? data.message : null)
          ?? (typeof data.error === 'string' ? data.error : null)
          ?? 'Generation failed'
        const msg = sanitizeUserFacingError(raw, 'image_generation')
        setError(msg)
        onError?.(msg)
        return
      }
      const picked = IMAGE_GENERATION_MODEL_CATALOG.find(m => m.id === imageModelId)
      onOptionsReady({
        briefId: data.briefId as string,
        options: data.options as GeneratedImageOption[],
        imageModelId: data.imageModelId as string | undefined,
        imageModelLabel: (data.imageModelLabel as string | undefined) ?? picked?.label,
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
        Set <strong>Post goal</strong> in the form above, then choose brand + model and generate three options.
      </p>

      {/* Step 1 — Brand */}
      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-menu-muted">1 · Brand</p>
        <div className="mt-2 space-y-2 rounded-xl border border-gray-100 bg-white/80 px-3 py-3">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={useBrandKit}
              disabled={!brandKitAvailable || disabled || loading}
              onChange={e => setUseBrandKit(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
            />
            <span className="text-xs leading-5 text-text-primary">
              <span className="font-semibold">Use Brand Kit</span>
              {brandKitAvailable
                ? ' — colors, fonts, imagery style, style references'
                : ' — add colors or style references in Brand Kit to enable'}
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 pl-1">
            <input
              type="checkbox"
              checked={includeLogo}
              disabled={!useBrandKit || !hasUploadedLogo || disabled || loading}
              onChange={e => setIncludeLogo(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary disabled:opacity-40"
            />
            <span className="text-xs leading-5 text-text-primary">
              <span className="font-semibold">Include logo on this post</span>
              {hasUploadedLogo
                ? ' — optional; most posts work better without'
                : ' — upload a logo in Brand Kit → Identity first'}
            </span>
          </label>
        </div>
      </div>

      {/* Step 2 — Model */}
      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-menu-muted">2 · Image model</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {IMAGE_GENERATION_MODEL_CATALOG.map(model => {
            const selected = imageModelId === model.id
            return (
              <button
                key={model.id}
                type="button"
                disabled={disabled || loading}
                onClick={() => setImageModelId(model.id)}
                className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  selected
                    ? 'border-brand-primary bg-white ring-1 ring-brand-primary/30'
                    : 'border-gray-100 bg-white/80 hover:border-gray-200'
                } disabled:opacity-60`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-text-primary">{model.label}</span>
                  {model.recommended && (
                    <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-semibold text-brand-primary">
                      Default
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] font-medium text-text-sec">{model.subtitle}</p>
                <p className="mt-1 text-[10px] leading-4 text-text-soft">{model.hint}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Step 3 — Generate */}
      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-menu-muted">3 · Generate</p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={disabled || loading}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {loading ? 'Generating 3 options…' : 'Generate 3 options'}
        </button>
        {loading && (
          <p className="mt-2 text-xs text-text-soft">Usually 30–90 seconds. Stay on this page.</p>
        )}
      </div>
    </div>
  )
}
