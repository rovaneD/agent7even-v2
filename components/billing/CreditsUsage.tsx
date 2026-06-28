'use client'

import { Zap, RefreshCw } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

export interface BreakdownItem {
  label: string
  credits: number
  color: string
}

export interface CreditActivityItem {
  description: string
  credits: number
  type: string
  createdAt: string
}

export interface CreditsUsageData {
  monthlyAllocation: number
  monthlyUsed: number
  monthlyRemaining: number
  planSpendable: number
  topupBalance: number
  totalAvailable: number
  resetDate: string
  breakdown: BreakdownItem[]
  recentActivity: CreditActivityItem[]
}

interface Props {
  data: CreditsUsageData
}

// ── Helpers ────────────────────────────────────────────────────────────────

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full bg-[#E2E8F0] rounded-full h-1.5 overflow-hidden">
      <div
        className="h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
      />
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

export default function CreditsUsage({ data }: Props) {
  const {
    monthlyAllocation,
    monthlyUsed,
    monthlyRemaining,
    planSpendable,
    topupBalance,
    totalAvailable,
    resetDate,
    breakdown,
    recentActivity,
  } = data

  const monthlyUsedCapped = Math.min(monthlyUsed, monthlyAllocation)
  const monthlyPct = monthlyAllocation > 0
    ? Math.round((monthlyUsedCapped / monthlyAllocation) * 100)
    : 0
  const balanceBelowPlanRemaining = totalAvailable < monthlyRemaining

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#3B82F6]" />
          <h3 className="text-base font-semibold text-[#2D3748]">Media credits &amp; usage</h3>
        </div>
        <p className="mt-1.5 text-xs text-[#64748B]">
          Maya chat and text agents are unlimited. Media credits meter images, video, and publishing only.
        </p>
      </div>

      {/* ── Balance section ── */}
      <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest mb-3">
        Balance
      </p>

      <div className="space-y-3 mb-5">

        {/* Monthly allocation */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-[#2D3748]">Monthly allocation</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#64748B] flex items-center gap-1">
                <RefreshCw size={10} />
                resets {resetDate}
              </span>
              <span className="text-sm font-medium text-[#2D3748]">
                {monthlyUsedCapped.toLocaleString()} / {monthlyAllocation.toLocaleString()} used
              </span>
            </div>
          </div>
          <Bar pct={monthlyPct} color="#3B82F6" />
          <div className="flex justify-between mt-1">
            <span className="text-[11px] text-[#64748B]">
              {monthlyRemaining.toLocaleString()} remaining on plan
            </span>
            <span className="text-[11px] text-[#64748B]">{monthlyPct}%</span>
          </div>
          {balanceBelowPlanRemaining && (
            <p className="text-[11px] text-[#64748B] mt-1.5">
              {planSpendable.toLocaleString()} credits spendable now · full refresh {resetDate}
            </p>
          )}
        </div>

        {/* Top-up balance */}
        {topupBalance > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-[#2D3748]">Top-up balance</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#64748B]">never expires</span>
                <span className="text-sm font-medium text-[#2D3748]">
                  {topupBalance.toLocaleString()} credits
                </span>
              </div>
            </div>
            <Bar pct={100} color="#10B981" />
          </div>
        )}
      </div>

      {/* Divider + total */}
      <div className="border-t border-[#E2E8F0] py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[#64748B]">Total available</span>
        <span className="text-sm font-semibold text-[#2D3748]">
          {totalAvailable.toLocaleString()} credits
        </span>
      </div>

      {/* ── Usage section ── */}
      {breakdown.length > 0 && (
        <>
          <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest mt-5 mb-3">
            Usage this month
          </p>

          <div className="space-y-3 mb-3">
            {breakdown.map(item => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-[#2D3748]">{item.label}</span>
                  <span className="text-sm font-medium text-[#2D3748]">
                    {item.credits.toLocaleString()} credits
                  </span>
                </div>
                <Bar
                  pct={monthlyUsed > 0 ? (item.credits / monthlyUsed) * 100 : 0}
                  color={item.color}
                />
              </div>
            ))}
          </div>

          <div className="border-t border-[#E2E8F0] pt-3 flex items-center justify-between">
            <span className="text-sm font-medium text-[#64748B]">Total used this month</span>
            <span className="text-sm font-semibold text-[#2D3748]">
              {monthlyUsed.toLocaleString()} credits
            </span>
          </div>
        </>
      )}

      {breakdown.length === 0 && (
        <p className="text-sm text-[#64748B] mt-2">No usage this month yet.</p>
      )}

      {recentActivity.length > 0 && (
        <>
          <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest mt-5 mb-3">
            Recent activity
          </p>
          <div className="space-y-2">
            {recentActivity.map(item => (
              <div key={`${item.createdAt}-${item.description}`} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-[#2D3748] truncate">{item.description}</p>
                  <p className="text-[11px] text-[#64748B]">
                    {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' · '}
                    {item.type}
                  </p>
                </div>
                <span className={`whitespace-nowrap font-medium ${item.credits < 0 ? 'text-[#2D3748]' : 'text-[#10B981]'}`}>
                  {item.credits > 0 ? '+' : ''}{item.credits.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
