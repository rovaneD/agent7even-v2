'use client'

/**
 * BEFORE: Cookie banner + analytics components mounted with the root layout
 * and competed for main-thread time on first paint.
 * AFTER: Wait until idle (or a short timeout) before mounting non-critical chrome.
 */

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const CookieConsentBanner = dynamic(() => import('./CookieConsentBanner'), { ssr: false })
const ConsentAwareAnalytics = dynamic(() => import('./ConsentAwareAnalytics'), { ssr: false })
const Analytics = dynamic(
  () => import('@vercel/analytics/next').then((m) => m.Analytics),
  { ssr: false },
)

export default function DeferredChrome() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const enable = () => setReady(true)
    const ric = window.requestIdleCallback?.(enable, { timeout: 3000 })
    if (ric != null) return () => window.cancelIdleCallback?.(ric)
    const t = window.setTimeout(enable, 1200)
    return () => window.clearTimeout(t)
  }, [])

  if (!ready) return null

  return (
    <>
      <CookieConsentBanner />
      <ConsentAwareAnalytics />
      <Analytics />
    </>
  )
}
