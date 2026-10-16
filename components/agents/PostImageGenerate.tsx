'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Sparkles } from 'lucide-react'
import type { ImageGenerationModelId } from '@/lib/agents/imageGeneration/imageModelCatalog'
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

// Styles choose their own models now; this id only selects the credit tier (standard).
const DEFAULT_MODEL_ID: ImageGenerationModelId = 'balanced'
const AUTO = 'auto'

type StyleCard = { id: string; name: string; tagline: string; usesLogo: boolean; examples: string[] }

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
  const imageModelId = DEFAULT_MODEL_ID
  const [styles, setStyles] = useState<StyleCard[]>([])
  const [styleId, setStyleId] = useState<string>(AUTO)

  useEffect(() => {
    let cancelled = false
    fetch('/api/posts/styles')
      .then(r => (r.ok ? r.json() : { styles: [] }))
      .then(d => { if (!cancelled) setStyles(Array.isArray(d.styles) ? d.styles : []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const selectedStyle = styles.find(st => st.id === styleId)

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
          styleId,
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
      onOptionsReady({
        briefId: data.briefId as string,
        options: data.options as GeneratedImageOption[],
        imageModelId: data.imageModelId as string | undefined,
        imageModelLabel: selectedStyle?.name ?? 'Maya\'s picks',
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
        Set <strong>Post goal</strong> in the form above, pick a style, and Maya generates three options.
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
                ? ' — your real logo, placed on objects in Brand world and Witty object styles'
                : ' — upload a logo in Brand Kit → Identity first'}
            </span>
          </label>
        </div>
      </div>

      {/* Step 2 — Style */}
      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-menu-muted">2 · Style</p>
        <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-3">
          <StyleButton
            selected={styleId === AUTO}
            disabled={disabled || loading}
            onClick={() => setStyleId(AUTO)}
            name="Let Maya choose"
            tagline="Three ideas, each in the style that fits it best"
            images={styles.map(st => st.examples[0]).filter(Boolean).slice(0, 4) as string[]}
            mosaic
            badge="Default"
          />
          {styles.map(st => (
            <StyleButton
              key={st.id}
              selected={styleId === st.id}
              disabled={disabled || loading}
              onClick={() => setStyleId(st.id)}
              name={st.name}
              tagline={st.tagline}
              images={st.examples}
            />
          ))}
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
          <p className="mt-2 text-xs text-text-soft">Usually 1–2 minutes. Stay on this page.</p>
        )}
      </div>
    </div>
  )
}

function StyleButton(props: {
  selected: boolean
  disabled?: boolean
  onClick: () => void
  name: string
  tagline: string
  images: string[]
  mosaic?: boolean
  badge?: string
}) {
  const { selected, disabled, onClick, name, tagline, images, mosaic, badge } = props
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={`group relative overflow-hidden rounded-xl border text-left transition-all ${
        selected
          ? 'border-brand-primary bg-white ring-2 ring-brand-primary/40'
          : 'border-gray-100 bg-white/80 hover:border-gray-300'
      } disabled:opacity-60`}
    >
      <div className={`grid aspect-[4/5] w-full gap-0.5 bg-gray-100 ${mosaic ? 'grid-cols-2 grid-rows-2' : 'grid-cols-3 grid-rows-2'}`}>
        {images.length === 0 && <div className="col-span-full row-span-full animate-pulse bg-gray-100" />}
        {images.slice(0, mosaic ? 4 : 3).map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover ${!mosaic && i === 0 ? 'col-span-2 row-span-2' : ''} ${!mosaic && images.length === 1 ? 'col-span-3' : ''}`}
          />
        ))}
      </div>
      {selected && (
        <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary text-white shadow">
          <Check size={14} />
        </span>
      )}
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-text-primary">{name}</span>
          {badge && (
            <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-semibold text-brand-primary">{badge}</span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] leading-4 text-text-sec">{tagline}</p>
      </div>
    </button>
  )
}
