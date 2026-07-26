/**
 * Verifies admin account deletion fails closed when Stripe cancel cannot run.
 *
 * Usage:
 *   npx tsx scripts/verify-admin-delete-stripe-cancel.ts
 */
import assert from 'node:assert/strict'
import {
  cancelStripeSubscriptionBeforeDelete,
  isBenignStripeCancelError,
  type StripeCancelClient,
} from '../lib/admin/deleteClientAccount'

function mockStripe(opts: {
  status?: string
  retrieveError?: unknown
  cancelError?: unknown
}): StripeCancelClient {
  return {
    subscriptions: {
      async retrieve() {
        if (opts.retrieveError) throw opts.retrieveError
        return { status: opts.status ?? 'active' }
      },
      async cancel() {
        if (opts.cancelError) throw opts.cancelError
        return { status: 'canceled' }
      },
    },
  }
}

async function main() {
  assert.equal(isBenignStripeCancelError({ code: 'resource_missing' }), true)
  assert.equal(isBenignStripeCancelError({ code: 'card_error' }), false)
  assert.equal(isBenignStripeCancelError(new Error('network')), false)

  const missingClient = await cancelStripeSubscriptionBeforeDelete('sub_123', null)
  assert.equal(missingClient?.ok, false)
  assert.equal(missingClient && !missingClient.ok ? missingClient.status : null, 503)

  const cancelFail = await cancelStripeSubscriptionBeforeDelete(
    'sub_123',
    mockStripe({ cancelError: { code: 'api_error', message: 'boom' } }),
  )
  assert.equal(cancelFail?.ok, false)
  assert.equal(cancelFail && !cancelFail.ok ? cancelFail.status : null, 502)

  const alreadyCanceled = await cancelStripeSubscriptionBeforeDelete(
    'sub_123',
    mockStripe({ status: 'canceled' }),
  )
  assert.equal(alreadyCanceled, null)

  const missingSub = await cancelStripeSubscriptionBeforeDelete(
    'sub_123',
    mockStripe({ retrieveError: { code: 'resource_missing' } }),
  )
  assert.equal(missingSub, null)

  const ok = await cancelStripeSubscriptionBeforeDelete('sub_123', mockStripe({ status: 'active' }))
  assert.equal(ok, null)

  console.log('PASS · admin delete Stripe cancel fails closed')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
