'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useMayaContext } from '@/hooks/useMayaContext'
import { buildAdminClientsListMayaContext } from '@/lib/maya/summaries/adminContext'
import { useRouter } from 'next/navigation'
import {
  Users, AlertTriangle, TrendingUp, Activity,
  ChevronUp, ChevronDown, MoreHorizontal, Eye, Bell, Mail, Zap, Ban,
} from 'lucide-react'
import {
  clientHealthStatus,
  CLIENT_HEALTH_DOT,
  engagementScoreKnown,
} from '@/lib/clientHealth'

type Client = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  company_name: string | null
  instagram_handle: string | null
  plan: string | null
  status: string | null
  stripe_customer_id: string | null
  last_active_at: string | null
  engagement_score: number | null
  engagement_updated_at: string | null
  foundation_score: number | null
  created_at: string
  is_team_member?: boolean
  workspace_owner_id?: string | null
  workspace_company?: string | null
}

type SortKey = 'last_active_at' | 'engagement_score' | 'foundation_score' | 'plan' | 'created_at'

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter', growth: 'Growth', proagent: 'ProAgent',
}

const PLAN_COLORS: Record<string, string> = {
  starter:  'bg-gray-100 text-gray-600',
  growth:   'bg-blue-50 text-blue-600',
  proagent: 'bg-[#2D3748]/10 text-[#2D3748]',
}

const STATUS_DOT = CLIENT_HEALTH_DOT

const ACCOUNT_STATUS: Record<string, string> = {
  active:     'bg-emerald-50 text-emerald-700',
  onboarding: 'bg-gray-100 text-gray-600',
  paused:     'bg-amber-50 text-amber-700',
  churned:    'bg-red-50 text-red-600',
  suspended:  'bg-red-50 text-red-600',
}

function ScoreBar({ value, color }: { value: number | null; color: string }) {
  if (value == null) {
    return <span className="text-xs text-gray-300">—</span>
  }
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 tabular-nums w-7">{value}</span>
    </div>
  )
}

