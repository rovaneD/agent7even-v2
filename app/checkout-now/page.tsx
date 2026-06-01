'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

function CheckoutRedirect() {
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') ?? 'starter'
  const annual = searchParams.get('annual') === 'true'
  const [error, setError] = useState(false)

  useEffect(() => {
    async function startCheckout() {
      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan, annual }),
        })
        const data = await res.json()
        if (data.url) {
          window.location.href = data.url
        } else {
          setError(true)
        }
      } catch {
        setError(true)
      }
    }
    startCheckout()
  }, [plan, annual])

  if (error) {
    return (
      <div className="text-center">
        <p className="text-white/60 text-sm mb-4">Something went wrong starting checkout.</p>
        <a href="/pricing" className="text-sm font-medium text-[#64748B] hover:text-[#b8471f] transition-colors">
          ← Back to pricing
        </a>
      </div>
    )
  }

  return (
    <div className="text-center">
      <Loader2 size={28} className="text-[#64748B] animate-spin mx-auto mb-4" />
      <p className="text-white/50 text-sm">Setting up your subscription...</p>
    </div>
  )
}

export default function CheckoutNowPage() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-6">
      <Suspense fallback={
        <div className="text-center">
          <Loader2 size={28} className="text-[#64748B] animate-spin mx-auto mb-4" />
          <p className="text-white/50 text-sm">Setting up your subscription...</p>
        </div>
      }>
        <CheckoutRedirect />
      </Suspense>
    </div>
  )
}
