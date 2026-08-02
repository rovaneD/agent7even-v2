/**
 * Verifies Zernio OAuth callback refuses unbound profileId values.
 *
 * Usage: npx tsx scripts/verify-zernio-callback-profile-binding.ts
 */
import assert from 'node:assert/strict'
import {
  collectZernioProfileIds,
  isOwnedZernioCallbackProfileId,
} from '../lib/social/zernioOwnedProfileIds'

function main(): void {
  const tenant = {
    zernio_profile_id: 'zernio_owner_1',
    zernio_profile_ids: ['zernio_owner_1', 'zernio_owner_2'],
  }

  assert.deepEqual(collectZernioProfileIds(tenant), ['zernio_owner_1', 'zernio_owner_2'])

  assert.equal(isOwnedZernioCallbackProfileId(tenant, null), true)
  assert.equal(isOwnedZernioCallbackProfileId(tenant, undefined), true)
  assert.equal(isOwnedZernioCallbackProfileId(tenant, 'zernio_owner_1'), true)
  assert.equal(isOwnedZernioCallbackProfileId(tenant, 'zernio_owner_2'), true)

  // Cross-tenant / attacker-supplied id must fail closed.
  assert.equal(isOwnedZernioCallbackProfileId(tenant, 'zernio_victim_99'), false)
  assert.equal(isOwnedZernioCallbackProfileId({ zernio_profile_id: null, zernio_profile_ids: [] }, 'any'), false)
  assert.equal(isOwnedZernioCallbackProfileId({ zernio_profile_id: null, zernio_profile_ids: null }, 'any'), false)

  // Primary-only profiles still accept their primary id.
  assert.equal(
    isOwnedZernioCallbackProfileId({ zernio_profile_id: 'only_primary', zernio_profile_ids: null }, 'only_primary'),
    true,
  )

  console.log('PASS — zernio callback profile binding rejects unbound ids')
}

main()
