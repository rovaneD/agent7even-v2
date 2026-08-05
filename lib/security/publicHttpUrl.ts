import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export type PublicHttpUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: string }

export class UnsafePublicHttpUrlError extends Error {
  constructor(message = 'URL must be a public https address.') {
    super(message)
    this.name = 'UnsafePublicHttpUrlError'
  }
}

function isPublicIpv4(address: string): boolean {
  const parts = address.split('.').map(part => Number(part))
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }

  const [a, b, c] = parts
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false
  if (a === 100 && b >= 64 && b <= 127) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) return false
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false
  if (a === 203 && b === 0 && c === 113) return false
  return true
}

function isPublicIpv6(address: string): boolean {
  const lower = address.toLowerCase()
  if (lower === '::' || lower === '::1') return false
  if (lower.startsWith('fc') || lower.startsWith('fd')) return false
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
    return false
  }
  if (lower.startsWith('ff')) return false

  const mapped = lower.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (mapped) return isPublicIpv4(mapped[1])

  const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (mappedHex) {
    const high = Number.parseInt(mappedHex[1], 16)
    const low = Number.parseInt(mappedHex[2], 16)
    const ipv4 = `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`
    return isPublicIpv4(ipv4)
  }

  return true
}

export function isPublicIpAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return isPublicIpv4(address)
  if (version === 6) return isPublicIpv6(address)
  return false
}

function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === 'local' ||
    host.endsWith('.local') ||
    host === 'internal' ||
    host.endsWith('.internal') ||
    host === 'lan' ||
    host.endsWith('.lan')
  )
}

/**
 * Require a public https URL before any server-side media proxy fetch.
 * Rejects credentials, localhost/internal hosts, private/reserved IPs,
 * and DNS records that resolve to non-public addresses.
 * Preserves path/query (unlike website normalization).
 */
export async function validatePublicHttpsUrl(
  raw: string | null | undefined,
): Promise<PublicHttpUrlResult> {
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  if (!trimmed) return { ok: false, reason: 'Enter a valid https URL.' }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, reason: 'Enter a valid https URL.' }
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Only https URLs are supported.' }
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    return { ok: false, reason: 'Enter a public https URL without credentials.' }
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '')
  if (isLocalHostname(hostname)) {
    return { ok: false, reason: 'Enter a public https URL.' }
  }

  const literalVersion = isIP(hostname)
  if (literalVersion && !isPublicIpAddress(hostname)) {
    return { ok: false, reason: 'Enter a public https URL.' }
  }

  try {
    const records = literalVersion
      ? [{ address: hostname }]
      : await lookup(hostname, { all: true, verbatim: true })
    if (!records.length || records.some(record => !isPublicIpAddress(record.address))) {
      return { ok: false, reason: 'Enter a public https URL.' }
    }
  } catch {
    return { ok: false, reason: 'Host could not be resolved.' }
  }

  return { ok: true, url: parsed.toString() }
}

export async function assertPublicHttpsUrl(raw: string | null | undefined): Promise<string> {
  const result = await validatePublicHttpsUrl(raw)
  if (!result.ok) throw new UnsafePublicHttpUrlError(result.reason)
  return result.url
}
