// Lightweight GA4 event helper — loads only after analytics cookie consent.
// Safe to call anywhere — no-ops during SSR or if gtag hasn't loaded (ad blockers / rejected consent).

type GtagParams = Record<string, string | number | boolean | undefined>

export function trackEvent(name: string, params?: GtagParams) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', name, params)
}
