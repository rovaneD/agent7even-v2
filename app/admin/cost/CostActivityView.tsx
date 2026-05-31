'use client'

import { useState, useEffect } from 'react'
import { DollarSign, Zap, TrendingUp, Users, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type Account = {
  user_id: string
  company_name: string | null
  plan: string | null
  mrr_usd: number
  tasks_this_month: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
  maya_cost_usd: number
  credits_remaining: number | null
}

type Run = {
  id: string
  agent: string | null
  job_type: string | null
  model: string | null
  status: string | null
  input_tokens: number | null
  output_tokens: number | null
  cached_tokens: number | null
  cost_usd: number | null
  created_at: string
  profiles: { company_name: string | null; full_name: string | null } | null
}

type Summary = {
  total_mrr: number
  total_cost: number
  total_tasks: number
  active_accounts: number
}

// ── Constants ──────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter', growth: 'Growth', proagent: 'ProAgent',
}

const PLAN_COLORS: Record<string, string> = {
  starter:  'bg-gray-100 text-gray-600',
  growth:   'bg-blue-50 text-blue-600',
  proagent: 'bg-[#c8522a]/10 text-[#c8522a]',
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-50 text-green-700',
  failed:    'bg-red-50 text-red-600',
  pending:   'bg-gray-100 text-gray-500',
  running:   'bg-blue-50 text-blue-600',
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return n < 0.01 ? '<$0.01' : `$${n.toFixed(n >= 1 ? 2 : 4)}`
}

