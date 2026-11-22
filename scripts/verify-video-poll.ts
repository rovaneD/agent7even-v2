/**
 * A status poll that fails must not be treated as a finished video.
 * The create panel is the only thing that keeps filming and cutting moving.
 */
import assert from 'node:assert/strict'
import { videoPollAdvance } from '../lib/agents/videoGeneration/videoPoll'

const rendering = videoPollAdvance('rendering', { httpOk: false })
assert.equal(rendering.status, 'rendering')
assert.equal(rendering.keepPolling, true)

const notJson = videoPollAdvance('editing', { httpOk: true, status: null })
assert.equal(notJson.status, 'editing')
assert.equal(notJson.keepPolling, true)

const empty = videoPollAdvance('rendering', { httpOk: true, status: '' })
assert.equal(empty.keepPolling, true)

const httpError = videoPollAdvance('rendering', { httpOk: false, status: 'failed' })
assert.equal(httpError.status, 'rendering')
assert.equal(httpError.keepPolling, true)

const stillFilming = videoPollAdvance('rendering', { httpOk: true, status: 'rendering' })
assert.equal(stillFilming.status, 'rendering')
assert.equal(stillFilming.keepPolling, true)

const cutting = videoPollAdvance('rendering', { httpOk: true, status: 'editing' })
assert.equal(cutting.status, 'editing')
assert.equal(cutting.keepPolling, true)

const done = videoPollAdvance('editing', { httpOk: true, status: 'completed' })
assert.equal(done.status, 'completed')
assert.equal(done.keepPolling, false)

const refunded = videoPollAdvance('rendering', { httpOk: true, status: 'failed' })
assert.equal(refunded.status, 'failed')
assert.equal(refunded.keepPolling, false)

const leftReview = videoPollAdvance('rendering', { httpOk: true, status: 'review' })
assert.equal(leftReview.status, 'rendering')
assert.equal(leftReview.keepPolling, false)

console.log('verify-video-poll: ok')
