'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

/** POST/PATCH helper that refreshes server data on success. */
export function useFollowupAction() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(url: string, method: 'POST' | 'PATCH', body: Record<string, unknown>): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'Something went wrong. Try again.')
        return false
      }
      router.refresh()
      return true
    } catch {
      setError('Network error. Try again.')
      return false
    } finally {
      setBusy(false)
    }
  }

  return {
    busy,
    error,
    patch: (id: string, body: Record<string, unknown>) => run(`/api/voix/followups/${id}`, 'PATCH', body),
    create: (body: Record<string, unknown>) => run('/api/voix/followups', 'POST', body),
  }
}

/** Small dropdown menu; closes on outside click or after a choice. */
export function Menu({
  label,
  items,
  disabled,
  tone = 'light',
  align = 'left',
}: {
  label: ReactNode
  items: { key: string; label: string; onSelect: () => void }[]
  disabled?: boolean
  tone?: 'light' | 'dark'
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className={tone === 'dark' ? BTN_DARK : BTN_LIGHT}
      >
        {label}
      </button>
      {open ? (
        <div
          role="menu"
          className={`absolute z-30 mt-1.5 min-w-44 overflow-hidden rounded-xl border border-[#ECEDF1] bg-white py-1 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setOpen(false)
                it.onSelect()
              }}
              className="block w-full px-3.5 py-2 text-left text-sm hover:bg-[#F6F7F9]"
            >
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export const BTN_LIGHT =
  'inline-flex items-center gap-1.5 rounded-full border border-[#D5D8E0] bg-white px-3.5 py-1.5 text-sm font-medium text-[#1B2236] transition hover:border-[#B9BDC8] disabled:opacity-50'
export const BTN_DARK =
  'inline-flex items-center gap-1.5 rounded-full bg-[#1B2236] px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-[#2A3350] disabled:opacity-50'
