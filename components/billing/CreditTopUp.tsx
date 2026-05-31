'use client'

import { useState } from 'react'
import { Zap } from 'lucide-react'
import { CREDIT_PACKAGES } from '@/lib/credits-packages'

interface Props {
  currentBalance: number
  onSuccess?: () => void
}

export default function CreditTopUp({ currentBalance, onSuccess }: Props) {
  const [selected, setSelected] = useState<string>('medium')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handlePurchase() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/stripe/credits/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ packageId: selected }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
        onSuccess?.()
      } else {
        setError('Could not start checkout. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const selectedPkg = CREDIT_PACKAGES.find(p => p.id === selected)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-4 h-4 text-[#c8522a]" />
        <h3 className="text-base font-semibold text-gray-900">Top up credits</h3>
      </div>
      <p className="text-sm text-gray-400 mb-5">
        Current balance:{' '}
        <span className="font-medium text-gray-700">{currentBalance} credits</span>
        {' '}· Credits never expire
      </p>

      <div className="space-y-2.5 mb-5">
        {CREDIT_PACKAGES.map(pkg => {
          const isSelected = selected === pkg.id
          return (
            <button
              key={pkg.id}
              onClick={() => setSelected(pkg.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                border: isSelected ? '1.5px solid #0a0a0a' : '1px solid #ebebeb',
                background: isSelected ? '#0a0a0a' : '#fff',
                transition: 'all 0.12s',
                fontFamily: 'inherit',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: isSelected ? '#fff' : '#0a0a0a' }}>
                    {pkg.label}
                  </span>
                  {pkg.popular && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                      background: isSelected ? 'rgba(255,255,255,0.15)' : '#fff5f2',
                      color: isSelected ? '#fff' : '#c8522a',
                    }}>
                      Popular
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: isSelected ? 'rgba(255,255,255,0.6)' : '#aaa', margin: 0 }}>
                  {pkg.description}
                </p>
              </div>
              <span style={{ fontSize: 18, fontWeight: 700, color: isSelected ? '#fff' : '#0a0a0a', marginLeft: 16, flexShrink: 0 }}>
                ${pkg.priceUsd}
              </span>
            </button>
          )
        })}
      </div>

      {error && (
        <p className="text-sm text-red-500 mb-3">{error}</p>
      )}

      <button
        onClick={handlePurchase}
        disabled={loading}
        style={{
          width: '100%', padding: '11px 0', background: '#c8522a', color: '#fff',
          border: 'none', borderRadius: 12, fontSize: 13.5, fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
          fontFamily: 'inherit', transition: 'background 0.12s',
        }}
        onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#b44a25' }}
        onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#c8522a' }}
      >
        {loading ? 'Redirecting to checkout…' : `Buy ${selectedPkg?.label}`}
      </button>

      <p style={{ fontSize: 11.5, color: '#bbb', textAlign: 'center', marginTop: 10 }}>
        Secured by Stripe · Credits added instantly after payment
      </p>
    </div>
  )
}
