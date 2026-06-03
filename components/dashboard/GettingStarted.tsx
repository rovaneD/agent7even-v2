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
  completed: boolean[]
  dismissed: boolean
}

export default function GettingStarted({ completed, dismissed }: Props) {
  const [hidden, setHidden] = useState(dismissed)

  const allDone   = completed.every(Boolean)
  const doneCount = completed.filter(Boolean).length
  const pct       = Math.round((doneCount / ITEMS.length) * 100)

  if (hidden || allDone) return null

  async function handleDismiss() {
    setHidden(true)
    await fetch('/api/dashboard/dismiss-getting-started', { method: 'POST' })
  }

  return (
    <div className="mb-6 rounded-2xl border border-border bg-surface p-5">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-menu-muted">Setup progress</p>
          <h3 className="mt-1 text-[17px] font-semibold text-text-primary">Build the foundation</h3>
          <p className="mt-1 text-xs text-text-sec">{doneCount} of {ITEMS.length} complete</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-brand-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <button
            onClick={handleDismiss}
            className="rounded p-0.5 text-text-muted transition-colors hover:text-text-primary"
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
              className={`group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors ${
                done ? 'cursor-default' : 'hover:bg-surface-2'
              }`}
            >
              <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
                done
                  ? 'bg-status-success'
                  : 'border border-border bg-surface group-hover:border-brand-primary/40'
              }`}>
                {done && <Check size={11} className="text-white" strokeWidth={3} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-medium leading-tight ${
                  done ? 'text-text-muted line-through' : 'text-text-primary'
                }`}>
                  {item.label}
                </p>
                {!done && (
                  <p className="mt-0.5 text-[11px] leading-snug text-text-sec">{item.desc}</p>
                )}
              </div>
              {!done && (
                <span className="flex-shrink-0 text-[11px] text-text-muted transition-colors group-hover:text-brand-primary">
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
