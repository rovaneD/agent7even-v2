'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, X } from 'lucide-react'

const ITEMS = [
  {
    label: 'Complete Foundation',
    desc: 'Set your business context — everything Maya creates uses this',
    href: '/dashboard/foundation',
  },
  {
    label: 'Create your first campaign',
    desc: 'Build a 30-day marketing plan for a specific audience',
    href: '/dashboard/campaigns/new?mode=guided',
  },
  {
    label: 'Run your first agent',
    desc: 'Automate a marketing task and see it come back done',
    href: '/dashboard/agents',
  },
  {
    label: 'Start your Brand Kit',
    desc: 'Add your colors, fonts, and brand voice documents',
    href: '/dashboard/brand-kit',
  },
  {
    label: 'Connect Analytics',
    desc: 'Link Google Analytics or Meta Ads to see your performance',
    href: '/dashboard/analytics',
  },
]

interface Props {
  completed: boolean[]  // must be length 5, matching ITEMS order
  dismissed: boolean
}

export default function GettingStarted({ completed, dismissed }: Props) {
  const [hidden, setHidden] = useState(dismissed)

  const allDone    = completed.every(Boolean)
  const doneCount  = completed.filter(Boolean).length
  const pct        = Math.round((doneCount / ITEMS.length) * 100)

  if (hidden || allDone) return null

  async function handleDismiss() {
    setHidden(true)
    await fetch('/api/dashboard/dismiss-getting-started', { method: 'POST' })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Getting started</h3>
          <p className="text-xs text-gray-400 mt-0.5">{doneCount} of {ITEMS.length} complete</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#c8522a] rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-300 hover:text-gray-500 transition-colors p-0.5 rounded"
            title="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="space-y-1">
        {ITEMS.map((item, i) => {
          const done = completed[i] ?? false
          return (
            <Link
              key={item.label}
              href={done ? '#' : item.href}
              className={`flex items-center gap-3 px-2 py-2 rounded-xl transition-colors group ${
                done ? 'cursor-default' : 'hover:bg-gray-50'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                done
                  ? 'bg-emerald-500'
                  : 'border border-gray-200 group-hover:border-[#c8522a]/40'
              }`}>
                {done && <Check size={10} className="text-white" strokeWidth={3} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium leading-tight ${
                  done ? 'text-gray-400 line-through' : 'text-gray-700'
                }`}>
                  {item.label}
                </p>
                {!done && (
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{item.desc}</p>
                )}
              </div>
              {!done && (
                <span className="text-[11px] text-gray-300 group-hover:text-[#c8522a] transition-colors flex-shrink-0">
                  →
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
