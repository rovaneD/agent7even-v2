import type { VoixFollowupReason, VoixOutcome } from '@/lib/voix/types'

export function followupReasonFor(outcome: VoixOutcome | null | undefined, urgent: boolean, text: string | null): VoixFollowupReason {
  if (outcome === 'clinical') return 'clinical'
  if (outcome === 'complaint') return 'complaint'
  if (outcome === 'callback_needed') return 'callback_needed'
  if (text && /book|appoint|schedul/i.test(text)) return 'booking_failed'
  if (urgent) return 'urgent'
  return 'other'
}
