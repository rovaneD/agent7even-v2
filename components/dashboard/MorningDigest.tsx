'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

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

function ChannelLabel({ channel }: { channel: string }) {
  const c = channel?.toLowerCase() ?? ''
  const label =
    c.includes('instagram') || c.includes('social') ? 'IG' :
    c.includes('email')                              ? 'EM' :
    c.includes('ad')                                 ? 'AD' :
    c.includes('seo')                                ? 'SE' : 'CH'
  const bg =
    c.includes('instagram') || c.includes('social') ? '#e1306c' :
    c.includes('email')                              ? '#2D3748' :
    c.includes('ad')                                 ? '#1877f2' :
    '#64748B'
  return (
    <span style={{ background: bg, color: '#fff', borderRadius: 5, padding: '2px 5px', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', flexShrink: 0 }}>
      {label}
    </span>
  )
}

function DigestSkeleton() {
  return (
    <div className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-6 mb-6 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-lg bg-[#E2E8F0]" />
        <div className="h-4 w-12 bg-[#E2E8F0] rounded" />
      </div>
      <div className="h-4 w-64 bg-[#E2E8F0] rounded mb-6" />
      <div className="space-y-3">
        <div className="h-3 w-24 bg-[#E2E8F0] rounded" />
        <div className="h-4 w-full bg-[#E2E8F0] rounded" />
        <div className="h-4 w-4/5 bg-[#E2E8F0] rounded" />
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

  if (dismissed) return null
  if (loading)   return <DigestSkeleton />
  if (!digest)   return null

  // Filter out maya chat tasks from "What I did" section
  const agentRuns = (digest.agent_runs ?? []).filter(r => r.agentId !== 'maya')

  const hasActivity = agentRuns.length > 0
  const hasPending  = approvals.length > 0
  const hasActions  = (digest.today_actions?.length ?? 0) > 0

  if (!hasActivity && !hasPending && !hasActions) return null

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

  return (
    <div className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-6 mb-6">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-lg bg-[#2D3748] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="text-sm font-semibold text-[#2D3748]">Maya</span>
          </div>
          <p className="text-sm text-[#64748B]">
            {getGreeting()}{firstName ? `, ${firstName}` : ''}. Here is what happened overnight.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-xs text-[#64748B] hover:text-[#2D3748] transition-colors mt-0.5"
        >
          Dismiss
        </button>
      </div>

      {/* What I did */}
      {hasActivity && (
        <div className="mb-6">
          <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest mb-3">What I did</p>
          <div className="space-y-2">
            {agentRuns.map((run, i) => (
              <div key={i} className="flex items-start gap-3 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] mt-2 flex-shrink-0" />
                <p className="text-sm text-[#2D3748]">
                  <span className="font-medium text-[#64748B] mr-1.5">{run.agentName}</span>
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
          <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest mb-3">
            What needs you
            <span className="ml-2 bg-[#3B82F6]/10 text-[#3B82F6] text-[10px] font-semibold px-1.5 py-0.5 rounded-full normal-case tracking-normal">
              {approvals.length}
            </span>
          </p>
          <div className="space-y-3">
            {approvals.map(item => (
              <div key={item.taskId} className="bg-white rounded-xl p-4 border border-[#E2E8F0]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-[#64748B]">{item.agentName}</span>
                  <span className="text-xs text-[#CBD5E1]">{formatRelative(item.createdAt)}</span>
                </div>
                {item.preview && (
                  <p className="text-sm text-[#2D3748] mb-3 line-clamp-2">{item.preview}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(item.taskId)}
                    className="flex-1 py-2 bg-[#2D3748] text-white text-xs font-medium rounded-lg hover:bg-[#1E293B] transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(item.taskId)}
                    className="flex-1 py-2 border border-[#E2E8F0] text-[#2D3748] text-xs font-medium rounded-lg hover:border-[#64748B] transition-colors"
                  >
                    Reject
                  </button>
                  <Link
                    href={`/dashboard/agents/approvals?task=${item.taskId}`}
                    className="px-3 py-2 border border-[#E2E8F0] text-[#3B82F6] text-xs font-medium rounded-lg hover:border-[#64748B] transition-colors whitespace-nowrap"
                  >
                    Review
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
          <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest mb-3">Today&apos;s plan</p>
          <div className="space-y-1">
            {digest.today_actions.map((action, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-[#E2E8F0] last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <ChannelLabel channel={action.channel} />
                  <div className="min-w-0">
                    <p className="text-sm text-[#2D3748] truncate">{action.task}</p>
                    <p className="text-xs text-[#64748B] truncate">{action.campaignTitle}</p>
                  </div>
                </div>
                <button
                  onClick={() => dispatchMayaTask(action)}
                  className="text-xs font-medium text-[#3B82F6] hover:underline whitespace-nowrap ml-4 flex-shrink-0"
                >
                  Do this with Maya
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
