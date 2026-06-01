'use client'

import { Zap, RefreshCw } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

export interface BreakdownItem {
  label: string
  credits: number
  color: string
}

export interface CreditsUsageData {
  monthlyAllocation: number
  monthlyUsed: number
  monthlyRemaining: number
  topupBalance: number
  totalAvailable: number
  resetDate: string
  breakdown: BreakdownItem[]
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
        style={{ width: `${Math.min(100, Math.max(1, pct))}%`, background: color }}
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
    topupBalance,
    totalAvailable,
    resetDate,
    breakdown,
  } = data

  const monthlyUsedCapped = Math.min(monthlyUsed, monthlyAllocation)
  const monthlyPct = monthlyAllocation > 0
    ? Math.round((monthlyUsedCapped / monthlyAllocation) * 100)
    : 0

  return (
    <div className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-6">

      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Zap className="w-4 h-4 text-[#3B82F6]" />
        <h3 className="text-base font-semibold text-[#2D3748]">Credits &amp; Usage</h3>
      </div>

      {/* ── Balance section ── */}
      <p className="text-[10px] font-semibold text-[#9BA1AE] uppercase tracking-widest mb-3">
        Balance
      </p>

      <div className="space-y-3 mb-5">

        {/* Monthly allocation */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-[#2D3748]">Monthly allocation</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#9BA1AE] flex items-center gap-1">
                <RefreshCw size={10} />
                resets {resetDate}
              </span>
              <span className="text-sm font-medium text-[#2D3748]">
                {monthlyRemaining > 0
                  ? `${monthlyRemaining.toLocaleString()} / ${monthlyAllocation.toLocaleString()}`
                  : `0 / ${monthlyAllocation.toLocaleString()}`}
              </span>
            </div>
          </div>
          <Bar pct={monthlyPct} color="#3B82F6" />
          <div className="flex justify-between mt-1">
            <span className="text-[11px] text-[#9BA1AE]">{monthlyUsedCapped.toLocaleString()} used</span>
            <span className="text-[11px] text-[#9BA1AE]">{monthlyPct}%</span>
          </div>
        </div>

        {/* Top-up balance */}
        {topupBalance > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-[#2D3748]">Top-up balance</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#9BA1AE]">never expires</span>
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
        <span className="text-sm font-medium text-[#9BA1AE]">Total available</span>
        <span className="text-sm font-semibold text-[#2D3748]">
          {totalAvailable.toLocaleString()} credits
        </span>
      </div>

      {/* ── Usage section ── */}
      {breakdown.length > 0 && (
        <>
          <p className="text-[10px] font-semibold text-[#9BA1AE] uppercase tracking-widest mt-5 mb-3">
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
            <span className="text-sm font-medium text-[#9BA1AE]">Total used this month</span>
            <span className="text-sm font-semibold text-[#2D3748]">
              {monthlyUsed.toLocaleString()} credits
            </span>
          </div>
        </>
      )}

      {breakdown.length === 0 && (
        <p className="text-sm text-[#9BA1AE] mt-2">No usage this month yet.</p>
      )}
    </div>
  )
}
