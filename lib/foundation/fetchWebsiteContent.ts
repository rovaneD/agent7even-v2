import dns from 'node:dns/promises'
import net from 'node:net'
import { exaReadSite } from '@/lib/research/exa'
import { normalizeWebsiteUrl } from '@/lib/maya/canonicalWebsite'

const MAX_HTML_BYTES = 1_000_000
const MAX_REDIRECTS = 3

export type WebsiteContent = {
  url: string
  title?: string
  text: string
  source: 'direct' | 'exa'
}

export class UnsafeWebsiteUrlError extends Error {
  constructor(message = 'Website URL must be a public http(s) address.') {
    super(message)
    this.name = 'UnsafeWebsiteUrlError'
  }
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(part => Number(part))
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  )
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (
    lower === '::' ||
    lower === '::1' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe80:')
  ) {
    return true
  }

  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  return mapped ? isPrivateIpv4(mapped[1]) : false
}

function isPrivateIp(ip: string): boolean {
  const family = net.isIP(ip)
  if (family === 4) return isPrivateIpv4(ip)
  if (family === 6) return isPrivateIpv6(ip)
  return true
}

async function assertPublicHttpUrl(rawUrl: string): Promise<string> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new UnsafeWebsiteUrlError('Website URL is invalid.')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnsafeWebsiteUrlError()
  }

  const hostname = parsed.hostname.toLowerCase()
  if (!hostname || hostname === 'localhost' || !hostname.includes('.')) {
    throw new UnsafeWebsiteUrlError()
  }

  const literalFamily = net.isIP(hostname)
  const addresses = literalFamily
    ? [{ address: hostname }]
    : await dns.lookup(hostname, { all: true, verbatim: true }).catch(() => [])

  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new UnsafeWebsiteUrlError()
  }

  return parsed.toString()
}

async function readLimitedText(res: Response): Promise<string> {
  const contentLength = Number(res.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
    throw new Error('Website response is too large.')
  }

  if (!res.body) return ''

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    received += value.byteLength
    if (received > MAX_HTML_BYTES) {
      await reader.cancel().catch(() => {})
      throw new Error('Website response is too large.')
    }
    chunks.push(value)
  }

  const merged = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }

  return new TextDecoder().decode(merged)
}

async function fetchWebsiteHtml(
  websiteUrl: string,
): Promise<{ status: number; finalUrl: string; html: string }> {
  let currentUrl = await assertPublicHttpUrl(websiteUrl)

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const res = await fetch(currentUrl, {
      headers: {
        'User-Agent': 'Agent7even-Foundation-Enrichment/1.0 (+https://www.agent7even.ai)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    })

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return { status: res.status, finalUrl: currentUrl, html: '' }
      currentUrl = await assertPublicHttpUrl(new URL(location, currentUrl).toString())
      continue
    }

    const html = await readLimitedText(res)
    return { status: res.status, finalUrl: currentUrl, html }
  }

  throw new Error('Too many website redirects.')
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000)
}

/** Fetch readable website text — direct fetch first, Exa fallback. */
export async function fetchWebsiteContent(rawUrl: string): Promise<WebsiteContent | null> {
  const websiteUrl = normalizeWebsiteUrl(rawUrl)
  if (!websiteUrl) return null
  const publicWebsiteUrl = await assertPublicHttpUrl(websiteUrl)

  try {
    const { finalUrl, html } = await fetchWebsiteHtml(publicWebsiteUrl)
    const text = htmlToText(html)
    if (text.length >= 200) {
      return { url: finalUrl, text, source: 'direct' }
    }
  } catch {
    // fall through to Exa
  }

  const exa = await exaReadSite(publicWebsiteUrl)
  if (exa?.text?.trim()) {
    return {
      url: exa.url,
      title: exa.title,
      text: exa.text.trim().slice(0, 8000),
      source: 'exa',
    }
  }

  return null
}
