'use client'

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[10px] bg-white/[0.05] p-[3px] ring-1 ring-white/[0.06]">
      {options.map(o => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`rounded-[8px] px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              on ? 'bg-white/[0.14] text-white' : 'text-[#9A9DA5] hover:text-white'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export const fieldClass =
  'w-full rounded-[10px] border border-white/[0.08] bg-[#0F1012] px-3 py-2.5 text-[14px] text-white placeholder:text-[#5C5F67] outline-none transition-colors focus:border-brand-primary'
