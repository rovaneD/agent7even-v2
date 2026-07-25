import { assertPublicWebsiteUrl } from '@/lib/security/publicWebsiteUrl'

const MAX_HTML_BYTES = 1_000_000
const MAX_REDIRECTS = 3
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

async function readLimitedText(res: Response, maxBytes = MAX_HTML_BYTES): Promise<string> {
  const contentLength = Number(res.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error('Website response is too large.')
  }

  if (!res.body) {
    const text = await res.text()
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new Error('Website response is too large.')
    }
    return text
  }

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      received += value.byteLength
      if (received > maxBytes) {
        await reader.cancel().catch(() => {})
        throw new Error('Website response is too large.')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const merged = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }

  return new TextDecoder().decode(merged)
}

/**
 * Fetch HTML from a public http(s) URL only.
 * Validates the start URL and every redirect hop; caps response size.
 */
export async function fetchPublicWebsiteHtml(
  websiteUrl: string,
  options?: {
    userAgent?: string
    timeoutMs?: number
    accept?: string
  },
): Promise<{ status: number; finalUrl: string; html: string }> {
  let currentUrl = await assertPublicWebsiteUrl(websiteUrl)
  const timeoutMs = options?.timeoutMs ?? 15000
  const userAgent =
    options?.userAgent ?? 'Agent7even-Website-Fetch/1.0 (+https://www.agent7even.ai)'
  const accept = options?.accept ?? 'text/html,application/xhtml+xml'

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const res = await fetch(currentUrl, {
      headers: {
        'User-Agent': userAgent,
        Accept: accept,
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (REDIRECT_STATUSES.has(res.status)) {
      const location = res.headers.get('location')
      if (!location) {
        return { status: res.status, finalUrl: currentUrl, html: '' }
      }
      if (redirectCount === MAX_REDIRECTS) {
        throw new Error('Too many website redirects.')
      }
      currentUrl = await assertPublicWebsiteUrl(new URL(location, currentUrl).toString())
      continue
    }

    const html = await readLimitedText(res)
    return { status: res.status, finalUrl: currentUrl, html }
  }

  throw new Error('Too many website redirects.')
}
