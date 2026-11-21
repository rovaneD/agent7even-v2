import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Voix appointments: Voix offers a time inside the spa's booking windows and
 * records it as pending. The team confirms in the dashboard; confirming places
 * a short Retell callback to the client.
 */

export type BookingWindows = Record<string, [string, string][]> // weekday 0 (Sun)–6 (Sat) → [["10:00","17:00"]]

export type VoixAppointment = {
  id: string
  account_id: string
  retell_call_id: string | null
  caller_name: string | null
  caller_phone: string | null
  service: string | null
  notes: string | null
  start_at: string
  duration_min: number
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled'
  decided_at: string | null
  decided_by_label: string | null
  callback_status: 'none' | 'placed' | 'failed' | 'skipped'
  callback_call_id: string | null
  callback_error: string | null
  created_at: string
}

export const APPOINTMENT_SELECT =
  'id, account_id, retell_call_id, caller_name, caller_phone, service, notes, start_at, duration_min, status, decided_at, decided_by_label, callback_status, callback_call_id, callback_error, created_at'

export type Slot = { iso: string; label: string }

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** Calendar parts of an instant in a time zone. */
function zonedParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  return { y: Number(get('year')), m: Number(get('month')), d: Number(get('day')), h: Number(get('hour')), min: Number(get('minute')), wd }
}

/** The UTC instant for a wall-clock time in a time zone (DST-safe). */
export function zonedTimeToUtc(y: number, m: number, d: number, h: number, min: number, tz: string): Date {
  let guess = Date.UTC(y, m - 1, d, h, min)
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess), tz)
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min)
    guess += Date.UTC(y, m - 1, d, h, min) - asUtc
  }
  return new Date(guess)
}

export function slotLabel(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    .format(new Date(iso))
    .replace(':00', '')
}

/**
 * Open slots in the next `days` days, inside the booking windows, at least
 * `leadMinutes` from now, not overlapping pending or confirmed appointments.
 */
export async function openSlots(
  supabase: SupabaseClient,
  account: { id: string; timezone: string; booking_windows: BookingWindows; slot_minutes: number },
  opts: { days?: number; leadMinutes?: number; weekday?: number | null; timeOfDay?: 'morning' | 'afternoon' | 'evening' | null } = {},
): Promise<Slot[]> {
  const tz = account.timezone || 'America/Los_Angeles'
  const step = account.slot_minutes || 30
  const days = opts.days ?? 14
  const now = Date.now()
  const earliest = now + (opts.leadMinutes ?? 120) * 60_000
  const horizon = now + (days + 1) * 86_400_000

  const { data: taken } = await supabase
    .from('voix_appointments')
    .select('start_at, duration_min')
    .eq('account_id', account.id)
    .in('status', ['pending', 'confirmed'])
    .gte('start_at', new Date(now - 86_400_000).toISOString())
    .lte('start_at', new Date(horizon).toISOString())
  const busy = (taken ?? []).map((t) => {
    const s = new Date(t.start_at as string).getTime()
    return [s, s + (Number(t.duration_min) || step) * 60_000] as const
  })

  const out: Slot[] = []
  const today = zonedParts(new Date(now), tz)
  for (let i = 0; i <= days; i++) {
    const dayUtc = new Date(Date.UTC(today.y, today.m - 1, today.d + i, 12))
    const y = dayUtc.getUTCFullYear(), m = dayUtc.getUTCMonth() + 1, d = dayUtc.getUTCDate()
    const wd = dayUtc.getUTCDay()
    if (opts.weekday != null && wd !== opts.weekday) continue
    for (const [from, to] of account.booking_windows[String(wd)] ?? []) {
      const [fh, fm] = from.split(':').map(Number)
      const [th, tm] = to.split(':').map(Number)
      for (let t = fh * 60 + fm; t + step <= th * 60 + tm; t += step) {
        const hour = Math.floor(t / 60)
        if (opts.timeOfDay === 'morning' && hour >= 12) continue
        if (opts.timeOfDay === 'afternoon' && (hour < 12 || hour >= 17)) continue
        if (opts.timeOfDay === 'evening' && hour < 17) continue
        const start = zonedTimeToUtc(y, m, d, hour, t % 60, tz).getTime()
        const end = start + step * 60_000
        if (start < earliest) continue
        if (busy.some(([bs, be]) => start < be && end > bs)) continue
        out.push({ iso: new Date(start).toISOString(), label: slotLabel(new Date(start).toISOString(), tz) })
      }
    }
  }
  return out
}

/** "friday" / "tomorrow" / "today" → weekday number in the spa's time zone. */
export function parseWeekday(input: unknown, tz: string): number | null {
  if (typeof input !== 'string') return null
  const v = input.trim().toLowerCase()
  if (!v || v === 'any' || v === 'anytime') return null
  const today = zonedParts(new Date(), tz).wd
  if (v === 'today') return today
  if (v === 'tomorrow') return (today + 1) % 7
  const idx = WEEKDAYS.findIndex((w) => v.startsWith(w.slice(0, 3)))
  return idx >= 0 ? idx : null
}

/** A spread of up to `n` slots: the first open time on each of the next days. */
export function spread(slots: Slot[], n: number, tz: string): Slot[] {
  const byDay = new Map<string, Slot[]>()
  for (const s of slots) {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s.iso))
    byDay.set(key, [...(byDay.get(key) ?? []), s])
  }
  const out: Slot[] = []
  for (const list of byDay.values()) {
    out.push(list[0])
    if (list.length > 3) out.push(list[Math.floor(list.length / 2)])
    if (out.length >= n) break
  }
  return out.slice(0, n)
}

/** Places the confirmation callback through Retell. Returns the call id. */
export async function placeConfirmationCall(input: {
  fromNumber: string
  toNumber: string
  agentId: string
  spaName: string
  callerName: string | null
  service: string | null
  whenLabel: string
  appointmentId: string
}): Promise<string> {
  const apiKey = process.env.RETELL_API_KEY
  if (!apiKey) throw new Error('RETELL_API_KEY is not set')
  const spa = input.spaName.replace(/\s*\(demo\)\s*$/i, '')
  const first = input.callerName?.split(/\s+/)[0]
  const what = input.service ? `your ${input.service} appointment` : 'your appointment'
  const begin = `Hi${first ? ` ${first}` : ''}, this is ${spa}'s AI assistant calling to let you know ${what} on ${input.whenLabel} is confirmed. We look forward to seeing you. Is there anything else I can help with?`
  const res = await fetch('https://api.retellai.com/v2/create-phone-call', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from_number: input.fromNumber,
      to_number: input.toNumber,
      override_agent_id: input.agentId,
      agent_override: { retell_llm: { start_speaker: 'agent', begin_message: begin } },
      retell_llm_dynamic_variables: {
        call_purpose: 'confirmation',
        appointment_when: input.whenLabel,
        appointment_service: input.service ?? '',
        client_name: input.callerName ?? '',
      },
      metadata: { voix_appointment_id: input.appointmentId, kind: 'confirmation' },
    }),
  })
  const body = (await res.json().catch(() => ({}))) as { call_id?: string; message?: string; error_message?: string }
  if (!res.ok || !body.call_id) throw new Error(body.message || body.error_message || `Retell returned ${res.status}`)
  return body.call_id
}

export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits.length >= 11 ? digits : null
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}
