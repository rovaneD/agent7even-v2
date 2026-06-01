'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, X } from 'lucide-react'

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  proagent: 'ProAgent',
}

export default function PlanBanner({ plan }: { plan: string }) {
  const [showTeamMessage, setShowTeamMessage] = useState(() => {
    if (typeof window === 'undefined') return false
    return !localStorage.getItem('team_notified_dismissed')
  })

  function dismissTeamMessage() {
    localStorage.setItem('team_notified_dismissed', 'true')
    setShowTeamMessage(false)
  }

  const planLabel = PLAN_LABELS[plan] ?? plan

  return (
    <div className="bg-[#2D3748]/5 border border-[#3B82F6]/20 rounded-2xl p-4 mb-6 flex items-center gap-3 flex-wrap sm:flex-nowrap">
      <CheckCircle size={16} className="text-[#9BA1AE] flex-shrink-0" />
      <p className="text-sm text-gray-700 flex-shrink-0">
        You&apos;re on the{' '}
        <span className="font-semibold text-[#9BA1AE]">{planLabel}</span> plan.
      </p>
      {showTeamMessage && (
        <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-1.5">
          <span className="text-sm text-gray-600">
            The Agent7even team has been notified and will be in touch shortly.
          </span>
          <button
            onClick={dismissTeamMessage}
            className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      )}
      <Link
        href="/dashboard/billing"
        className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex-shrink-0 whitespace-nowrap"
      >
        Manage →
      </Link>
    </div>
  )
}
