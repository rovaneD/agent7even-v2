/**
 * Outbound confirm/reschedule callbacks that never reached the client must be
 * recorded on the appointment. The previous confirmation must not close a
 * reschedule offer that is already in progress.
 *
 * Usage: npx tsx scripts/verify-voix-callback-result.ts
 */
import {
  CALLBACK_NO_ANSWER_NOTE,
  CALLBACK_VOICEMAIL_NOTE,
  callbackAppointmentUpdate,
  callbackKind,
  callbackResultNote,
} from '../lib/voix/callbackResult'

function fail(message: string): never {
  console.error(`FAIL · ${message}`)
  process.exit(1)
}

function assert(cond: unknown, message: string) {
  if (!cond) fail(message)
}

const missed = [
  'dial_no_answer',
  'dial_busy',
  'dial_failed',
  'invalid_destination',
  'marked_as_spam',
  'network_blocked',
  'user_declined',
  'ivr_reached',
  'telephony_provider_unavailable',
] as const

for (const reason of missed) {
  assert(callbackResultNote(reason) === CALLBACK_NO_ANSWER_NOTE, `${reason} should be no answer`)
}

assert(callbackResultNote('voicemail_reached') === CALLBACK_VOICEMAIL_NOTE, 'voicemail_reached')
assert(callbackResultNote('machine_detected') === CALLBACK_VOICEMAIL_NOTE, 'machine_detected')
assert(callbackResultNote('agent_hangup', true) === CALLBACK_VOICEMAIL_NOTE, 'in_voicemail backup')
assert(callbackResultNote('user_hangup') === null, 'an answered hangup is not a missed call')
assert(callbackResultNote('agent_hangup') === null, 'agent hangup after a conversation is not a missed call')
assert(callbackResultNote('') === null, 'missing reason')

assert(callbackKind({ metadataKind: 'confirmation' }) === 'confirmation', 'metadata confirmation')
assert(callbackKind({ metadataKind: 'reschedule' }) === 'reschedule', 'metadata reschedule')
assert(callbackKind({ callPurpose: 'reschedule' }) === 'reschedule', 'dynamic purpose reschedule')
assert(callbackKind({ dynamicAppointmentId: 'appt_1' }) === 'reschedule', 'dynamic appointment id is a reschedule')
assert(callbackKind({}) === 'unknown', 'missing kind')

const declinedOffer = callbackAppointmentUpdate({
  kind: 'reschedule',
  disconnectionReason: 'user_declined',
  rescheduleStatus: 'offered',
  storedCallId: 'call_confirm',
  eventCallId: 'call_reschedule',
})
assert(
  declinedOffer?.reschedule_status === 'callback_needed' && declinedOffer.callback_error === CALLBACK_NO_ANSWER_NOTE,
  'a declined reschedule is missed even while callback_call_id is still the confirmation',
)

const staleConfirm = callbackAppointmentUpdate({
  kind: 'confirmation',
  disconnectionReason: 'dial_no_answer',
  rescheduleStatus: 'offered',
  storedCallId: 'call_reschedule',
  eventCallId: 'call_confirm',
})
assert(staleConfirm === null, 'the confirmation no-answer must not close the new reschedule call')

const staleBeforeSwap = callbackAppointmentUpdate({
  kind: 'confirmation',
  disconnectionReason: 'dial_no_answer',
  rescheduleStatus: 'offered',
  storedCallId: 'call_confirm',
  eventCallId: 'call_confirm',
})
assert(staleBeforeSwap === null, 'a confirmation ending after the offer opens does not apply, even if its id is still stored')

const heard = callbackAppointmentUpdate({
  kind: 'reschedule',
  disconnectionReason: 'user_hangup',
  rescheduleStatus: 'offered',
  storedCallId: 'call_reschedule',
  eventCallId: 'call_reschedule',
})
assert(heard === null, 'hanging up after a conversation must not mark the offer missed')

const booked = callbackAppointmentUpdate({
  kind: 'reschedule',
  disconnectionReason: 'voicemail_reached',
  rescheduleStatus: 'rescheduled',
  storedCallId: 'call_reschedule',
  eventCallId: 'call_reschedule',
})
assert(booked === null, 'a finished reschedule is left alone')

const confirmDecline = callbackAppointmentUpdate({
  kind: 'confirmation',
  disconnectionReason: 'user_declined',
  rescheduleStatus: 'none',
  storedCallId: 'call_confirm',
  eventCallId: 'call_confirm',
})
assert(
  confirmDecline?.callback_error === CALLBACK_NO_ANSWER_NOTE && !confirmDecline.reschedule_status,
  'a declined confirmation is recorded without touching reschedule status',
)

const spam = callbackAppointmentUpdate({
  kind: 'reschedule',
  disconnectionReason: 'marked_as_spam',
  rescheduleStatus: 'offered',
  storedCallId: null,
  eventCallId: 'call_reschedule',
})
assert(spam?.reschedule_status === 'callback_needed', 'a spam-blocked offer needs a person to call')

const unknownOld = callbackAppointmentUpdate({
  kind: 'unknown',
  disconnectionReason: 'dial_no_answer',
  rescheduleStatus: 'offered',
  storedCallId: 'call_new',
  eventCallId: 'call_old',
})
assert(unknownOld === null, 'without a callback kind, a different call id does not close the offer')

const ivr = callbackAppointmentUpdate({
  kind: 'confirmation',
  disconnectionReason: 'ivr_reached',
  rescheduleStatus: 'none',
  storedCallId: 'call_confirm',
  eventCallId: 'call_confirm',
})
assert(ivr?.callback_error === CALLBACK_NO_ANSWER_NOTE, 'an IVR hangup is not a successful confirmation')

console.log('ok · voix callback result')
