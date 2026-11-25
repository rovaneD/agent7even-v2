import type { VoixAppointment } from '@/lib/voix/appointments'
import { RESCHEDULE_OTHER_TIME } from '@/lib/voix/reschedule'

/** One line saying what happened after the team decided. */
export function outcomeLine(a: VoixAppointment, tz: string): { text: string; tone: 'muted' | 'warn' | 'good' } | null {
  const short = (iso: string) =>
    new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
  if (a.status === 'declined' || a.status === 'cancelled') {
    const verb = a.status === 'cancelled' ? 'Cancelled' : 'Declined'
    if (a.reschedule_status === 'rescheduled') return { text: 'Rescheduled: the client picked a new time', tone: 'good' }
    if (a.reschedule_status === 'callback_needed') {
      if (a.callback_error === RESCHEDULE_OTHER_TIME) return { text: RESCHEDULE_OTHER_TIME, tone: 'warn' }
      return { text: `Call the client to reschedule${a.callback_error ? ` (${a.callback_error})` : ''}`, tone: 'warn' }
    }
    if (a.reschedule_status === 'offered') {
      const offered = (a.alternatives ?? []).map(short)
      return { text: offered.length ? `Voix is calling to offer ${offered.join(', ')}` : 'Voix is calling to ask what works instead', tone: 'muted' }
    }
    return { text: `${verb}${a.decided_by_label ? ` by ${a.decided_by_label}` : ''}`, tone: 'muted' }
  }
  if (a.status === 'confirmed') {
    const who = a.decided_by_label ? `Confirmed by ${a.decided_by_label}` : 'Confirmed'
    if (a.rescheduled_from) return { text: `${who} (rescheduled)`, tone: 'good' }
    if (a.callback_status === 'placed' && a.callback_error?.startsWith('Voicemail')) return { text: `${who} · Voix left the client a voicemail`, tone: 'muted' }
    if (a.callback_status === 'placed' && a.callback_error === 'No answer') return { text: `${who} · Client didn't answer the confirmation call`, tone: 'warn' }
    if (a.callback_status === 'placed') return { text: `${who} · Voix called the client to confirm`, tone: 'good' }
    if (a.callback_status === 'failed') return { text: `${who} · Callback failed${a.callback_error ? ` (${a.callback_error})` : ''}`, tone: 'warn' }
    return { text: who, tone: 'muted' }
  }
  return null
}
