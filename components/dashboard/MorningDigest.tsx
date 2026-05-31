'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface AgentRun {
  agentId: string
  agentName: string
  summary: string
  outputCount: number
  needsApproval: boolean
}

interface ApprovalItem {
  taskId: string
  agentId: string
  agentName: string
  preview: string
  createdAt: string
}

interface TodayAction {
  task: string
  channel: string
  campaignTitle: string
  cta: string
}

interface Digest {
  id: string
  agent_runs:    AgentRun[]
  approvals:     ApprovalItem[]
  today_actions: TodayAction[]
  dismissed:     boolean
}

interface Props {
  digest:    Digest | null
  profileId: string
  firstName?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatRelative(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ChannelIcon({ channel }: { channel: string }) {
  const c = channel?.toLowerCase() ?? ''
  const label =
    c.includes('instagram') || c.includes('social') ? 'IG' :
    c.includes('email')                              ? 'EM' :
    c.includes('ad')                                 ? 'AD' :
    c.includes('seo')                                ? 'SE' :
    '●'
  const bg =
    c.includes('instagram') || c.includes('social') ? '#e1306c' :
    c.includes('email')                              ? '#c8522a' :
    c.includes('ad')                                 ? '#1877f2' :
    '#6b7280'
  return (
    <span style={{ background: bg, color: '#fff', borderRadius: 5, padding: '2px 5px', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', flexShrink: 0 }}>
      {label}
    </span>
  )
}

function DigestSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-lg bg-gray-100" />
        <div className="h-4 w-12 bg-gray-100 rounded" />
      </div>
      <div className="h-4 w-64 bg-gray-100 rounded mb-6" />
      <div className="space-y-3">
        <div className="h-3 w-24 bg-gray-100 rounded" />
        <div className="h-4 w-full bg-gray-100 rounded" />
        <div className="h-4 w-4/5 bg-gray-100 rounded" />
      </div>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

export default function MorningDigest({ digest: initialDigest, profileId, firstName }: Props) {
  const [digest, setDigest]       = useState<Digest | null>(initialDigest)
  const [dismissed, setDismissed] = useState(initialDigest?.dismissed ?? false)
  const [approvals, setApprovals] = useState<ApprovalItem[]>(initialDigest?.approvals ?? [])
  const [loading, setLoading]     = useState(initialDigest === null)

  // If no digest yet, generate on mount
  useEffect(() => {
    if (initialDigest !== null) return
    fetch('/api/digest/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ profileId }),
    })
      .then(r => r.json())
      .then(({ digestId }) => {
        if (!digestId) { setLoading(false); return }
        return fetch(`/api/digest/${digestId}`)
          .then(r => r.json())
          .then(data => {
            setDigest(data)
            setApprovals(data?.approvals ?? [])
            setLoading(false)
          })
      })
      .catch(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (dismissed)                  return null
  if (loading)                    return <DigestSkeleton />
  if (!digest)                    return null

  const hasActivity = (digest.agent_runs?.length   ?? 0) > 0
  const hasPending  = approvals.length > 0
  const hasActions  = (digest.today_actions?.length ?? 0) > 0

  if (!hasActivity && !hasPending && !hasActions) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-lg bg-[#0a0a0a] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">Maya</span>
          </div>
          <p className="text-sm text-gray-500">
            {getGreeting()}{firstName ? `, ${firstName}` : ''}. Here&apos;s what happened overnight.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
        >
          Dismiss
        </button>
      </div>

      {/* What I did */}
      {hasActivity && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">What I did</p>
          <div className="space-y-2">
            {digest.agent_runs.map((run, i) => (
              <div key={i} className="flex items-start gap-3 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 flex-shrink-0" />
                <p className="text-sm text-gray-800">
                  <span className="font-medium text-gray-500 mr-1.5">{run.agentName}</span>
                  {run.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What needs you */}
      {hasPending && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            What needs you
            <span className="ml-2 bg-[#c8522a] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full normal-case tracking-normal">
              {approvals.length}
            </span>
          </p>
          <div className="space-y-3">
            {approvals.map(item => (
              <div key={item.taskId} className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-gray-600">{item.agentName}</span>
                  <span className="text-xs text-gray-400">{formatRelative(item.createdAt)}</span>
                </div>
                {item.preview && (
                  <p className="text-sm text-gray-700 mb-3 line-clamp-2">{item.preview}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(item.taskId)}
                    className="flex-1 py-2 bg-[#0a0a0a] text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(item.taskId)}
                    className="flex-1 py-2 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:border-gray-400 transition-colors"
                  >
                    Reject
                  </button>
                  <Link
                    href={`/dashboard/agents?task=${item.taskId}`}
                    className="px-3 py-2 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:border-gray-400 transition-colors whitespace-nowrap"
                  >
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's plan */}
      {hasActions && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Today&apos;s plan</p>
          <div className="space-y-1">
            {digest.today_actions.map((action, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ChannelIcon channel={action.channel} />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{action.task}</p>
                    <p className="text-xs text-gray-400 truncate">{action.campaignTitle}</p>
                  </div>
                </div>
                <button
                  onClick={() => dispatchMayaTask(action)}
                  className="text-xs font-medium text-[#c8522a] hover:underline whitespace-nowrap ml-4 flex-shrink-0"
                >
                  Do this with Maya →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  async function handleApprove(taskId: string) {
    await fetch(`/api/agents/tasks/${taskId}/approve`, { method: 'POST' })
    setApprovals(prev => prev.filter(a => a.taskId !== taskId))
  }

  async function handleReject(taskId: string) {
    await fetch(`/api/agents/tasks/${taskId}/reject`, { method: 'POST' })
    setApprovals(prev => prev.filter(a => a.taskId !== taskId))
  }

  async function handleDismiss() {
    setDismissed(true)
    await fetch(`/api/digest/${digest!.id}/dismiss`, { method: 'POST' })
  }

  function dispatchMayaTask(action: TodayAction) {
    window.dispatchEvent(new CustomEvent('maya:open-task', {
      detail: { task: action.task, context: action.campaignTitle },
    }))
  }
}
