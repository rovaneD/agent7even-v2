'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'
import {
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_UPDATED_EVENT,
  GA_MEASUREMENT_ID,
  getCookieConsent,
  parseCookieConsentChoice,
  type CookieConsentChoice,
} from '@/lib/analytics/cookieConsent'

export default function ConsentAwareAnalytics() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const applyChoice = (choice: CookieConsentChoice | null) => {
      const accepted = choice === 'accepted'
      if (typeof window.gtag === 'function') {
        window.gtag('consent', 'update', {
          analytics_storage: accepted ? 'granted' : 'denied',
        })
      }
      setEnabled(accepted)
    }

    const onConsentUpdate = (event: Event) =>
      applyChoice((event as CustomEvent<CookieConsentChoice>).detail)
    const onStorage = (event: StorageEvent) => {
      if (event.key !== COOKIE_CONSENT_STORAGE_KEY) return
      applyChoice(parseCookieConsentChoice(event.newValue))
    }

    applyChoice(getCookieConsent())
    window.addEventListener(COOKIE_CONSENT_UPDATED_EVENT, onConsentUpdate)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(COOKIE_CONSENT_UPDATED_EVENT, onConsentUpdate)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  if (!enabled) return null

  return (
    <>
      <Script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${GA_MEASUREMENT_ID}');
      `}</Script>
    </>
  )
}
