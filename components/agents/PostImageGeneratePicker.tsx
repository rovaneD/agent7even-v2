'use client'

import type { GeneratedImageOption } from '@/lib/agents/imageGeneration/types'

type Props = {
  options: GeneratedImageOption[]
  selectedIndex: number | null
  onSelect: (option: GeneratedImageOption) => void
  disabled?: boolean
}

/** Step 3 lite — pick 1 of N generated options (pre-queue compose). */
export default function PostImageGeneratePicker({
  options,
  selectedIndex,
  onSelect,
  disabled,
}: Props) {
  if (options.length === 0) return null

  return (
    <div className="mt-4 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">
        Pick one image
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {options.map(option => {
          const selected = selectedIndex === option.index
          return (
            <button
              key={option.index}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(option)}
              className={`overflow-hidden rounded-xl border text-left transition-colors ${
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
          )
        })}
      </div>
    </div>
  )
}
