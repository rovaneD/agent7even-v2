'use client'

import type { PlatformFormatSpec } from '@/lib/agents/contentPosting/platformFormats'

type Props = {
  formats: PlatformFormatSpec[]
  selectedId: string
  onSelect: (id: string) => void
  name: string
}

/** Canva-style format list — platform label left, pixel dimensions right. */
export default function PlatformFormatSelector({ formats, selectedId, onSelect, name }: Props) {
  return (
    <div
      className="max-h-[220px] overflow-y-auto rounded-xl border border-gray-100 bg-white"
      role="radiogroup"
      aria-label="Platform and format"
    >
      {formats.map(format => {
        const selected = format.id === selectedId
        return (
          <label
            key={format.id}
            className={`flex cursor-pointer items-center justify-between gap-3 border-b border-gray-100 px-3 py-2.5 text-sm transition-colors last:border-b-0 ${
              selected ? 'bg-brand-primary/5' : 'hover:bg-gray-50/80'
            }`}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <input
                type="radio"
                name={name}
                value={format.id}
                checked={selected}
                onChange={() => onSelect(format.id)}
                className="h-3.5 w-3.5 flex-shrink-0 border-gray-300 text-brand-primary focus:ring-brand-primary"
              />
              <span className="truncate font-medium text-text-primary">{format.label}</span>
            </span>
            <span className="flex-shrink-0 text-xs tabular-nums text-text-soft">{format.dimensions}</span>
          </label>
        )
      })}
    </div>
  )
}
