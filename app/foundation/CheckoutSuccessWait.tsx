'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

function foundationRefreshHref(plan?: string | null, sessionId?: string | null) {
  const params = new URLSearchParams()
  if (plan) params.set('plan', plan)
  params.set('checkout', 'success')
  if (sessionId) params.set('session_id', sessionId)
  return `/foundation?${params.toString()}`
}

export default function CheckoutSuccessWait({
  plan,
  sessionId,
}: {
  plan?: string | null
  sessionId?: string | null
}) {
  const router = useRouter()
  const [error, setError] = useState(false)
  const refreshHref = foundationRefreshHref(plan, sessionId)

  useEffect(() => {
    let cancelled = false
    let attempts = 0
    const maxAttempts = 20

    async function sync() {
      if (cancelled || attempts >= maxAttempts) {
        if (!cancelled && attempts >= maxAttempts) setError(true)
        return
      }
      attempts++

      try {
        if (sessionId) {
          const res = await fetch('/api/stripe/sync-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          })
          const data = await res.json()
          if (data.ok && data.redirect) {
            router.replace(data.redirect)
            return
          }
        } else {
          const res = await fetch('/api/stripe/subscription-status')
          const data = await res.json()
          if (data.ok && data.redirect) {
            router.replace(data.redirect)
            return
          }
        }
      } catch {
        /* retry */
      }

      window.setTimeout(sync, 1500)
    }

    sync()
    return () => {
      cancelled = true
    }
  }, [sessionId, router])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111111] px-6">
        <div className="max-w-md text-center">
          <p className="text-lg font-semibold text-[#f5f4f0]">Almost ready</p>
          <p className="mt-2 text-sm text-white/50">
            Your payment went through but setup is taking longer than usual. Refresh in a few seconds,
            or contact support if this persists.
          </p>
          <Link
            href={refreshHref}
            className="mt-6 inline-block text-sm font-medium text-[#3B82F6] hover:underline"
          >
            Refresh Foundation
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#111111] px-6">
      <div className="max-w-md text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#3B82F6]" />
        <p className="text-lg font-semibold text-[#f5f4f0]">Payment received</p>
        <p className="mt-2 text-sm text-white/50">Setting up your account…</p>
      </div>
    </div>
  )
}