export default function ClientHealthView() {
  const router = useRouter()
  const [tab, setTab] = useState<'all' | 'at_risk'>('all')
  const [clients, setClients] = useState<Client[]>([])
  const [hiddenDuplicates, setHiddenDuplicates] = useState<{ email: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('last_active_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Row actions menu
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Nudge state
  const [nudging, setNudging] = useState<string | null>(null)
  const [nudged, setNudged] = useState<Set<string>>(new Set())

  const load = useCallback(async (searchVal = search) => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      sort: sortKey,
      order: sortAsc ? 'asc' : 'desc',
    })
    if (searchVal.trim()) params.set('search', searchVal.trim())
    if (planFilter !== 'all') params.set('plan', planFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)

    const res = await fetch(`/api/admin/clients?${params}`)
    const json = await res.json()
    if (!res.ok) {
      setError(`${res.status}: ${json.error ?? 'Unknown error'}`)
      setClients([])
      setHiddenDuplicates([])
    } else {
      setClients(json.clients ?? [])
      setHiddenDuplicates(json.duplicates ?? [])
    }
    setLoading(false)
  }, [sortKey, sortAsc, planFilter, statusFilter, search])

  useEffect(() => { load() }, [load])

  const mayaContext = useMemo(
    () => (loading ? null : buildAdminClientsListMayaContext(clients)),
    [clients, loading],
  )
  useMayaContext(mayaContext)

  // Debounce search
  function handleSearchChange(val: string) {
    setSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => load(val), 350)
  }

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function sendNudge(clientId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setMenuOpen(null)
    setNudging(clientId)
    await fetch('/api/admin/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, action: 'nudge' }),
    })
    setNudged(prev => new Set([...prev, clientId]))
    setNudging(null)
  }

  async function handleSuspend(clientId: string, currentStatus: string | null, e: React.MouseEvent) {
    e.stopPropagation()
    setMenuOpen(null)
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended'
    await fetch(`/api/admin/clients/${clientId}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, status: newStatus } : c))
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  const allWithStatus = clients.map(c => ({ ...c, _status: clientHealthStatus(c) }))
  const visibleClients = tab === 'at_risk'
    ? allWithStatus.filter(c => c._status === 'at_risk')
    : allWithStatus
  const atRiskCount  = allWithStatus.filter(c => c._status === 'at_risk').length
  const driftingCount = allWithStatus.filter(c => c._status === 'drifting').length
  const healthyCount = allWithStatus.filter(c => c._status === 'healthy').length

  const duplicateCount = hiddenDuplicates.length

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp size={10} className="text-gray-300" />
    return sortAsc
      ? <ChevronUp size={10} className="text-[#64748B]" />
      : <ChevronDown size={10} className="text-[#64748B]" />
  }

  function ColHeader({ label, k }: { label: string; k: SortKey }) {
    return (
      <th
        className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-600 select-none whitespace-nowrap"
        onClick={() => toggleSort(k)}
      >
        <span className="flex items-center gap-1">{label} <SortIcon k={k} /></span>
      </th>
    )
  }

  return (
    <div className="px-6 py-8 w-full max-w-none">
      <div className="mb-6">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-[#64748B] mb-2">Admin</p>
        <h1 className="text-2xl font-bold text-gray-900">Client Health</h1>
        <p className="text-gray-500 text-sm mt-1">
          {visibleClients.length} shown · {clients.length} canonical profile{clients.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Duplicate banner */}
      {duplicateCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-800">
            {duplicateCount} duplicate email{duplicateCount > 1 ? 's' : ''} collapsed — showing the active subscription profile per email. Hidden copies:{' '}
            {hiddenDuplicates.map(d => `${d.email} (${d.count - 1})`).join(', ')}
          </p>
        </div>
      )}

      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="Search name or email…"
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm w-64 outline-none focus:border-[#3B82F6]/40 transition-colors"
        />
        <select
          value={planFilter}
          onChange={e => setPlanFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#3B82F6]/40 bg-white"
        >
          <option value="all">All plans</option>
          <option value="starter">Starter</option>
          <option value="growth">Growth</option>
          <option value="proagent">ProAgent</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#3B82F6]/40 bg-white"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="onboarding">Onboarding</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {(['all', 'at_risk'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'all' ? 'All clients' : 'At risk'}
            {t === 'at_risk' && atRiskCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                {atRiskCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Summary cards — at risk tab only */}
      {tab === 'at_risk' && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={13} className="text-red-400" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">At risk</p>
            </div>
            <p className="text-2xl font-semibold text-red-500">{atRiskCount}</p>
            <p className="text-xs text-gray-400 mt-1">paid plan + inactive 48hrs+</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity size={13} className="text-yellow-400" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Drifting</p>
            </div>
            <p className="text-2xl font-semibold text-yellow-500">{driftingCount}</p>
            <p className="text-xs text-gray-400 mt-1">onboarding or inactive 24–48h</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={13} className="text-green-400" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Healthy</p>
            </div>
            <p className="text-2xl font-semibold text-green-500">{healthyCount}</p>
            <p className="text-xs text-gray-400 mt-1">used the app in the last 24h</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-[#3B82F6] rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-sm text-red-500 font-mono">{error}</p>
          </div>
        ) : !visibleClients.length ? (
          <div className="text-center py-16">
            <Users size={24} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              {tab === 'at_risk' ? 'No at-risk clients right now' : 'No clients'}
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[1180px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest min-w-[220px]">Client</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest min-w-[160px]">Company</th>
                <ColHeader label="Plan" k="plan" />
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">Account</th>
                <ColHeader label="Last active" k="last_active_at" />
                <ColHeader label="Engagement" k="engagement_score" />
                <ColHeader label="Foundation" k="foundation_score" />
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">Health</th>
                <ColHeader label="Joined" k="created_at" />
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {visibleClients.map(client => (
                <tr
                  key={client.id}
                  onClick={() => router.push(`/admin/clients/${client.id}`)}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      {client.avatar_url ? (
                        <img src={client.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#2D3748]/10 flex items-center justify-center flex-shrink-0 text-[#64748B] text-xs font-bold">
                          {(client.full_name || client.email || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">{client.full_name || '—'}</p>
                        <p className="text-xs text-gray-400">{client.email}</p>
                        {client.is_team_member && (
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-500 mt-1">
                            Team member
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      {client.company_name && (
                        <p className="text-sm text-gray-700">{client.company_name}</p>
                      )}
                      {client.is_team_member && client.workspace_company && client.workspace_company !== client.company_name && (
                        <p className="text-xs text-blue-500">via {client.workspace_company}</p>
                      )}
                      {client.instagram_handle && (
                        <p className="text-xs text-gray-400">@{client.instagram_handle}</p>
                      )}
                      {!client.company_name && !client.instagram_handle && (
                        <span className="text-gray-300">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {client.plan ? (
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${PLAN_COLORS[client.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                        {PLAN_LABELS[client.plan] ?? client.plan}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${ACCOUNT_STATUS[client.status ?? ''] ?? 'bg-gray-50 text-gray-500'}`}>
                      {client.status ?? 'unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap">{relativeTime(client.last_active_at)}</td>
                  <td className="px-4 py-4">
                    <ScoreBar
                      value={engagementScoreKnown(client) ? client.engagement_score : null}
                      color={
                        (client.engagement_score ?? 0) >= 50 ? 'bg-green-400' :
                        (client.engagement_score ?? 0) >= 30 ? 'bg-yellow-400' : 'bg-red-400'
                      }
                    />
                  </td>
                  <td className="px-4 py-4">
                    <ScoreBar
                      value={client.foundation_score}
                      color={
                        (client.foundation_score ?? 0) >= 70 ? 'bg-green-400' :
                        (client.foundation_score ?? 0) >= 40 ? 'bg-yellow-400' : 'bg-orange-400'
                      }
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[client._status]}`} />
                      <span className="text-xs text-gray-500 capitalize">{client._status.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-400 whitespace-nowrap">
                    {new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-4 relative" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setMenuOpen(menuOpen === client.id ? null : client.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {menuOpen === client.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-6 top-12 z-20 bg-white border border-gray-100 rounded-xl shadow-lg py-1.5 w-48"
                      >
                        <button
                          onClick={() => router.push(`/admin/clients/${client.id}`)}
                          className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Eye size={13} />
                          View profile →
                        </button>
                        <button
                          onClick={e => sendNudge(client.id, e)}
                          disabled={nudging === client.id || nudged.has(client.id)}
                          className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
                        >
                          <Bell size={13} />
                          {nudged.has(client.id) ? 'Nudge sent' : 'Send Maya nudge'}
                        </button>
                        <button
                          onClick={() => { setMenuOpen(null); router.push(`/admin/clients/${client.id}`) }}
                          className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Mail size={13} />
                          Send email
                        </button>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          onClick={() => { setMenuOpen(null); router.push(`/admin/clients/${client.id}`) }}
                          className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Zap size={13} />
                          Change plan
                        </button>
                        <button
                          onClick={e => handleSuspend(client.id, client.status, e)}
                          className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Ban size={13} />
                          {client.status === 'suspended' ? 'Reactivate account' : 'Suspend account'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
