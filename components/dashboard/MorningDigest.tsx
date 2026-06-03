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
  const className =
    c.includes('instagram') || c.includes('social') ? 'bg-brand-accent text-text-inverse' :
    c.includes('email')                              ? 'bg-brand-secondary text-text-inverse' :
    c.includes('ad')                                 ? 'bg-brand-primary text-text-inverse' :
    'bg-menu-muted text-text-inverse'
  return (
    <span className={`flex-shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-[0.04em] ${className}`}>
      {label}
    </span>
  )
}

function DigestSkeleton() {
  return (
    <div className="mb-6 animate-pulse rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-6 w-6 rounded-lg bg-border" />
        <div className="h-4 w-12 rounded bg-border" />
      </div>
      <div className="mb-6 h-4 w-64 rounded bg-border" />
      <div className="space-y-3">
        <div className="h-3 w-24 rounded bg-border" />
        <div className="h-4 w-full rounded bg-border" />
        <div className="h-4 w-4/5 rounded bg-border" />
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
    <div className="mb-6 rounded-2xl border border-border bg-surface p-6">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-secondary">
              <span className="text-xs font-bold text-text-inverse">M</span>
            </div>
            <span className="text-sm font-semibold text-text-primary">Maya daily brief</span>
          </div>
          <p className="text-sm text-text-sec">
            {getGreeting()}{firstName ? `, ${firstName}` : ''}. Here is what happened overnight.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="mt-0.5 text-xs text-text-sec transition-colors hover:text-text-primary"
        >
          Dismiss
        </button>
      </div>

      {/* What I did */}
      {hasActivity && (
        <div className="mb-6">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-menu-muted">What I did</p>
          <div className="space-y-2">
            {agentRuns.map((run, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl py-1.5">
                <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-status-success" />
                <p className="text-sm text-text-primary">
                  <span className="mr-1.5 font-medium text-text-sec">{run.agentName}</span>
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
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-menu-muted">
            What needs you
            <span className="ml-2 rounded-full bg-brand-primary/10 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-brand-primary">
              {approvals.length}
            </span>
          </p>
          <div className="space-y-3">
            {approvals.map(item => (
              <div key={item.taskId} className="rounded-xl border border-border bg-surface-2 p-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-text-sec">{item.agentName}</span>
                  <span className="text-xs text-text-muted">{formatRelative(item.createdAt)}</span>
                </div>
                {item.preview && (
                  <p className="mb-3 line-clamp-2 text-sm text-text-primary">{item.preview}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(item.taskId)}
                    className="flex-1 rounded-lg bg-brand-secondary py-2 text-xs font-medium text-text-inverse transition-colors hover:bg-[#1E293B]"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(item.taskId)}
                    className="flex-1 rounded-lg border border-border bg-surface py-2 text-xs font-medium text-text-primary transition-colors hover:border-border-strong"
                  >
                    Reject
                  </button>
                  <Link
                    href={`/dashboard/agents/approvals?task=${item.taskId}`}
                    className="whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-brand-primary transition-colors hover:border-border-strong"
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
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-menu-muted">Today&apos;s plan</p>
          <div className="space-y-1">
            {digest.today_actions.map((action, i) => (
              <div key={i} className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
                <div className="flex min-w-0 items-center gap-3">
                  <ChannelLabel channel={action.channel} />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text-primary">{action.task}</p>
                    <p className="truncate text-xs text-text-sec">{action.campaignTitle}</p>
                  </div>
                </div>
                <button
                  onClick={() => dispatchMayaTask(action)}
                  className="ml-4 flex-shrink-0 whitespace-nowrap text-xs font-medium text-brand-primary hover:underline"
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
