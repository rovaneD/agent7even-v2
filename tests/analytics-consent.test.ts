import assert from 'node:assert/strict'
import test from 'node:test'
import {
  COOKIE_CONSENT_STORAGE_KEY,
  getCookieConsent,
  setCookieConsent,
} from '@/lib/analytics/cookieConsent'
import { trackEvent } from '@/lib/gtag'

function installWindow(value: Partial<Window>) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value,
    writable: true,
  })
}

function removeWindow() {
  Reflect.deleteProperty(globalThis, 'window')
}

test('named analytics events require accepted consent', () => {
  const storage = new Map<string, string>()
  const vercelCalls: unknown[][] = []
  const gtagCalls: unknown[][] = []

  installWindow({
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
    } as Storage,
    va: (...args: unknown[]) => vercelCalls.push(args),
    gtag: (...args: unknown[]) => gtagCalls.push(args),
  } as Partial<Window> & { va: (...args: unknown[]) => void })

  try {
    trackEvent('signup_page_view', { plan: 'growth' })
    storage.set(COOKIE_CONSENT_STORAGE_KEY, 'rejected')
    trackEvent('signup_page_view', { plan: 'growth' })

    assert.equal(vercelCalls.length, 0)
    assert.equal(gtagCalls.length, 0)

    storage.set(COOKIE_CONSENT_STORAGE_KEY, 'accepted')
    trackEvent('signup_page_view', { plan: 'growth' })

    assert.deepEqual(vercelCalls, [[
      'event',
      { name: 'signup_page_view', data: { plan: 'growth' }, options: undefined },
    ]])
    assert.deepEqual(gtagCalls, [['event', 'signup_page_view', { plan: 'growth' }]])
  } finally {
    removeWindow()
  }
})

test('blocked local storage fails closed without blocking a consent choice event', () => {
  const dispatched: Event[] = []

  installWindow({
    localStorage: {
      getItem: () => {
        throw new DOMException('Blocked', 'SecurityError')
      },
      setItem: () => {
        throw new DOMException('Blocked', 'SecurityError')
      },
    } as unknown as Storage,
    dispatchEvent: (event) => {
      dispatched.push(event)
      return true
    },
  })

  try {
    assert.equal(getCookieConsent(), null)
    assert.doesNotThrow(() => setCookieConsent('rejected'))
    assert.equal(dispatched.length, 1)
    assert.equal((dispatched[0] as CustomEvent).detail, 'rejected')
  } finally {
    removeWindow()
  }
})
