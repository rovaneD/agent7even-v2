'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { TRIAL_CARD_NOTE, TRIAL_LABEL } from '@/lib/billing/trialPolicy'

function CheckoutRedirect() {
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') ?? 'starter'
  const annual = searchParams.get('annual') === 'true'
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function startCheckout(confirmPlanChange = false) {
      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan, annual, confirmPlanChange }),
        })
        const data = await res.json()
        if (data.requiresConfirmation && !confirmPlanChange) {
          const ok = window.confirm(data.message as string)
          if (ok) return startCheckout(true)
          setError('Checkout cancelled.')
          return
        }
        if (data.url) {
          window.location.href = data.url
          return
        }
        setError(data.error ?? 'Could not start checkout.')
      } catch {
        setError('Could not reach the server. Try again.')
      }
    }
    startCheckout()
  }, [plan, annual])

  if (error) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Link
          href={`/start-trial?plan=${encodeURIComponent(plan)}`}
          className="mt-4 inline-block text-sm font-medium text-[#3B82F6] hover:underline"
        >
          Back to trial setup
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <Loader2 size={28} className="mx-auto mb-4 animate-spin text-[#3B82F6]" />
      <p className="text-base font-semibold text-[#101217]">Starting your {TRIAL_LABEL.toLowerCase()}</p>
      <p className="mt-2 text-sm leading-6 text-[#64748B]">
        Redirecting you to secure checkout to add your card. {TRIAL_CARD_NOTE}.
      </p>
    </div>
  )
}

export default function CheckoutNowPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FCFCFC] px-6">
      <Suspense
        fallback={
          <div className="mx-auto max-w-md text-center">
            <Loader2 size={28} className="mx-auto mb-4 animate-spin text-[#3B82F6]" />
            <p className="text-sm text-[#64748B]">Loading checkout…</p>
          </div>
        }
      >
        <CheckoutRedirect />
      </Suspense>
    </div>
  )
}
