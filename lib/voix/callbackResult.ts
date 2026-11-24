/**
 * What an outbound confirm/reschedule callback did, from the call_ended payload.
 *
 * call_ended does not include call_analysis. Voicemail and IVR show up as
 * disconnection_reason (Retell: voicemail_reached, or ivr_reached when a
 * voicemail is classified as a phone menu). A declined or carrier-blocked
 * dial is not_connected — the client never heard the message.
 *
 * A confirmation call_ended can arrive after staff have already started a
 * reschedule. That older call must not close the new offer. A reschedule
 * call is the offer itself, even when callback_call_id still holds the
 * confirmation id (that column is written after Retell returns the new id).
 */

const VOICEMAIL = new Set(['voicemail_reached', 'machine_detected'])

/** Retell call status not_connected, plus an IVR hangup (no person heard the call). */
const NOT_REACHED = new Set([
  'dial_no_answer',
  'dial_busy',
  'dial_failed',
  'invalid_destination',
  'telephony_provider_permission_denied',
  'telephony_provider_unavailable',
  'sip_routing_error',
  'marked_as_spam',
  'network_blocked',
  'user_declined',
  'ivr_reached',
])

export const CALLBACK_VOICEMAIL_NOTE = 'Voicemail: Voix left a message'
export const CALLBACK_NO_ANSWER_NOTE = 'No answer'

export type CallbackKind = 'confirmation' | 'reschedule' | 'unknown'

export function callbackKind(input: {
  metadataKind?: unknown
  callPurpose?: unknown
  dynamicAppointmentId?: unknown
}): CallbackKind {
  const kind = typeof input.metadataKind === 'string' ? input.metadataKind : ''
  if (kind === 'confirmation' || kind === 'reschedule') return kind
  const purpose = typeof input.callPurpose === 'string' ? input.callPurpose : ''
  if (purpose === 'confirmation' || purpose === 'reschedule') return purpose
  if (typeof input.dynamicAppointmentId === 'string' && input.dynamicAppointmentId.trim()) return 'reschedule'
  return 'unknown'
}

export function callbackResultNote(
  disconnectionReason: string | null | undefined,
  inVoicemail = false,
): string | null {
  const reason = disconnectionReason ?? ''
  if (VOICEMAIL.has(reason) || inVoicemail) return CALLBACK_VOICEMAIL_NOTE
  if (NOT_REACHED.has(reason)) return CALLBACK_NO_ANSWER_NOTE
  return null
}

/** True when this call_ended is still the callback stored on the appointment. */
export function callbackResultApplies(storedCallId: string | null | undefined, eventCallId: string | null | undefined): boolean {
  if (!eventCallId) return false
  if (!storedCallId) return true
  return storedCallId === eventCallId
}

export function callbackAppointmentUpdate(input: {
  kind: CallbackKind
  disconnectionReason: string | null | undefined
  inVoicemail?: boolean
  rescheduleStatus: string | null | undefined
  storedCallId: string | null | undefined
  eventCallId: string | null | undefined
}): { callback_error: string; reschedule_status?: 'callback_needed' } | null {
  const note = callbackResultNote(input.disconnectionReason, input.inVoicemail === true)
  if (!note) return null
  const status = input.rescheduleStatus ?? 'none'
  if (status === 'rescheduled') return null

  if (input.kind === 'confirmation') {
    if (status !== 'none') return null
    if (!callbackResultApplies(input.storedCallId, input.eventCallId)) return null
    return { callback_error: note }
  }

  if (input.kind === 'unknown' && !callbackResultApplies(input.storedCallId, input.eventCallId)) return null

  if (status === 'offered') return { callback_error: note, reschedule_status: 'callback_needed' }
  return { callback_error: note }
}
