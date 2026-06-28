import Link from 'next/link'
import {
  getMediaAllowanceExample,
  getPlanMediaCredits,
  getServiceRequestLimit,
  isPaidPlan,
} from '@/lib/plans'

type Props = {
  plan: string | null
  creditBalance: number | null
  activeServiceRequests?: number
  compact?: boolean
}

export default function PlanUsageCallout({
  plan,
  creditBalance,
  activeServiceRequests = 0,
  compact = false,
}: Props) {
  if (!isPaidPlan(plan)) {
    return (
      <div className={`rounded-2xl border border-gray-100 bg-white ${compact ? 'p-4' : 'p-5'}`}>
        <p className="text-sm text-text-sec">
          <span className="font-semibold text-text-primary">Choose a plan</span> to unlock media credits,
          service requests, and your full workspace.{' '}
          <Link href="/dashboard/billing" className="font-semibold text-brand-primary hover:underline">
            View billing
          </Link>
        </p>
      </div>
    )
  }

  const mediaPool = getPlanMediaCredits(plan)
  const mediaExample = getMediaAllowanceExample(plan)
  const serviceLimit = getServiceRequestLimit(plan)
  const balanceLabel = creditBalance != null ? creditBalance.toLocaleString() : '—'
  const poolLabel = mediaPool?.toLocaleString() ?? '—'
  const serviceLabel =
    serviceLimit == null
      ? `${activeServiceRequests} active · unlimited on plan`
      : `${activeServiceRequests} of ${serviceLimit} active slots`

  return (
    <div className={`rounded-2xl border border-gray-100 bg-white ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-menu-muted">
            How your plan meters usage
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-sec">
            Campaigns, Maya chat, and text agents are <span className="font-medium text-text-primary">unlimited</span>.
            Media credits meter generated images and video only.
          </p>
        </div>
        {!compact && (
          <Link
            href="/dashboard/billing"
            className="flex-shrink-0 text-xs font-semibold text-brand-primary hover:underline"
          >
            Billing details →
          </Link>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-surface-2 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-soft">Media credits</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-text-primary">
            {balanceLabel}
            <span className="text-sm font-normal text-text-muted"> / {poolLabel}</span>
          </p>
          {mediaExample && (
            <p className="mt-1 text-xs text-text-sec">{mediaExample} at standard rates</p>
          )}
        </div>
        <div className="rounded-xl border border-gray-100 bg-surface-2 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-soft">Service requests</p>
          <p className="mt-1 text-lg font-semibold text-text-primary">{serviceLabel}</p>
          <p className="mt-1 text-xs text-text-sec">
            Human-delivered work fulfilled by our team — not AI credits.{' '}
            <Link href="/dashboard/services" className="font-medium text-brand-primary hover:underline">
              Browse services
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
