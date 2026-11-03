/**
 * Product ad resume: a filming claim with no provider job is abandoned only after the start
 * request's maxDuration has definitely elapsed, and the dashboard poll covers that stage.
 */
import assert from 'node:assert/strict'
import {
  PRODUCT_AD_POLL_STAGES,
  PRODUCT_AD_START_ABANDON_MS,
  productAdStartAbandoned,
} from '../lib/agents/videoGeneration/productAdJob'

const start = Date.parse('2026-11-03T11:00:00.000Z')

assert.equal(productAdStartAbandoned(undefined, start + 60_000), false)
assert.equal(productAdStartAbandoned('', start), false)
assert.equal(productAdStartAbandoned('not-a-date', start), false)
assert.equal(productAdStartAbandoned(new Date(start).toISOString(), start + PRODUCT_AD_START_ABANDON_MS - 1), false)
assert.equal(productAdStartAbandoned(new Date(start).toISOString(), start + 5 * 60_000), false)
assert.equal(productAdStartAbandoned(new Date(start).toISOString(), start + PRODUCT_AD_START_ABANDON_MS), true)
assert.equal(productAdStartAbandoned(new Date(start).toISOString(), start + 30 * 60_000), true)

assert.deepEqual([...PRODUCT_AD_POLL_STAGES], ['starting', 'rendering', 'editing'])
assert.equal(PRODUCT_AD_POLL_STAGES.includes('review' as never), false)
assert.ok(PRODUCT_AD_START_ABANDON_MS > 300_000)

console.log('verify-product-ad-resume: ok')
