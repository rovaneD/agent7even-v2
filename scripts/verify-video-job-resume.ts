/**
 * Presenter / B-roll resume rules: a voice step with no provider job is abandoned only after
 * the start request's maxDuration has definitely elapsed.
 */
import assert from 'node:assert/strict'
import { ABANDONED_VOICE_START_MS, voiceStartAbandoned } from '../lib/agents/videoGeneration/videoJobResume'

const start = Date.parse('2026-10-25T11:00:00.000Z')

assert.equal(voiceStartAbandoned(undefined, start + 60_000), false)
assert.equal(voiceStartAbandoned('', start), false)
assert.equal(voiceStartAbandoned('not-a-date', start), false)
assert.equal(voiceStartAbandoned(new Date(start).toISOString(), start + ABANDONED_VOICE_START_MS - 1), false)
assert.equal(voiceStartAbandoned(new Date(start).toISOString(), start + 5 * 60_000), false)
assert.equal(voiceStartAbandoned(new Date(start).toISOString(), start + ABANDONED_VOICE_START_MS), true)
assert.equal(voiceStartAbandoned(new Date(start).toISOString(), start + 30 * 60_000), true)

console.log('verify-video-job-resume: ok')
