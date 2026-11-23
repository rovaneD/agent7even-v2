/**
 * A reschedule call may create one follow-up. A second tool call must not book
 * again, and a still-pending request must not look like a finished reschedule.
 *
 * Usage: npx tsx scripts/verify-voix-reschedule.ts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { outcomeLine } from '../app/voix/app/[accountId]/appointments/outcome'
import type { VoixAppointment } from '../lib/voix/appointments'
import {
  decideRescheduleFollowUp,
  offeredInstants,
  rescheduleOfferOpen,
  RESCHEDULE_NO_CHOICE,
  RESCHEDULE_OTHER_TIME,
} from '../lib/voix/reschedule'

const offered = '2026-11-24T19:00:00.000Z'
const other = '2026-11-25T20:00:00.000Z'

assert.deepEqual(offeredInstants([offered, 'nope', 12, null]), [new Date(offered).getTime()])
assert.deepEqual(offeredInstants('not-an-array'), [])

assert.equal(
  decideRescheduleFollowUp({
    rescheduleStatus: 'offered',
    requestedIso: '2026-11-24T19:00:00Z',
    alternatives: [offered],
  }),
  'book_offered',
)
assert.equal(
  decideRescheduleFollowUp({
    rescheduleStatus: 'offered',
    requestedIso: other,
    alternatives: [offered],
  }),
  'request_other',
)
for (const status of ['rescheduled', 'callback_needed', 'none', null]) {
  assert.equal(
    decideRescheduleFollowUp({ rescheduleStatus: status, requestedIso: offered, alternatives: [offered] }),
    'already_settled',
    status ?? 'null',
  )
}
assert.equal(
  decideRescheduleFollowUp({ rescheduleStatus: 'offered', requestedIso: null, alternatives: [offered] }),
  'request_other',
)

// The call's own webhook can mark "no choice" while the tool is still saving.
// That row is still the open offer. A different callback note is finished.
assert.equal(rescheduleOfferOpen('offered', null), true)
assert.equal(rescheduleOfferOpen('callback_needed', RESCHEDULE_NO_CHOICE), true)
assert.equal(rescheduleOfferOpen('callback_needed', RESCHEDULE_OTHER_TIME), false)
assert.equal(rescheduleOfferOpen('callback_needed', 'Retell returned 500'), false)
assert.equal(rescheduleOfferOpen('rescheduled', RESCHEDULE_NO_CHOICE), false)
assert.equal(
  decideRescheduleFollowUp({
    rescheduleStatus: 'callback_needed',
    callbackError: RESCHEDULE_NO_CHOICE,
    requestedIso: offered,
    alternatives: [offered],
  }),
  'book_offered',
)
assert.equal(
  decideRescheduleFollowUp({
    rescheduleStatus: 'callback_needed',
    callbackError: RESCHEDULE_OTHER_TIME,
    requestedIso: offered,
    alternatives: [offered],
  }),
  'already_settled',
)

function appt(patch: Partial<VoixAppointment>): VoixAppointment {
  return {
    id: 'a',
    account_id: 'acct',
    retell_call_id: null,
    caller_name: 'Ada',
    caller_phone: '+15555550100',
    service: 'Facial',
    notes: null,
    start_at: offered,
    duration_min: 30,
    status: 'cancelled',
    decided_at: null,
    decided_by_label: 'Rovane',
    callback_status: 'placed',
    callback_call_id: 'call_1',
    callback_error: null,
    alternatives: [offered],
    reschedule_status: 'offered',
    rescheduled_from: null,
    created_at: offered,
    ...patch,
  }
}

const tz = 'America/Los_Angeles'
assert.equal(outcomeLine(appt({ reschedule_status: 'rescheduled' }), tz)?.text, 'Rescheduled: the client picked a new time')
const otherLine = outcomeLine(appt({ reschedule_status: 'callback_needed', callback_error: RESCHEDULE_OTHER_TIME }), tz)
assert.equal(otherLine?.text, RESCHEDULE_OTHER_TIME)
assert.equal(otherLine?.tone, 'warn')
assert.equal(otherLine?.text.includes('Call the client'), false)
const missed = outcomeLine(appt({ reschedule_status: 'callback_needed', callback_error: RESCHEDULE_NO_CHOICE }), tz)
assert.equal(missed?.text, `Call the client to reschedule (${RESCHEDULE_NO_CHOICE})`)
assert.match(outcomeLine(appt({ reschedule_status: 'offered' }), tz)?.text ?? '', /^Voix is calling to offer /)

const root = resolve(process.cwd())
const tools = readFileSync(resolve(root, 'app/api/voix/retell/tools/route.ts'), 'utf8')
const ingest = readFileSync(resolve(root, 'lib/voix/ingest.ts'), 'utf8')
const decide = readFileSync(resolve(root, 'app/api/voix/appointments/route.ts'), 'utf8')

assert.equal(tools.includes("update({ reschedule_status: 'rescheduled' }).eq('id', fromAppt)"), false)
assert.match(tools, /\.eq\('reschedule_status', 'offered'\)/)
assert.match(tools, /RESCHEDULE_NO_CHOICE/)
assert.match(tools, /releaseOffer\(/)
assert.match(ingest, /RESCHEDULE_NO_CHOICE/)
assert.match(ingest, /\.eq\('reschedule_status', 'offered'\)/)
assert.match(decide, /\.eq\('status', moving \? 'confirmed' : 'pending'\)/)
assert.match(decide, /reschedule_status: wantsCall \? 'offered' : 'none',[\s\S]*?callback_call_id: null/)

console.log('ok · voix reschedule books once and does not look finished early')
