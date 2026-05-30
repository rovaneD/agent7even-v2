'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, AlertTriangle, TrendingUp, Activity, ChevronUp, ChevronDown, Send } from 'lucide-react'

type Client = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  plan: string | null
  status: string | null
  last_active_at: string | null
  engagement_score: number | null
  foundation_score: number | null
  created_at: string
  last_nudged_at: string | null
}

type SortKey = 'last_active_at' | 'engagement_score' | 'foundation_score' | 'plan' | 'created_at'

function clientStatus(c: Client): 'healthy' | 'drifting' | 'at_risk' {
  const now = Date.now()
  const lastActive = c.last_active_at ? new Date(c.last_active_at).getTime() : 0
  const hoursInactive = (now - lastActive) / (1000 * 60 * 60)
  const score = c.engagement_score ?? 0

  if (hoursInactive <= 24 && score >= 50) return 'healthy'
  if (hoursInactive > 48 || score < 30) return 'at_risk'
  return 'drifting'
}

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
  starter: 'Starter',
  growth: 'Growth',
  proagent: 'ProAgent',
}

const PLAN_COLORS: Record<string, string> = {
  starter: 'bg-gray-100 text-gray-600',
  growth: 'bg-blue-50 text-blue-600',
  proagent: 'bg-[#c8522a]/10 text-[#c8522a]',
}

const STATUS_DOT: Record<string, string> = {
  healthy: 'bg-green-400',
  drifting: 'bg-yellow-400',
  at_risk: 'bg-red-400',
}

function ScoreBar({ value, color }: { value: number | null; color: string }) {
  const pct = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 tabular-nums w-7">{value ?? 0}</span>
    </div>
  )
}

export default function ClientHealthView() {
  const [tab, setTab] = useState<'all' | 'at_risk'>('all')
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('last_active_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [nudging, setNudging] = useState<string | null>(null)
  const [nudged, setNudged] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const filter = tab === 'at_risk' ? '&filter=at_risk' : ''
    const res = await fetch(`/api/admin/clients?sort=${sortKey}&order=${sortAsc ? 'asc' : 'desc'}${filter}`)
    const json = await res.json()
    setClients(json.clients ?? [])
    setLoading(false)
  }, [tab, sortKey, sortAsc])

  useEffect(() => { load() }, [load])

  async function sendNudge(clientId: string) {
    setNudging(clientId)
    await fetch('/api/admin/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, action: 'nudge' }),
    })
    setNudged(prev => new Set([...prev, clientId]))
    setNudging(null)
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(v => !v)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const allWithStatus = clients.map(c => ({ ...c, _status: clientStatus(c) }))
  const atRiskCount  = allWithStatus.filter(c => c._status === 'at_risk').length
  const driftingCount = allWithStatus.filter(c => c._status === 'drifting').length
  const healthyCount = allWithStatus.filter(c => c._status === 'healthy').length

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp size={10} className="text-gray-300" />
    return sortAsc
      ? <ChevronUp size={10} className="text-[#c8522a]" />
      : <ChevronDown size={10} className="text-[#c8522a]" />
  }

  function ColHeader({ label, k }: { label: string; k: SortKey }) {
    return (
      <th
        className="text-left px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest cursor-pointer hover:text-gray-600 select-none"
        onClick={() => toggleSort(k)}
      >
        <span className="flex items-center gap-1">{label} <SortIcon k={k} /></span>
      </th>
    )
  }

  return (
    <div className="px-8 py-8 max-w-6xl">
      <div className="mb-6">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-[#c8522a] mb-2">Admin</p>
        <h1 className="text-2xl font-bold text-gray-900">Client Health</h1>
        <p className="text-gray-500 text-sm mt-1">{clients.length} clients</p>
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
            <p className="text-xs text-gray-400 mt-1">inactive 48hrs+ or score &lt; 30</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity size={13} className="text-yellow-400" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Drifting</p>
            </div>
            <p className="text-2xl font-semibold text-yellow-500">{driftingCount}</p>
            <p className="text-xs text-gray-400 mt-1">low engagement, still active</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={13} className="text-green-400" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Healthy</p>
            </div>
            <p className="text-2xl font-semibold text-green-500">{healthyCount}</p>
            <p className="text-xs text-gray-400 mt-1">active and engaged</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-[#c8522a] rounded-full animate-spin" />
          </div>
        ) : !allWithStatus.length ? (
          <div className="text-center py-16">
            <Users size={24} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No clients</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Client</th>
                <ColHeader label="Plan" k="plan" />
                <ColHeader label="Last active" k="last_active_at" />
                <ColHeader label="Engagement" k="engagement_score" />
                <ColHeader label="Foundation" k="foundation_score" />
                <th className="text-left px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Status</th>
                <ColHeader label="Joined" k="created_at" />
                {tab === 'at_risk' && <th />}
              </tr>
            </thead>
            <tbody>
              {allWithStatus.map(client => (
                <tr key={client.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#c8522a]/10 flex items-center justify-center flex-shrink-0 text-[#c8522a] text-xs font-bold">
                        {(client.full_name || client.email || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{client.full_name || '—'}</p>
                        <p className="text-xs text-gray-400">{client.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {client.plan ? (
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${PLAN_COLORS[client.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                        {PLAN_LABELS[client.plan] ?? client.plan}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{relativeTime(client.last_active_at)}</td>
                  <td className="px-6 py-4">
                    <ScoreBar
                      value={client.engagement_score}
                      color={
                        (client.engagement_score ?? 0) >= 50 ? 'bg-green-400' :
                        (client.engagement_score ?? 0) >= 30 ? 'bg-yellow-400' : 'bg-red-400'
                      }
                    />
                  </td>
                  <td className="px-6 py-4">
                    <ScoreBar
                      value={client.foundation_score}
                      color={
                        (client.foundation_score ?? 0) >= 70 ? 'bg-green-400' :
                        (client.foundation_score ?? 0) >= 40 ? 'bg-yellow-400' : 'bg-orange-400'
                      }
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[client._status]}`} />
                      <span className="text-xs text-gray-500 capitalize">{client._status.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  {tab === 'at_risk' && (
                    <td className="px-6 py-4">
                      <button
                        onClick={() => sendNudge(client.id)}
                        disabled={nudging === client.id || nudged.has(client.id)}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                          nudged.has(client.id)
                            ? 'bg-green-50 text-green-600 cursor-default'
                            : 'bg-[#c8522a]/10 text-[#c8522a] hover:bg-[#c8522a]/20 disabled:opacity-50'
                        }`}
                      >
                        <Send size={11} />
                        {nudged.has(client.id) ? 'Sent' : nudging === client.id ? 'Sending…' : 'Send Maya nudge'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
