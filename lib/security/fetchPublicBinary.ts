import { assertPublicHttpsUrl } from '@/lib/security/publicHttpUrl'

/** Enough for post/creative images; blocks unbounded memory from hostile responses. */
export const MAX_PUBLIC_BINARY_BYTES = 25 * 1024 * 1024
const MAX_REDIRECTS = 3
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

async function readLimitedBytes(
  res: Response,
  maxBytes = MAX_PUBLIC_BINARY_BYTES,
): Promise<Uint8Array> {
  const contentLength = Number(res.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error('Response is too large.')
  }

  if (!res.body) {
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.byteLength > maxBytes) {
      throw new Error('Response is too large.')
    }
    return new Uint8Array(buffer)
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
        throw new Error('Response is too large.')
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
  return merged
}

/**
 * Fetch binary bytes from a public https URL only.
 * Validates the start URL and every redirect hop; caps response size.
 */
export async function fetchPublicBinary(
  mediaUrl: string,
  options?: {
    timeoutMs?: number
    maxBytes?: number
  },
): Promise<{ status: number; finalUrl: string; bytes: Uint8Array; contentType: string | null }> {
  let currentUrl = await assertPublicHttpsUrl(mediaUrl)
  const timeoutMs = options?.timeoutMs ?? 20000
  const maxBytes = options?.maxBytes ?? MAX_PUBLIC_BINARY_BYTES

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const res = await fetch(currentUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (REDIRECT_STATUSES.has(res.status)) {
      const location = res.headers.get('location')
      if (!location) {
        return {
          status: res.status,
          finalUrl: currentUrl,
          bytes: new Uint8Array(),
          contentType: null,
        }
      }
      if (redirectCount === MAX_REDIRECTS) {
        throw new Error('Too many redirects.')
      }
      currentUrl = await assertPublicHttpsUrl(new URL(location, currentUrl).toString())
      continue
    }

    const bytes = await readLimitedBytes(res, maxBytes)
    return {
      status: res.status,
      finalUrl: currentUrl,
      bytes,
      contentType: res.headers.get('content-type'),
    }
  }

  throw new Error('Too many redirects.')
}
