export const GA_MEASUREMENT_ID = 'G-8913QV8Z1M'

export const COOKIE_CONSENT_STORAGE_KEY = 'a7e_cookie_consent_v1'
export const COOKIE_CONSENT_UPDATED_EVENT = 'a7e:cookie-consent-updated'

export type CookieConsentChoice = 'accepted' | 'rejected'

export function getCookieConsent(): CookieConsentChoice | null {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
  if (value === 'accepted' || value === 'rejected') return value
  return null
}

export function setCookieConsent(choice: CookieConsentChoice) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice)
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_UPDATED_EVENT, { detail: choice }))
}

export function hasAnalyticsConsent() {
  return getCookieConsent() === 'accepted'
}
