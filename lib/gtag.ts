// Lightweight GA4 event helper for the G-8913QV8Z1M tag loaded in app/layout.tsx.
// Safe to call anywhere — no-ops during SSR or if gtag hasn't loaded (ad blockers).

type GtagParams = Record<string, string | number | boolean | undefined>

export function trackEvent(name: string, params?: GtagParams) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', name, params)
}
