'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { BookingWindows, VoixAppointment } from '@/lib/voix/appointments'
import { formatPhone } from '@/lib/voix/format'

const ROW_PX = 40 // height of one 30-minute row

const TONE: Record<VoixAppointment['status'], string> = {
  pending: 'border-l-[#D99A1E] bg-[#FFF4E0] text-[#5C3B00]',
  confirmed: 'border-l-[#3E9B63] bg-[#E7F6EC] text-[#1B4D2E]',
  declined: 'border-l-[#B9BDC7] bg-[#F1F2F5] text-[#8A8F9C] line-through',
  cancelled: 'border-l-[#B9BDC7] bg-[#F1F2F5] text-[#8A8F9C] line-through',
}

/** y/m/d, weekday and minutes-after-midnight of an instant in a time zone. */
function local(iso: string | number, tz: string) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value)
  return { key: `${g('year')}-${String(g('month')).padStart(2, '0')}-${String(g('day')).padStart(2, '0')}`, y: g('year'), m: g('month'), d: g('day'), min: g('hour') * 60 + g('minute') }
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const clock = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`
}

export default function WeekCalendar({
  items, timezone, windows, onAct, busyId,
}: {
  items: VoixAppointment[]
  timezone: string
  windows: BookingWindows
  onAct: (id: string, action: 'confirm' | 'decline') => void
  busyId: string | null
}) {
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)

  // Monday-start week in the spa's time zone.
  const days = useMemo(() => {
    const t = local(Date.now(), timezone)
    const today = new Date(Date.UTC(t.y, t.m - 1, t.d, 12))
    const monday = new Date(today)
    monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7) + offset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setUTCDate(monday.getUTCDate() + i)
      const key = d.toISOString().slice(0, 10)
      return {
        key,
        wd: d.getUTCDay(),
        isToday: key === t.key,
        label: new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(d),
        date: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d),
      }
    })
  }, [offset, timezone])

  const byDay = useMemo(() => {
    const map = new Map<string, (VoixAppointment & { startMin: number })[]>()
    for (const a of items) {
      const l = local(a.start_at, timezone)
      map.set(l.key, [...(map.get(l.key) ?? []), { ...a, startMin: l.min }])
    }
    return map
  }, [items, timezone])

  // Visible hours: the booking windows, stretched to fit any appointment this week.
  const [startMin, endMin] = useMemo(() => {
    let lo = Infinity, hi = -Infinity
    for (const list of Object.values(windows)) for (const [a, b] of list) { lo = Math.min(lo, toMin(a)); hi = Math.max(hi, toMin(b)) }
    for (const d of days) for (const a of byDay.get(d.key) ?? []) { lo = Math.min(lo, a.startMin); hi = Math.max(hi, a.startMin + a.duration_min) }
    // Always show at least 7 AM–9 PM so early and late spas fit; widen further if needed.
    lo = Math.min(Number.isFinite(lo) ? lo : 7 * 60, 7 * 60)
    hi = Math.max(Number.isFinite(hi) ? hi : 21 * 60, 21 * 60)
    return [Math.max(0, Math.floor(lo / 60) * 60), Math.min(24 * 60, Math.ceil(hi / 60) * 60)]
  }, [windows, days, byDay])

  const rows = (endMin - startMin) / 30

  // Open scrolled to the spa's earliest booking hour (or earliest appointment this week).
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let first = Infinity
    for (const list of Object.values(windows)) for (const [a] of list) first = Math.min(first, toMin(a))
    for (const d of days) for (const a of byDay.get(d.key) ?? []) first = Math.min(first, a.startMin)
    if (!Number.isFinite(first) || !scroller.current) return
    scroller.current.scrollTop = Math.max(0, ((first - startMin) / 30) * ROW_PX - ROW_PX)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset])
  const sel = items.find((a) => a.id === selected) ?? null
  const weekLabel = `${days[0].date} – ${days[6].date}`
  const pendingThisWeek = days.reduce((n, d) => n + (byDay.get(d.key) ?? []).filter((a) => a.status === 'pending').length, 0)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setOffset((o) => o - 1)} className="rounded-full border border-[#ECEDF1] bg-white px-3 py-1.5 text-sm" aria-label="Previous week">←</button>
        <button onClick={() => setOffset(0)} className="rounded-full border border-[#ECEDF1] bg-white px-3.5 py-1.5 text-sm font-medium">This week</button>
        <button onClick={() => setOffset((o) => o + 1)} className="rounded-full border border-[#ECEDF1] bg-white px-3 py-1.5 text-sm" aria-label="Next week">→</button>
        <span className="ml-2 text-sm font-medium">{weekLabel}</span>
        {pendingThisWeek ? <span className="ml-auto text-sm text-[#8A5A00]">{pendingThisWeek} to confirm this week</span> : null}
      </div>

      <div ref={scroller} className="max-h-[640px] overflow-auto rounded-2xl border border-[#ECEDF1] bg-white">
        <div className="grid min-w-[760px]" style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}>
          <div className="sticky top-0 z-20 border-b border-[#ECEDF1] bg-white" />
          {days.map((d) => (
            <div key={d.key} className={`sticky top-0 z-20 border-b border-l border-[#ECEDF1] px-2 py-2 text-center ${d.isToday ? 'bg-[#EAF0FF]' : 'bg-white'}`}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#5B6070]">{d.label}</div>
              <div className={`text-sm ${d.isToday ? 'font-semibold text-[#2A47B8]' : ''}`}>{d.date}</div>
            </div>
          ))}

          {/* Time gutter */}
          <div className="relative" style={{ height: rows * ROW_PX }}>
            {Array.from({ length: rows / 2 }, (_, i) => (
              <div key={i} className="absolute right-2 text-[11px] text-[#8A8F9C]" style={{ top: i * 2 * ROW_PX + 3 }}>
                {clock(startMin + i * 60)}
              </div>
            ))}
          </div>

          {days.map((d) => {
            const open = windows[String(d.wd)] ?? []
            return (
              <div key={d.key} className="relative border-l border-[#ECEDF1]" style={{ height: rows * ROW_PX }}>
                {/* Closed time is shaded; open booking windows are white. */}
                <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,#F6F7F9,#F6F7F9_6px,#FBFBFC_6px,#FBFBFC_12px)]" />
                {open.map(([a, b]) => (
                  <div key={a} className="absolute inset-x-0 bg-white" style={{ top: ((toMin(a) - startMin) / 30) * ROW_PX, height: ((toMin(b) - toMin(a)) / 30) * ROW_PX }} />
                ))}
                {Array.from({ length: rows }, (_, i) => (
                  <div key={i} className={`absolute inset-x-0 border-t ${i % 2 ? 'border-dashed border-[#F1F2F5]' : 'border-[#ECEDF1]'}`} style={{ top: i * ROW_PX }} />
                ))}
                {(byDay.get(d.key) ?? []).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a.id === selected ? null : a.id)}
                    title={`${clock(a.startMin)} · ${a.caller_name || 'Caller'}${a.service ? ` · ${a.service}` : ''}`}
                    className={`absolute inset-x-1 overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-left text-[12px] leading-[15px] shadow-[0_1px_2px_rgba(27,34,54,0.08)] transition hover:brightness-[0.98] ${TONE[a.status]} ${a.id === selected ? 'z-10 ring-2 ring-[#1B2236]' : ''}`}
                    style={{ top: ((a.startMin - startMin) / 30) * ROW_PX + 1, height: Math.max((a.duration_min / 30) * ROW_PX - 2, ROW_PX - 2) }}
                  >
                    <div className="flex items-center gap-1 truncate font-semibold">
                      {a.status === 'pending' ? <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#D99A1E]" /> : null}
                      <span className="truncate">{a.caller_name || 'Caller'}</span>
                    </div>
                    <div className="truncate opacity-80">{clock(a.startMin)}{a.service ? ` · ${a.service}` : ''}</div>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#5B6070]">
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm border-l-[3px] border-l-[#D99A1E] bg-[#FFF4E0]" />Needs confirmation</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm border-l-[3px] border-l-[#3E9B63] bg-[#E7F6EC]" />Confirmed</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded border border-[#ECEDF1] bg-[repeating-linear-gradient(135deg,#F1F2F5,#F1F2F5_3px,#FBFBFC_3px,#FBFBFC_6px)]" />Outside booking hours</span>
      </div>

      {sel ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ECEDF1] bg-white p-4">
          <div>
            <p className="text-[15px] font-medium">
              {new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(sel.start_at))}
            </p>
            <p className="text-sm text-[#4A5061]">
              {sel.caller_name || 'Caller'}{sel.caller_phone ? ` · ${formatPhone(sel.caller_phone)}` : ''}{sel.service ? ` · ${sel.service}` : ''}
            </p>
            {sel.notes ? <p className="text-sm text-[#5B6070]">{sel.notes}</p> : null}
          </div>
          {sel.status === 'pending' ? (
            <div className="flex gap-2">
              <button onClick={() => onAct(sel.id, 'decline')} disabled={busyId === sel.id} className="rounded-full border border-[#D5D8E0] bg-white px-4 py-2 text-sm font-medium disabled:opacity-50">Decline</button>
              <button onClick={() => onAct(sel.id, 'confirm')} disabled={busyId === sel.id} className="rounded-full bg-[#1B2236] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {busyId === sel.id ? 'Confirming…' : 'Confirm'}
              </button>
            </div>
          ) : (
            <span className="text-sm text-[#5B6070]">{sel.status === 'confirmed' ? 'Confirmed' : 'Declined'}{sel.decided_by_label ? ` by ${sel.decided_by_label}` : ''}</span>
          )}
        </div>
      ) : null}
    </div>
  )
}
