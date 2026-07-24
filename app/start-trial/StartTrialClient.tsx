'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { TRIAL_CARD_NOTE, TRIAL_LABEL } from '@/lib/billing/trialPolicy'

const PLANS = [
  { key: 'starter', name: 'Starter', price: 49 },
  { key: 'growth', name: 'Growth', price: 89 },
  { key: 'proagent', name: 'ProAgent', price: 149 },
] as const

function CheckoutButton({ planKey }: { planKey: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startCheckout(confirmPlanChange = false) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey, confirmPlanChange }),
      })
      const data = await res.json()
      if (data.requiresConfirmation && !confirmPlanChange) {
        const ok = window.confirm(data.message as string)
        if (ok) return startCheckout(true)
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      setError(data.error ?? 'Could not start checkout.')
    } catch {
      setError('Could not reach the server. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => startCheckout()}
        disabled={loading}
        className="inline-flex w-full items-center justify-center rounded-xl bg-[#2D3748] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1E293B] disabled:opacity-60"
      >
        {loading ? <Loader2 className="animate-spin" size={18} /> : `Start ${TRIAL_LABEL}`}
      </button>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

export default function StartTrialPage() {
  const searchParams = useSearchParams()
  const planParam = searchParams.get('plan')
  const selected = PLANS.find(p => p.key === planParam)

  useEffect(() => {
    document.title = 'Finish starting your trial — Agent7even'
  }, [])

  return (
    <div className="min-h-screen bg-[#FCFCFC] text-[#101217]">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#64748B]">Almost there</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Finish starting your trial</h1>
        <p className="mt-3 text-sm leading-6 text-[#475569]">
          Your account is ready. Add a card on the next screen to start your {TRIAL_LABEL.toLowerCase()}.{' '}
          {TRIAL_CARD_NOTE}.
        </p>

        {selected ? (
          <div className="mt-8 rounded-2xl border border-gray-100 bg-white p-6">
            <p className="text-sm font-semibold">{selected.name}</p>
            <p className="mt-1 text-sm text-[#64748B]">${selected.price}/mo after trial</p>
            <div className="mt-5">
              <CheckoutButton planKey={selected.key} />
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {PLANS.map(plan => (
              <div key={plan.key} className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{plan.name}</p>
                    <p className="text-xs text-[#64748B]">${plan.price}/mo after trial</p>
                  </div>
                  <CheckoutButton planKey={plan.key} />
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-[#94A3B8]">
          Already subscribed?{' '}
          <Link href="/dashboard" className="font-medium text-[#3B82F6] hover:underline">
            Go to dashboard
          </Link>
        </p>
      </div>
    </div>
  )
}
