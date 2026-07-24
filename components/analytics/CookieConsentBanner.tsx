'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  getCookieConsent,
  setCookieConsent,
} from '@/lib/analytics/cookieConsent'

export default function CookieConsentBanner() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(getCookieConsent() === null)
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-[100] sm:left-auto sm:right-5 sm:max-w-sm"
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 rounded-2xl border border-[#E4E4E7] bg-white p-4 shadow-[0_18px_50px_-24px_rgba(16,18,23,0.35)]">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[#0E0E11]">We use cookies</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#52525B]">
            By clicking &ldquo;Accept all&rdquo;, you agree to the storing of cookies on your device for
            functional and analytics purposes. See our{' '}
            <Link href="/privacy#cookies" className="font-medium text-[#3B82F6] underline underline-offset-2">
              privacy policy
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full border border-[#3B82F6] bg-white px-4 py-2.5 text-[14px] font-medium text-[#3B82F6] transition-colors hover:bg-[#EFF6FF] sm:flex-none"
            onClick={() => {
              setCookieConsent('rejected')
              setOpen(false)
            }}
          >
            Reject all
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full border border-[#3B82F6] bg-white px-4 py-2.5 text-[14px] font-medium text-[#3B82F6] transition-colors hover:bg-[#EFF6FF] sm:flex-none"
            onClick={() => {
              setCookieConsent('accepted')
              setOpen(false)
            }}
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  )
}