function fmtTokens(n: number | null) {
  if (!n) return '—'
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function accountLabel(a: Account) {
  return a.company_name || `…${a.user_id.slice(-6)}`
}

type AccountSortKey = 'mrr_usd' | 'cost_usd' | 'tasks_this_month' | 'credits_remaining' | 'company_name'

// ── Summary Card ────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, Icon, color,
}: {
  label: string
  value: string
  sub: string
  Icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-4 ${color}`}>
        <Icon size={15} className="text-white" />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function CostActivityView() {
  const [tab, setTab] = useState<'overview' | 'runs'>('overview')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [runs, setRuns]         = useState<Run[]>([])
  const [summary, setSummary]   = useState<Summary | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Account table sort
  const [sortKey, setSortKey] = useState<AccountSortKey>('cost_usd')
  const [sortAsc, setSortAsc] = useState(false)

  // Run log filter
  const [runFilter, setRunFilter] = useState<'all' | 'completed' | 'failed'>('all')

  async function load(quiet = false) {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/cost')
      const json = await res.json()
      if (!res.ok) { setError(`${res.status}: ${json.error ?? 'Error'}`); return }
      setAccounts(json.accounts ?? [])
      setRuns(json.runs ?? [])
      setSummary(json.summary ?? null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  function toggleSort(k: AccountSortKey) {
    if (sortKey === k) setSortAsc(v => !v)
    else { setSortKey(k); setSortAsc(k === 'company_name') }
  }

  function SortIcon({ k }: { k: AccountSortKey }) {
    if (sortKey !== k) return <ChevronUp size={10} className="text-gray-300" />
    return sortAsc
      ? <ChevronUp size={10} className="text-[#c8522a]" />
      : <ChevronDown size={10} className="text-[#c8522a]" />
  }

  function ColHead({ label, k }: { label: string; k: AccountSortKey }) {
    return (
      <th
        onClick={() => toggleSort(k)}
        className="text-left px-5 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-600 select-none"
      >
        <span className="flex items-center gap-1">{label} <SortIcon k={k} /></span>
      </th>
    )
  }

  const sorted = [...accounts].sort((a, b) => {
    const av = a[sortKey] ?? (sortKey === 'company_name' ? '' : 0)
    const bv = b[sortKey] ?? (sortKey === 'company_name' ? '' : 0)
    if (av < bv) return sortAsc ? -1 : 1
    if (av > bv) return sortAsc ? 1 : -1
    return 0
  })

  const filteredRuns = runs.filter(r =>
    runFilter === 'all' ? true : r.status === runFilter
  )

  const margin     = (summary?.total_mrr ?? 0) - (summary?.total_cost ?? 0)
  const marginPct  = summary?.total_mrr ? (margin / summary.total_mrr) * 100 : 0
  const marginColor = marginPct >= 80 ? 'text-green-600' : marginPct >= 60 ? 'text-yellow-600' : 'text-red-500'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-[#c8522a] rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-red-500 font-mono">{error}</p>
      </div>
    )
  }

  return (
    <div className="px-8 py-8 max-w-7xl">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-widest uppercase text-[#c8522a] mb-2">Admin</p>
          <h1 className="text-2xl font-bold text-gray-900">Cost & Usage</h1>
          <p className="text-gray-500 text-sm mt-1">Current month · all accounts</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors border border-gray-200 rounded-xl px-3 py-2 mt-1"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="Monthly MRR"
          value={`$${summary?.total_mrr ?? 0}`}
          sub="from active plans"
          Icon={DollarSign}
          color="bg-[#c8522a]"
        />
        <SummaryCard
          label="AI Cost"
          value={fmt$(summary?.total_cost ?? 0)}
          sub="this month"
          Icon={Zap}
          color="bg-gray-700"
        />
        <SummaryCard
          label="Gross Margin"
          value={`$${margin.toFixed(2)}`}
          sub={
            <span className={marginColor}>{marginPct.toFixed(1)}% margin</span> as unknown as string
          }
          Icon={TrendingUp}
          color={marginPct >= 80 ? 'bg-green-500' : marginPct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}
        />
        <SummaryCard
          label="Active Accounts"
          value={String(summary?.active_accounts ?? 0)}
          sub={`${summary?.total_tasks ?? 0} tasks total`}
          Icon={Users}
          color="bg-blue-500"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {(['overview', 'runs'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'overview' ? 'Account overview' : `Run log (${runs.length})`}
          </button>
        ))}
      </div>

      {/* ── Overview tab ─────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {!sorted.length ? (
            <div className="text-center py-16">
              <p className="text-sm text-gray-400">No account data</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <ColHead label="Account"         k="company_name"     />
                  <ColHead label="Plan"            k="mrr_usd"          />
                  <ColHead label="MRR"             k="mrr_usd"          />
                  <ColHead label="Tasks"           k="tasks_this_month" />
                  <ColHead label="AI Cost"         k="cost_usd"         />
                  <ColHead label="Margin"          k="mrr_usd"          />
                  <ColHead label="Credits"         k="credits_remaining"/>
                </tr>
              </thead>
              <tbody>
                {sorted.map(a => {
                  const rowMargin = (a.mrr_usd ?? 0) - Number(a.cost_usd ?? 0)
                  const rowMarginPct = a.mrr_usd ? (rowMargin / a.mrr_usd) * 100 : null
                  return (
                    <tr key={a.user_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-gray-900">{accountLabel(a)}</p>
                      </td>
                      <td className="px-5 py-4">
                        {a.plan ? (
                          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${PLAN_COLORS[a.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                            {PLAN_LABELS[a.plan] ?? a.plan}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700 tabular-nums">
                        {a.mrr_usd ? `$${a.mrr_usd}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700 tabular-nums">
                        {a.tasks_this_month || <span className="text-gray-300">0</span>}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700 tabular-nums">
                        {Number(a.cost_usd) > 0 ? fmt$(Number(a.cost_usd)) : <span className="text-gray-300">$0</span>}
                      </td>
                      <td className="px-5 py-4">
                        {a.mrr_usd ? (
                          <div>
                            <p className={`text-sm font-medium tabular-nums ${rowMargin >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              ${rowMargin.toFixed(2)}
                            </p>
                            {rowMarginPct !== null && (
                              <p className="text-[10px] text-gray-400">{rowMarginPct.toFixed(1)}%</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm tabular-nums">
                        {a.credits_remaining != null ? (
                          <span className={a.credits_remaining < 20 ? 'text-red-500 font-medium' : 'text-gray-700'}>
                            {a.credits_remaining}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Run log tab ────────────────────────────────────────────── */}
      {tab === 'runs' && (
        <>
          <div className="flex gap-2 mb-4">
            {(['all', 'completed', 'failed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setRunFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  runFilter === f
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {f === 'all' ? `All (${runs.length})` : f === 'completed' ? `Completed (${runs.filter(r => r.status === 'completed').length})` : `Failed (${runs.filter(r => r.status === 'failed').length})`}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {!filteredRuns.length ? (
              <div className="text-center py-16">
                <p className="text-sm text-gray-400">No runs</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Time</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Account</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Job</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Model</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Tokens in / out</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Cost</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map(r => {
                    const acct = r.profiles?.company_name || r.profiles?.full_name || '—'
                    const job  = r.job_type || r.agent || '—'
                    const model = r.model
                      ? r.model.replace('anthropic/', '').replace('openai/', '')
                      : '—'
                    return (
                      <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">{relativeTime(r.created_at)}</td>
                        <td className="px-5 py-3 text-sm text-gray-700">{acct}</td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-mono bg-gray-50 border border-gray-100 px-2 py-0.5 rounded text-gray-600">{job}</span>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500 font-mono">{model}</td>
                        <td className="px-5 py-3 text-xs text-gray-500 tabular-nums">
                          {fmtTokens(r.input_tokens)} / {fmtTokens(r.output_tokens)}
                        </td>
                        <td className="px-5 py-3 text-sm tabular-nums">
                          {r.cost_usd && Number(r.cost_usd) > 0
                            ? <span className="text-gray-700">{fmt$(Number(r.cost_usd))}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status ?? 'pending'] ?? 'bg-gray-100 text-gray-500'}`}>
                            {r.status ?? 'pending'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
