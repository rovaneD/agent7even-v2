export const GA_MEASUREMENT_ID = 'G-8913QV8Z1M'

export const COOKIE_CONSENT_STORAGE_KEY = 'a7e_cookie_consent_v1'
export const COOKIE_CONSENT_UPDATED_EVENT = 'a7e:cookie-consent-updated'

export type CookieConsentChoice = 'accepted' | 'rejected'

export function parseCookieConsentChoice(value: string | null): CookieConsentChoice | null {
  return value === 'accepted' || value === 'rejected' ? value : null
}

export function getCookieConsent(): CookieConsentChoice | null {
  if (typeof window === 'undefined') return null
  try {
    return parseCookieConsentChoice(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY))
  } catch {
    return null
  }
}

export function setCookieConsent(choice: CookieConsentChoice) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice)
  } catch {
    // Keep the current-page choice usable when storage is blocked.
  }
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_UPDATED_EVENT, { detail: choice }))
}

export function hasAnalyticsConsent() {
  return getCookieConsent() === 'accepted'
}
