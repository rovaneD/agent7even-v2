'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Shield,
  TrendingUp,
} from 'lucide-react'
import type { SocialPolicyReport } from '@/lib/admin/socialPolicyReport'

function fmtUsd(n: number): string {
  if (n < 0.01 && n > 0) return '<$0.01'
  return `$${n.toFixed(n >= 1 ? 2 : 4)}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function SocialPolicySection() {
  const [report, setReport] = useState<SocialPolicyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/integrations/social-policy', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load social policy report.')
        setReport(null)
        return
      }
      setReport(json as SocialPolicyReport)
    } catch {
      setError('Network error while loading social policy.')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 mt-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Shield size={18} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold text-[#2D3748]">Social / X policy</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Growth+ gate, blocked connect attempts, and X API pass-through measurement (30-day window).
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 text-xs font-semibold text-[#64748B] border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 mb-4">
          <p className="text-xs font-medium text-red-600">{error}</p>
        </div>
      )}

      {loading && !report && !error && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
          <Loader2 size={16} className="animate-spin" />
          Loading social policy…
        </div>
      )}

      {report && (
        <>
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3.5 mb-5">
            <p className="text-sm font-semibold text-gray-800 mb-1">Active policy</p>
            <p className="text-xs text-gray-600 leading-relaxed">{report.policy.message}</p>
            <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
              <span>
                Measurement: {fmtDate(report.policy.measurementStart)} → {fmtDate(report.policy.measurementEnd)}
              </span>
              <span className="font-medium text-blue-700">
                {report.policy.measurementDaysRemaining} days remaining
              </span>
            </div>
          </div>

          {!report.usage.tableReady && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 mb-5 flex gap-2">
              <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-800">Usage table not ready</p>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                  Run <code className="text-[11px]">24_zernio_api_usage.sql</code> in Supabase to enable X usage rollups.
                  Connect gate telemetry still works via activity log.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'X connected (Starter)', value: report.connected.starter, hint: 'grandfathered' },
              { label: 'X connected (Growth+)', value: report.connected.growth + report.connected.proagent },
              { label: 'Blocked connects (30d)', value: report.blockedAttempts30d },
              { label: 'X API est. cost (30d)', value: fmtUsd(report.usage.xCost30d) },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-gray-100 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  {item.label}
                </p>
                <p className="text-lg font-bold text-gray-900">{item.value}</p>
                {'hint' in item && item.hint && (
                  <p className="text-[10px] text-gray-400 mt-0.5">{item.hint}</p>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-gray-100 px-4 py-3.5 mb-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={14} className="text-gray-400" />
              <p className="text-sm font-semibold text-gray-800">30-day decision criteria</p>
            </div>
            <ul className="text-xs text-gray-500 space-y-1.5 leading-relaxed">
              <li>
                Median Growth+ tenant with X: target under {fmtUsd(report.decisionCriteria.medianGrowthCostTargetUsd)}/mo → keep included on Growth+
              </li>
              <li>
                P95 tenant over {fmtUsd(report.decisionCriteria.p95CostReviewUsd)}/mo → fair-use throttle or credit line item
              </li>
              <li>
                Open Starter only if median under {fmtUsd(report.decisionCriteria.starterOpenThresholdUsd)}/mo with bounded P95
              </li>
            </ul>
          </div>

          {report.usage.topTenants.length > 0 && (
            <div className="rounded-xl border border-gray-100 overflow-hidden mb-5">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <p className="text-sm font-semibold text-gray-800">Top tenants by X est. cost (30d)</p>
              </div>
              <div className="divide-y divide-gray-50">
                {report.usage.topTenants.map(row => (
                  <div key={row.userId} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/clients/${row.userId}`}
                        className="text-sm font-medium text-gray-800 hover:text-blue-600 truncate block"
                      >
                        {row.companyName ?? 'Unnamed'}
                      </Link>
                      <p className="text-[11px] text-gray-400 capitalize">{row.plan ?? 'no plan'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-800">{fmtUsd(row.xEstimatedCostUsd)}</p>
                      <p className="text-[11px] text-gray-400">{row.xCallCount} calls</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-gray-400 leading-relaxed">
            Reconcile fleet X cost against{' '}
            <a
              href="https://zernio.com/dashboard/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
            >
              Zernio billing
              <ExternalLink size={10} />
            </a>
            {' '}monthly. Stripe spending cap is a global backstop only — not per-tenant.
          </p>
        </>
      )}
    </div>
  )
}
