'use client'

/**
 * BEFORE: Cookie banner + analytics components mounted with the root layout
 * and competed for main-thread time on first paint.
 * AFTER: Wait until idle (or a short timeout) before mounting non-critical chrome.
 */

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const CookieConsentBanner = dynamic(() => import('./CookieConsentBanner'), { ssr: false })
const ConsentAwareAnalytics = dynamic(() => import('./ConsentAwareAnalytics'), { ssr: false })
const Analytics = dynamic(
  () => import('@vercel/analytics/next').then((m) => m.Analytics),
  { ssr: false },
)

// The cookie banner and the GA marketing tag belong to the public marketing
// site — never inside the signed-in product. Vercel Analytics stays sitewide
// (cookieless, powers product trackEvent calls).
const IN_APP_PREFIXES = ['/dashboard', '/admin', '/foundation', '/maya', '/sign-in', '/sign-up']

export default function DeferredChrome() {
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const enable = () => setReady(true)
    const ric = window.requestIdleCallback?.(enable, { timeout: 3000 })
    if (ric != null) return () => window.cancelIdleCallback?.(ric)
    const t = window.setTimeout(enable, 1200)
    return () => window.clearTimeout(t)
  }, [])

  if (!ready) return null

  const inApp = IN_APP_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))

  return (
    <>
      {!inApp && <CookieConsentBanner />}
      {!inApp && <ConsentAwareAnalytics />}
      <Analytics />
    </>
  )
}
