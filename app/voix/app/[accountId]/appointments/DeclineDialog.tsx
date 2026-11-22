'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Slot, VoixAppointment } from '@/lib/voix/appointments'

/**
 * Decline a requested time and hand Voix up to three times the team can do.
 * Voix calls the client, offers them, and books the one they pick.
 */
export default function DeclineDialog({
  accountId, timezone, appt, onClose, onDone, mode = 'decline',
}: {
  mode?: 'decline' | 'reschedule'
  accountId: string
  timezone: string
  appt: VoixAppointment
  onClose: () => void
  onDone: (result: { callback?: string; reason?: string }) => void
}) {
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/voix/appointments?accountId=${encodeURIComponent(accountId)}`)
      .then((r) => r.json())
      .then((d) => setSlots(Array.isArray(d.slots) ? d.slots : []))
      .catch(() => setSlots([]))
  }, [accountId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Group by day; show the next 5 days that have openings.
  const days = useMemo(() => {
    const map = new Map<string, { label: string; slots: Slot[] }>()
    for (const s of slots ?? []) {
      const d = new Date(s.iso)
      const key = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
      const label = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric' }).format(d)
      const entry = map.get(key) ?? { label, slots: [] }
      entry.slots.push(s)
      map.set(key, entry)
    }
    return [...map.values()].slice(0, 5)
  }, [slots, timezone])

  const time = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
  const requested = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(appt.start_at))

  function toggle(iso: string) {
    setPicked((p) => (p.includes(iso) ? p.filter((x) => x !== iso) : p.length >= 3 ? p : [...p, iso]))
  }

  async function submit(callback: boolean) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/voix/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, id: appt.id, action: mode, alternatives: callback ? picked : [], callback }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Something went wrong'); return }
      onDone(data)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1B2236]/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="decline-title" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <h2 id="decline-title" className="text-[28px] leading-tight" style={{ fontFamily: 'var(--voix-serif), Georgia, serif' }}>{mode === 'reschedule' ? 'Reschedule appointment' : 'Offer other times'}</h2>
        <p className="mt-1 text-sm text-[#4A5061]">
          {appt.caller_name || 'The client'} {mode === 'reschedule' ? 'is booked for' : 'asked for'} <strong>{requested}</strong>{appt.service ? ` (${appt.service})` : ''}. Pick up to 3 times you can do. Voix will call them, offer these, and book the one they choose.
        </p>

        <div className="mt-5 space-y-4">
          {slots === null ? (
            <p className="text-sm text-[#5B6070]">Loading open times…</p>
          ) : days.length === 0 ? (
            <p className="text-sm text-[#5B6070]">No open times in the next 10 days. Voix can still call and ask what works for them.</p>
          ) : (
            days.map((d) => (
              <div key={d.label}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5B6070]">{d.label}</p>
                <div className="flex flex-wrap gap-2">
                  {d.slots.map((s) => {
                    const on = picked.includes(s.iso)
                    const full = !on && picked.length >= 3
                    return (
                      <button
                        key={s.iso}
                        type="button"
                        onClick={() => toggle(s.iso)}
                        disabled={full}
                        aria-pressed={on}
                        className={`min-h-[40px] rounded-full border px-3.5 text-sm font-medium transition disabled:opacity-40 ${
                          on ? 'border-[#1B2236] bg-[#1B2236] text-white' : 'border-[#D5D8E0] bg-white text-[#1B2236] hover:border-[#1B2236]'
                        }`}
                      >
                        {time(s.iso)}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {error ? <p className="mt-4 rounded-xl bg-[#FDECEC] px-4 py-3 text-sm text-[#A12B2B]">{error}</p> : null}

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={busy}
            className="min-h-[48px] rounded-full bg-[#1B2236] px-5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Working…' : picked.length ? `${mode === 'reschedule' ? 'Have' : 'Decline and have'} Voix offer ${picked.length === 1 ? 'this time' : `these ${picked.length} times`}` : `${mode === 'reschedule' ? 'Have' : 'Decline and have'} Voix call to reschedule`}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={() => submit(false)} disabled={busy} className="min-h-[44px] flex-1 rounded-full border border-[#D5D8E0] bg-white px-4 text-sm font-medium disabled:opacity-50">
              {mode === 'reschedule' ? 'Cancel without a call' : 'Decline without a call'}
            </button>
            <button type="button" onClick={onClose} disabled={busy} className="min-h-[44px] flex-1 rounded-full px-4 text-sm font-medium text-[#4A5061]">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
