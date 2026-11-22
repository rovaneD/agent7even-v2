'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BookingWindows, VoixAppointment } from '@/lib/voix/appointments'
import WeekCalendar from './WeekCalendar'
import { formatPhone } from '@/lib/voix/format'

const STATUS: Record<VoixAppointment['status'], { label: string; cls: string }> = {
  pending: { label: 'Needs confirmation', cls: 'bg-[#FFF4E0] text-[#8A5A00]' },
  confirmed: { label: 'Confirmed', cls: 'bg-[#E7F6EC] text-[#1E6B3A]' },
  declined: { label: 'Declined', cls: 'bg-[#F1F2F5] text-[#5B6070]' },
  cancelled: { label: 'Cancelled', cls: 'bg-[#F1F2F5] text-[#5B6070]' },
}

const CALLBACK: Record<VoixAppointment['callback_status'], string | null> = {
  none: null,
  placed: 'Voix is calling the client to confirm',
  failed: 'Callback failed',
  skipped: 'No callback',
}

function dayKey(iso: string, tz: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}
function dayLabel(iso: string, tz: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(iso))
}
function timeLabel(iso: string, tz: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

export default function AppointmentsBoard({
  accountId, timezone, items, windows,
}: { accountId: string; timezone: string; items: VoixAppointment[]; windows: BookingWindows }) {
  const router = useRouter()
  const [view, setView] = useState<'week' | 'list'>('week')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Live view: new requests from calls appear within a few seconds.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, 4000)
    return () => clearInterval(t)
  }, [router])

  async function act(id: string, action: 'confirm' | 'decline') {
    setBusy(id)
    setError(null)
    try {
      const res = await fetch('/api/voix/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, id, action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data.error || 'Something went wrong')
      else if (data.callback === 'failed') setError(`Confirmed, but the callback failed: ${data.reason}`)
      else if (data.callback === 'skipped') setError(`Confirmed. No callback: ${data.reason}`)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const pending = items.filter((a) => a.status === 'pending')
  const rest = items.filter((a) => a.status !== 'pending')
  const groups = new Map<string, VoixAppointment[]>()
  for (const a of rest) groups.set(dayKey(a.start_at, timezone), [...(groups.get(dayKey(a.start_at, timezone)) ?? []), a])

  const card = (a: VoixAppointment) => (
    <li key={a.id} className="rounded-2xl border border-[#ECEDF1] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS[a.status].cls}`}>
              {STATUS[a.status].label}
            </span>
            <span className="text-[15px] font-medium">
              {dayLabel(a.start_at, timezone)} · {timeLabel(a.start_at, timezone)}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#4A5061]">
            {a.caller_name || 'Caller'}
            {a.caller_phone ? ` · ${formatPhone(a.caller_phone)}` : ''}
            {a.service ? ` · ${a.service}` : ''}
          </p>
          {a.notes ? <p className="mt-1 text-sm text-[#5B6070]">{a.notes}</p> : null}
          {a.status !== 'pending' && (a.decided_by_label || CALLBACK[a.callback_status]) ? (
            <p className="mt-1 text-xs text-[#5B6070]">
              {a.decided_by_label ? `${STATUS[a.status].label} by ${a.decided_by_label}` : ''}
              {CALLBACK[a.callback_status] ? ` · ${CALLBACK[a.callback_status]}` : ''}
              {a.callback_status === 'failed' && a.callback_error ? ` (${a.callback_error})` : ''}
            </p>
          ) : null}
        </div>
        {a.status === 'pending' ? (
          <div className="flex gap-2">
            <button
              onClick={() => act(a.id, 'decline')}
              disabled={busy === a.id}
              className="rounded-full border border-[#D5D8E0] bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Decline
            </button>
            <button
              onClick={() => act(a.id, 'confirm')}
              disabled={busy === a.id}
              className="rounded-full bg-[#1B2236] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy === a.id ? 'Confirming…' : 'Confirm'}
            </button>
          </div>
        ) : null}
      </div>
    </li>
  )

  const toggle = (
    <div className="mb-4 inline-flex rounded-full border border-[#ECEDF1] bg-white p-1">
      {(['week', 'list'] as const).map((v) => (
        <button
          key={v}
          onClick={() => setView(v)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${view === v ? 'bg-[#1B2236] text-white' : 'text-[#4A5061]'}`}
        >
          {v === 'week' ? 'Week' : 'List'}
        </button>
      ))}
    </div>
  )

  if (view === 'week') {
    return (
      <div>
        {toggle}
        {error ? <p className="mb-3 rounded-xl bg-[#FDECEC] px-4 py-3 text-sm text-[#A12B2B]">{error}</p> : null}
        <WeekCalendar items={items} timezone={timezone} windows={windows} onAct={act} busyId={busy} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {toggle}
      {error ? <p className="rounded-xl bg-[#FDECEC] px-4 py-3 text-sm text-[#A12B2B]">{error}</p> : null}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#5B6070]">Needs confirmation ({pending.length})</h2>
        {pending.length ? (
          <ul className="space-y-3">{pending.map(card)}</ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#D5D8E0] bg-white px-6 py-12 text-center text-sm text-[#5B6070]">
            Nothing to confirm. New requests from calls show up here.
          </div>
        )}
      </section>
      {[...groups.entries()].map(([k, list]) => (
        <section key={k}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#5B6070]">{dayLabel(list[0].start_at, timezone)}</h2>
          <ul className="space-y-3">{list.map(card)}</ul>
        </section>
      ))}
    </div>
  )
}
