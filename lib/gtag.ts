import { track as vercelTrack } from '@vercel/analytics'

// Marketing/product analytics: always sends to Vercel Web Analytics; GA4 only after cookie consent.
// Safe to call anywhere — GA no-ops during SSR, without consent, or if gtag is blocked.

export type AnalyticsEventParams = Record<string, string | number | boolean | undefined>

const MAX_VERCEL_FIELD_LEN = 255

function sanitizeVercelData(params?: AnalyticsEventParams) {
  if (!params) return undefined

  const data: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean' &&
      value !== null
    ) {
      continue
    }

    const safeKey = key.slice(0, MAX_VERCEL_FIELD_LEN)
    data[safeKey] =
      typeof value === 'string' ? value.slice(0, MAX_VERCEL_FIELD_LEN) : value
  }

  return Object.keys(data).length > 0 ? data : undefined
}

export function trackEvent(name: string, params?: AnalyticsEventParams) {
  if (typeof window !== 'undefined') {
    try {
      vercelTrack(name.slice(0, MAX_VERCEL_FIELD_LEN), sanitizeVercelData(params))
    } catch {
      // Vercel Analytics unavailable (local dev, ad blockers, etc.)
    }
  }

  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', name, params)
}
