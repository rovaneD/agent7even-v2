'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'
import {
  COOKIE_CONSENT_UPDATED_EVENT,
  GA_MEASUREMENT_ID,
  hasAnalyticsConsent,
  type CookieConsentChoice,
} from '@/lib/analytics/cookieConsent'

export default function ConsentAwareAnalytics() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(hasAnalyticsConsent())

    const onConsentUpdate = (event: Event) => {
      const choice = (event as CustomEvent<CookieConsentChoice>).detail
      setEnabled(choice === 'accepted')
    }

    window.addEventListener(COOKIE_CONSENT_UPDATED_EVENT, onConsentUpdate)
    return () => window.removeEventListener(COOKIE_CONSENT_UPDATED_EVENT, onConsentUpdate)
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
