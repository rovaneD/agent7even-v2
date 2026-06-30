import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { normalizeWebsiteUrl } from '../maya/canonicalWebsite'

export type PublicWebsiteUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: string }

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
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return false
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

export async function validatePublicWebsiteUrl(raw: string | null | undefined): Promise<PublicWebsiteUrlResult> {
  const normalized = normalizeWebsiteUrl(raw)
  if (!normalized) return { ok: false, reason: 'Enter a valid http(s) website URL.' }

  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    return { ok: false, reason: 'Enter a valid http(s) website URL.' }
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'Only http(s) website URLs are supported.' }
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    return { ok: false, reason: 'Enter a public website URL without credentials.' }
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '')
  if (isLocalHostname(hostname)) {
    return { ok: false, reason: 'Enter a public website URL.' }
  }

  const literalVersion = isIP(hostname)
  if (literalVersion && !isPublicIpAddress(hostname)) {
    return { ok: false, reason: 'Enter a public website URL.' }
  }

  try {
    const records = literalVersion
      ? [{ address: hostname }]
      : await lookup(hostname, { all: true, verbatim: true })
    if (!records.length || records.some(record => !isPublicIpAddress(record.address))) {
      return { ok: false, reason: 'Enter a public website URL.' }
    }
  } catch {
    return { ok: false, reason: 'Website host could not be resolved.' }
  }

  return { ok: true, url: parsed.toString().replace(/\/$/, '') }
}
