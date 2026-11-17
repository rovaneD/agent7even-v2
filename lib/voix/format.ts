import type { VoixSnoozePreset } from '@/lib/voix/types'

/** "(415) 555-0134" for US numbers, otherwise the raw value. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return 'Unknown number'
  const digits = value.replace(/\D/g, '')
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return value
}

export function formatDuration(sec: number | null | undefined): string {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`
}

export function formatDateTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

/** "Today", "Yesterday" or "Mon, Nov 16" in the account's timezone. */
export function dayLabel(iso: string, timeZone: string, now = new Date()): string {
  const key = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  const day = key(new Date(iso))
  if (day === key(now)) return 'Today'
  if (day === key(new Date(now.getTime() - 86_400_000))) return 'Yesterday'
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' }).format(
    new Date(iso),
  )
}

export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.round((now - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return `${d}d ago`
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short',
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0'
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekday: get('weekday'),
  }
}

/** UTC instant for a wall-clock time in a timezone (handles DST). */
export function zonedTimeToUtc(
  y: number,
  m: number,
  d: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(y, m - 1, d, hour, minute)
  const p = zonedParts(new Date(guess), timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return new Date(guess - (asUtc - guess))
}

/** Start of "today" in the timezone, as a UTC Date. */
export function startOfZonedDay(timeZone: string, now = new Date(), offsetDays = 0): Date {
  const p = zonedParts(now, timeZone)
  const base = new Date(Date.UTC(p.year, p.month - 1, p.day + offsetDays))
  return zonedTimeToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), 0, 0, timeZone)
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function snoozeUntil(preset: VoixSnoozePreset, timeZone: string, now = new Date()): Date {
  if (preset === '1h') return new Date(now.getTime() + 3_600_000)
  if (preset === '3h') return new Date(now.getTime() + 3 * 3_600_000)
  const p = zonedParts(now, timeZone)
  let addDays = 1
  if (preset === 'next_week') {
    const dow = WEEKDAYS.indexOf(p.weekday)
    addDays = ((8 - dow) % 7) || 7
  }
  const target = new Date(Date.UTC(p.year, p.month - 1, p.day + addDays))
  return zonedTimeToUtc(target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate(), 9, 0, timeZone)
}
