import Link from 'next/link'
import { ArrowRight, CheckCircle2, CircleCheck, Clock, FileEdit, Send } from 'lucide-react'
import type { ContentLifecycleCounts } from '@/lib/content/lifecycleCounts'

interface Props {
  counts: ContentLifecycleCounts
  compact?: boolean
}

const STEPS = [
  {
    key: 'review' as const,
    label: 'Review',
    hint: 'Awaiting approval',
    href: '/dashboard/agents/approvals',
    icon: FileEdit,
  },
  {
    key: 'approved' as const,
    label: 'Approved',
    hint: 'Ready for Posts',
    href: '/dashboard/agents/approvals',
    icon: CircleCheck,
  },
  {
    key: 'draft' as const,
    label: 'Draft',
    hint: 'Ready to schedule',
    href: '/dashboard/posts?status=draft',
    icon: Clock,
  },
  {
    key: 'scheduled' as const,
    label: 'Scheduled',
    hint: 'Queued to publish',
    href: '/dashboard/posts?status=scheduled',
    icon: Send,
  },
  {
    key: 'published' as const,
    label: 'Published',
    hint: 'Live on connected accounts',
    href: '/dashboard/posts?status=published',
    icon: CheckCircle2,
  },
]

export default function ContentLifecycleBar({ counts, compact = false }: Props) {
  const visibleSteps = STEPS.filter(step =>
    step.key === 'review'
    || step.key === 'approved'
    || counts.postsConnected,
  )

  if (visibleSteps.length === 0) return null

  return (
    <section className={compact ? 'mb-6' : 'mb-5'}>
      {!compact && (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-menu-muted">
              Content pipeline
            </p>
            <p className="mt-1 text-sm text-text-sec">
              From agent output to published post — each stage is one click away.
            </p>
          </div>
          {!counts.postsConnected && (
            <Link href="/dashboard/posts" className="text-xs font-semibold text-brand-primary hover:underline">
              Connect social accounts
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {visibleSteps.map(step => {
          const Icon = step.icon
          const value = counts[step.key]
          return (
            <Link
              key={step.key}
              href={step.href}
              className="group flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-surface-2 text-text-sec group-hover:text-brand-primary">
                <Icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-menu-muted">{step.label}</p>
                <p className="text-xl font-semibold tabular-nums text-text-primary">{value}</p>
                {!compact && (
                  <p className="truncate text-[11px] text-text-muted">{step.hint}</p>
                )}
              </div>
              <ArrowRight size={14} className="flex-shrink-0 text-menu-muted group-hover:text-brand-primary" />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
