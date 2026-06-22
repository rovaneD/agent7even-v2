'use client'

import { useEffect, useState } from 'react'
import { Bookmark, Check, Loader2 } from 'lucide-react'
import DownloadImageButton from '@/components/media/DownloadImageButton'
import { IMAGE_GENERATION_MODEL_CATALOG } from '@/lib/agents/imageGeneration/imageModelCatalog'
import type { GeneratedImageOption } from '@/lib/agents/imageGeneration/types'

type Props = {
  options: GeneratedImageOption[]
  selectedIndex: number | null
  briefId?: string | null
  imageModelLabel?: string | null
  postContext?: Record<string, string>
  qaPassed?: boolean
  onSelect: (option: GeneratedImageOption) => void
  disabled?: boolean
}

/** Step 4 — pick 1 of N generated options; optional save to asset library. */
export default function PostImageGeneratePicker({
  options,
  selectedIndex,
  briefId,
  imageModelLabel,
  postContext,
  qaPassed,
  onSelect,
  disabled,
}: Props) {
  const [savedStoragePaths, setSavedStoragePaths] = useState<Set<string>>(new Set())
  const [savingStoragePath, setSavingStoragePath] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Drop saved markers for images no longer in the current option set (e.g. after edit/regenerate).
  useEffect(() => {
    const currentPaths = new Set(options.map(o => o.storagePath))
    setSavedStoragePaths(prev => {
      const next = new Set([...prev].filter(path => currentPaths.has(path)))
      return next.size === prev.size ? prev : next
    })
  }, [options])

  if (options.length === 0) return null

  const modelLabel =
    imageModelLabel
    ?? IMAGE_GENERATION_MODEL_CATALOG.find(m => m.openRouterModel === options[0]?.model)?.label
    ?? 'Custom model'

  async function saveOption(option: GeneratedImageOption, e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (savedStoragePaths.has(option.storagePath) || savingStoragePath != null) return

    setSavingStoragePath(option.storagePath)
    setSaveError(null)
    try {
      const res = await fetch('/api/creative-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storagePath: option.storagePath,
          mime: option.mime,
          briefId: briefId ?? undefined,
          optionIndex: option.index,
          imageModel: option.model,
          imageModelLabel: modelLabel,
          briefExcerpt: option.brief.slice(0, 400),
          brief: option.brief,
          qaPassed: qaPassed && selectedIndex === option.index ? true : undefined,
          postContext,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaveError(
          (typeof data.message === 'string' ? data.message : null)
          ?? 'Could not save to library.',
        )
        return
      }
      setSavedStoragePaths(prev => new Set(prev).add(option.storagePath))
    } finally {
      setSavingStoragePath(null)
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">
          4 · Pick one image
        </p>
        <p className="text-[10px] text-text-soft">
          Model: {modelLabel} · Save any option to{' '}
          <a href="/dashboard/assets" className="font-medium text-brand-primary hover:underline">
            Assets
          </a>
        </p>
      </div>
      {saveError && <p className="text-xs text-red-600">{saveError}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {options.map(option => {
          const selected = selectedIndex === option.index
          const saved = savedStoragePaths.has(option.storagePath)
          const saving = savingStoragePath === option.storagePath
          return (
            <div key={`${option.index}-${option.storagePath}`} className="relative">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(option)}
                className={`w-full overflow-hidden rounded-xl border text-left transition-colors ${
                  selected
                    ? 'border-brand-primary ring-2 ring-brand-primary/30'
                    : 'border-gray-100 hover:border-brand-primary/40'
                }`}
              >
                {option.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={option.previewUrl}
                    alt={`Generated option ${option.index + 1}`}
                    className="aspect-[4/5] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[4/5] items-center justify-center bg-gray-50 text-xs text-text-soft">
                    Preview unavailable
                  </div>
                )}
                <div className="border-t border-gray-100 px-3 py-2">
                  <p className="text-xs font-semibold text-text-primary">Option {option.index + 1}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-text-soft">
                    {option.brief.slice(0, 120)}…
                  </p>
                </div>
              </button>
              <button
                type="button"
                disabled={saved || saving}
                onClick={e => void saveOption(option, e)}
                className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-white/95 px-2 py-1 text-[10px] font-semibold text-text-primary shadow-sm hover:bg-white disabled:opacity-80"
                title="Save to Assets library"
              >
                {saving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : saved ? (
                  <Check size={12} className="text-emerald-600" />
                ) : (
                  <Bookmark size={12} />
                )}
                {saved ? 'Saved' : 'Save'}
              </button>
              <DownloadImageButton
                storagePath={option.storagePath}
                mime={option.mime}
                filename={`generated-option-${option.index + 1}.png`}
                label="Download image"
                iconOnly
                disabled={disabled}
                className="absolute left-2 top-2"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
