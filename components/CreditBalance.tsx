'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Zap } from 'lucide-react'
import LowBalanceModal from '@/components/billing/LowBalanceModal'

interface Props {
  userId: string
  plan:   string
}

const PLAN_MAX: Record<string, number> = {
  starter:  100,
  growth:   350,
  proagent: 1000,
}

export default function CreditBalance({ userId, plan }: Props) {
  const [balance,   setBalance]   = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('credit_balances')
      .select('balance')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .then(({ data }) => setBalance(data?.[0]?.balance ?? 0))

    const channel = supabase
      .channel(`credits-${userId}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'credit_balances',
        filter: `user_id=eq.${userId}`,
      }, payload => {
        setBalance(payload.new.balance)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const max = PLAN_MAX[plan] ?? 100
  const pct = balance != null ? Math.round((balance / max) * 100) : 0
  const low = pct <= 20

  // Show modal once per session when balance first drops ≤ 20%
  useEffect(() => {
    if (balance !== null && balance <= max * 0.2) {
      const dismissed = sessionStorage.getItem('low-balance-dismissed')
      if (!dismissed) setShowModal(true)
    }
  }, [balance, max])

  return (
    <>
      {showModal && (
        <LowBalanceModal
          balance={balance ?? 0}
          planMax={max}
          onDismiss={() => {
            setShowModal(false)
            sessionStorage.setItem('low-balance-dismissed', 'true')
          }}
        />
      )}

      <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-100 rounded-xl">
        <Zap className={`h-4 w-4 ${low ? 'text-orange-500' : 'text-[#c8522a]'}`} />
        <div>
          <p className="text-xs text-gray-400 leading-none">Credits</p>
          <p className={`text-sm font-semibold leading-none mt-0.5 ${low ? 'text-orange-500' : 'text-gray-900'}`}>
            {balance ?? '—'} <span className="text-gray-300 font-normal">/ {max}</span>
          </p>
        </div>
        {low && (
          <button
            onClick={() => setShowModal(true)}
            className="text-xs text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-md hover:bg-orange-100 transition-colors"
          >
            Low
          </button>
        )}
      </div>
    </>
  )
}
