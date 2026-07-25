/**
 * Pure public-website URL validation checks (no network to private targets).
 * Usage: npx tsx scripts/verify-public-website-url.ts
 */
import assert from 'node:assert/strict'
import { normalizeWebsiteUrl } from '../lib/maya/canonicalWebsite'
import {
  isPublicIpAddress,
  validatePublicWebsiteUrl,
} from '../lib/security/publicWebsiteUrl'

assert.equal(normalizeWebsiteUrl('example.com'), 'https://example.com')
assert.equal(normalizeWebsiteUrl('https://example.com/'), 'https://example.com')
assert.equal(normalizeWebsiteUrl('ftp://example.com'), null)
assert.equal(normalizeWebsiteUrl('not a url'), null)

assert.equal(isPublicIpAddress('8.8.8.8'), true)
assert.equal(isPublicIpAddress('127.0.0.1'), false)
assert.equal(isPublicIpAddress('10.0.0.7'), false)
assert.equal(isPublicIpAddress('169.254.169.254'), false)
assert.equal(isPublicIpAddress('192.168.1.10'), false)
assert.equal(isPublicIpAddress('192.0.2.10'), false)
assert.equal(isPublicIpAddress('198.51.100.10'), false)
assert.equal(isPublicIpAddress('203.0.113.10'), false)
assert.equal(isPublicIpAddress('::1'), false)
assert.equal(isPublicIpAddress('fc00::1'), false)
assert.equal(isPublicIpAddress('::ffff:127.0.0.1'), false)
assert.equal(isPublicIpAddress('::ffff:7f00:1'), false)

async function main(): Promise<void> {
  const blocked = await Promise.all([
    validatePublicWebsiteUrl('http://localhost'),
    validatePublicWebsiteUrl('http://127.0.0.1'),
    validatePublicWebsiteUrl('http://10.0.0.7'),
    validatePublicWebsiteUrl('http://169.254.169.254/latest/meta-data'),
    validatePublicWebsiteUrl('http://[::1]/'),
    validatePublicWebsiteUrl('http://[::ffff:7f00:1]/'),
    validatePublicWebsiteUrl('http://service.internal'),
    validatePublicWebsiteUrl('ftp://example.com'),
  ])

  assert.deepEqual(
    blocked.map(result => result.ok),
    [false, false, false, false, false, false, false, false],
  )

  console.log('public website URL validation checks passed')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
