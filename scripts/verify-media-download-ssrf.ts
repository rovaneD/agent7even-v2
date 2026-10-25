/**
 * Static verification: /api/media/download must reject private/internal targets.
 *
 * Usage: npx tsx scripts/verify-media-download-ssrf.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isPublicIpAddress, validatePublicHttpsUrl } from '../lib/security/publicHttpUrl'

assert.equal(isPublicIpAddress('8.8.8.8'), true)
assert.equal(isPublicIpAddress('127.0.0.1'), false)
assert.equal(isPublicIpAddress('10.0.0.7'), false)
assert.equal(isPublicIpAddress('169.254.169.254'), false)
assert.equal(isPublicIpAddress('192.168.1.10'), false)
assert.equal(isPublicIpAddress('0.0.0.0'), false)
assert.equal(isPublicIpAddress('100.64.1.1'), false)
assert.equal(isPublicIpAddress('192.0.2.10'), false)
assert.equal(isPublicIpAddress('198.51.100.10'), false)
assert.equal(isPublicIpAddress('203.0.113.10'), false)
assert.equal(isPublicIpAddress('::1'), false)
assert.equal(isPublicIpAddress('fc00::1'), false)
assert.equal(isPublicIpAddress('::ffff:127.0.0.1'), false)
assert.equal(isPublicIpAddress('::ffff:7f00:1'), false)

async function main(): Promise<void> {
  const blocked = await Promise.all([
    validatePublicHttpsUrl('https://169.254.169.254/latest/meta-data/'),
    validatePublicHttpsUrl('https://127.0.0.1/secret'),
    validatePublicHttpsUrl('https://10.0.0.7/admin'),
    validatePublicHttpsUrl('https://[::1]/'),
    validatePublicHttpsUrl('https://[::ffff:127.0.0.1]/'),
    validatePublicHttpsUrl('https://[::ffff:7f00:1]/'),
    validatePublicHttpsUrl('https://metadata.google.internal/'),
    validatePublicHttpsUrl('https://service.internal/asset.jpg'),
    validatePublicHttpsUrl('http://example.com/asset.jpg'),
    validatePublicHttpsUrl('https://user:pass@example.com/asset.jpg'),
  ])

  assert.deepEqual(
    blocked.map(result => result.ok),
    [false, false, false, false, false, false, false, false, false, false],
  )

  // Path + query must be preserved for CDN media URLs
  const cdn = await validatePublicHttpsUrl(
    'https://example.com/path/to/asset.jpg?token=abc&x=1',
  )
  // example.com may resolve publicly in CI; if DNS fails, skip this assertion
  if (cdn.ok) {
    assert.equal(cdn.url, 'https://example.com/path/to/asset.jpg?token=abc&x=1')
  }

  const routeSrc = readFileSync(join(process.cwd(), 'app/api/media/download/route.ts'), 'utf8')
  assert.match(routeSrc, /validatePublicHttpsUrl/)
  assert.match(routeSrc, /fetchPublicBinary/)
  assert.doesNotMatch(routeSrc, /function isPublicHttpsUrl/)
  assert.doesNotMatch(routeSrc, /await res\.arrayBuffer\(\)/)
  assert.match(routeSrc, /redirect:\s*'manual'|fetchPublicBinary/)

  const fetchSrc = readFileSync(join(process.cwd(), 'lib/security/fetchPublicBinary.ts'), 'utf8')
  assert.match(fetchSrc, /redirect:\s*'manual'/)
  assert.match(fetchSrc, /assertPublicHttpsUrl/)
  assert.match(fetchSrc, /MAX_PUBLIC_BINARY_BYTES/)

  console.log('verify-media-download-ssrf: ok')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
