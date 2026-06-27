'use client'

import Link from 'next/link'
import { X, Zap } from 'lucide-react'
import CreditTopUp from './CreditTopUp'

interface Props {
  balance:   number
  planMax:   number
  onDismiss: () => void
}

export default function LowBalanceModal({ balance, planMax, onDismiss }: Props) {
  const pct = Math.max(0, Math.round((balance / planMax) * 100))

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 440, boxShadow: '0 16px 48px rgba(0,0,0,0.16)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '24px 24px 0' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Zap size={16} color="#f97316" />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: '#2D3748', margin: 0 }}>Running low on media credits</h2>
            </div>
            <p style={{ fontSize: 13, color: '#888', margin: 0, lineHeight: 1.5 }}>
              You have {balance} media credits left ({pct}% of your plan allowance).
              Maya chat and text agents stay unlimited — credits meter images and video only.
            </p>
          </div>
          <button
            onClick={onDismiss}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 2, marginLeft: 12, flexShrink: 0, display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          <CreditTopUp currentBalance={balance} onSuccess={onDismiss} />
        </div>

        <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link
            href="/dashboard/billing"
            onClick={onDismiss}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 0',
              fontSize: 13,
              fontWeight: 600,
              color: '#3B82F6',
              textAlign: 'center',
              textDecoration: 'none',
              border: '1px solid #E5E7EB',
              borderRadius: 12,
            }}
          >
            Upgrade plan for more credits
          </Link>
          <button
            onClick={onDismiss}
            style={{ width: '100%', padding: '8px 0', fontSize: 13, color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  )
}
