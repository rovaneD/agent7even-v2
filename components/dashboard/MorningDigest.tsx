'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronRight, Sparkles } from 'lucide-react'
import AgentIcon from '@/components/agents/AgentIcon'
import { formatDigestPreview } from '@/lib/agents/digestPreview'

const VISIBLE_APPROVALS = 3
const VISIBLE_RUNS = 2

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
  title?: string
  subtitle?: string
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
}

interface ColdOpenState {
  hasPlan: boolean
  pendingApprovals: number
  activeCampaigns: number
  agentsRun: number
  creditBalance: number | null
  topGoal: string | null
  primaryAction: { href: string; label: string }
}

interface Props {
  digest:    Digest | null
  profileId: string
  firstName?: string
  coldOpen:  ColdOpenState
  /** Regenerate today's digest when cached row predates the approval-query fix. */
  digestStale?: boolean
  /** Live pending-approval count — single source of truth for all brief surfaces. */
  livePendingCount: number
  livePendingItems: ApprovalItem[]
  /** Hide owner billing/credits stats for team members without billing permission. */
  showMediaCredits?: boolean
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatBriefDateTime(date: Date): { dateLine: string; timeLine: string } {
  return {
    dateLine: date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
    timeLine: date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }),
  }
}

function formatRelative(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function approvalRow(item: ApprovalItem) {
  if (item.title) {
    return { title: item.title, subtitle: item.subtitle ?? item.agentName }
  }
  const formatted = formatDigestPreview(item.preview, item.agentId)
  return { title: formatted.title, subtitle: formatted.subtitle }
}

function buildSummaryParts(pending: number, runs: number, actions: number): string[] {
  const parts: string[] = []
  if (pending > 0) parts.push(`${pending} output${pending === 1 ? '' : 's'} need your review`)
  if (runs > 0) parts.push(`${runs} agent run${runs === 1 ? '' : 's'} since yesterday`)
  if (actions > 0) parts.push(`${actions} item${actions === 1 ? '' : 's'} on today's plan`)
  return parts
}

function buildEmptyLine(state: ColdOpenState): string {
  if (!state.hasPlan) return 'Choose a plan to unlock agents, campaigns, and your workspace.'
  if (state.pendingApprovals > 0) return `${state.pendingApprovals} output${state.pendingApprovals === 1 ? '' : 's'} waiting in your approval queue.`
  if (state.activeCampaigns === 0) return 'Start a guided campaign and I will queue work for your approval.'
  if (state.agentsRun === 0) return 'Run a specialist agent — I will summarize what comes back here.'
  if (state.topGoal) return `Quiet since your last visit. Today: progress on ${state.topGoal}.`
  return 'Nothing urgent — pick your next move below.'
}

function openMayaPanel() {
  window.dispatchEvent(new CustomEvent('maya:open-panel'))
}

function DigestSkeleton() {
  return (
    <section className="mb-6 overflow-hidden rounded-[24px] border border-border bg-surface shadow-[0_20px_60px_rgba(45,55,72,0.08)]">
      <div className="animate-pulse p-8">
        <div className="mb-6 h-8 w-56 rounded-lg bg-border" />
        <div className="mb-3 h-4 w-96 max-w-full rounded bg-border" />
        <div className="mb-8 h-11 w-44 rounded-xl bg-border" />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="h-20 rounded-2xl bg-border" />
          <div className="h-20 rounded-2xl bg-border" />
          <div className="h-20 rounded-2xl bg-border" />
        </div>
      </div>
    </section>
  )
}

function StatPill({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-surface-2 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-menu-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{value}</p>
      {hint && <p className="mt-1.5 text-[10px] leading-snug text-text-muted">{hint}</p>}
    </div>
  )
}

export default function MorningDigest({
  digest: initialDigest,
  profileId,
  firstName,
  coldOpen,
  digestStale = false,
  livePendingCount,
  livePendingItems,
  showMediaCredits = true,
}: Props) {
  const [digest, setDigest] = useState<Digest | null>(initialDigest)
  const [loading, setLoading] = useState(initialDigest === null || digestStale)
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (initialDigest !== null && !digestStale) return
    setLoading(true)
    fetch('/api/digest/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ profileId, forceRegenerate: digestStale }),
    })
      .then(r => r.json())
      .then(({ digestId }) => {
        if (!digestId) { setLoading(false); return }
        return fetch(`/api/digest/${digestId}`)
          .then(r => r.json())
          .then(data => {
            setDigest(data)
            setLoading(false)
          })
      })
      .catch(() => setLoading(false))
  }, [profileId, initialDigest, digestStale]) // eslint-disable-line react-hooks/exhaustive-deps

  const agentRuns = useMemo(
    () => (digest?.agent_runs ?? []).filter(r => !isSystemAgent(r.agentId)),
    [digest?.agent_runs],
  )

  const pendingCount = livePendingCount
  const approvals = livePendingItems
  const hasActivity = agentRuns.length > 0
  const hasPending  = pendingCount > 0
  const hasActions  = (digest?.today_actions?.length ?? 0) > 0
  const hasBriefContent = hasActivity || hasPending || hasActions

  const summaryParts = buildSummaryParts(pendingCount, agentRuns.length, digest?.today_actions?.length ?? 0)
  const summaryLine = summaryParts.length > 0 ? summaryParts.join(' · ') : buildEmptyLine({ ...coldOpen, pendingApprovals: pendingCount })
  const visibleApprovals = approvals.slice(0, VISIBLE_APPROVALS)
  const hiddenApprovalCount = Math.max(0, pendingCount - VISIBLE_APPROVALS)

  if (loading) return <DigestSkeleton />

  function dispatchMayaTask(action: TodayAction) {
    window.dispatchEvent(new CustomEvent('maya:open-task', {
      detail: { task: action.task, context: action.campaignTitle },
    }))
  }

  const primaryHref = hasPending
    ? '/dashboard/agents/approvals'
    : coldOpen.primaryAction.href
  const primaryLabel = hasPending
    ? `Review approvals (${pendingCount})`
    : coldOpen.primaryAction.label

  const briefDateTime = now ? formatBriefDateTime(now) : null

  return (
    <section className="mb-6 overflow-hidden rounded-[24px] border border-border bg-surface shadow-[0_20px_60px_rgba(45,55,72,0.08)]">
      <div className="border-b border-border bg-gradient-to-br from-surface via-surface to-surface-2 px-8 pb-7 pt-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-secondary">
              <Sparkles size={18} className="text-text-inverse" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-menu-muted">Maya&apos;s brief</p>
          </div>
          {briefDateTime && now && (
            <div className="flex-shrink-0 text-right leading-tight">
              <time
                dateTime={now.toISOString()}
                className="block text-[11px] tabular-nums text-text-muted"
              >
                {briefDateTime.dateLine}
              </time>
              <time
                dateTime={now.toISOString()}
                className="block text-[10px] tabular-nums text-text-muted/80"
              >
                {briefDateTime.timeLine}
              </time>
            </div>
          )}
        </div>

        <h1 className="mt-5 text-[28px] font-semibold leading-tight tracking-tight text-text-primary sm:text-[32px]">
          {getGreeting()}{firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-text-sec">{summaryLine}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={primaryHref}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-[#2563EB]"
          >
            {primaryLabel}
            <ArrowRight size={15} />
          </Link>
          <button
            type="button"
            onClick={openMayaPanel}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-medium text-text-primary transition-colors hover:border-border-strong hover:bg-surface-2"
          >
            Talk to Maya
          </button>
        </div>

        <div className={`mt-6 grid gap-3 ${showMediaCredits ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <StatPill label="Approvals" value={pendingCount} hint="Outputs waiting for your review" />
          <StatPill label="Campaigns" value={coldOpen.activeCampaigns} hint="Active marketing plans" />
          {showMediaCredits && (
            <StatPill
              label="Media credits"
              value={coldOpen.creditBalance ?? '—'}
              hint="Images, video & publishing"
            />
          )}
        </div>
      </div>

      <div className="px-8 py-6">
        {hasPending && (
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-menu-muted">
                  Needs review
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Agent outputs waiting for sign-off before they move to Posts or your archive.
                </p>
              </div>
              {approvals.length > 0 && (
                <Link
                  href="/dashboard/agents/approvals"
                  className="text-xs font-semibold text-brand-primary hover:underline"
                >
                  Open queue
                </Link>
              )}
            </div>

            {visibleApprovals.length > 0 ? (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-gray-100 bg-white">
                {visibleApprovals.map(item => {
                  const row = approvalRow(item)
                  return (
                    <li key={item.taskId}>
                      <Link
                        href={`/dashboard/agents/approvals?task=${item.taskId}`}
                        className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2"
                      >
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface-2 text-text-sec group-hover:text-brand-primary">
                          <AgentIcon agentId={item.agentId} size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-text-primary">{row.title}</p>
                          <p className="truncate text-xs text-text-sec">
                            {item.agentName}
                            {row.subtitle && row.subtitle !== item.agentName ? ` · ${row.subtitle}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          <span className="hidden text-xs text-text-muted sm:inline">{formatRelative(item.createdAt)}</span>
                          <ChevronRight size={16} className="text-menu-muted group-hover:text-brand-primary" />
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Link
                href="/dashboard/agents/approvals"
                className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-4 transition-colors hover:border-border-strong"
              >
                <span className="text-sm font-medium text-text-primary">
                  {pendingCount} item{pendingCount === 1 ? '' : 's'} in your approval queue
                </span>
                <ChevronRight size={16} className="text-brand-primary" />
              </Link>
            )}

            {hiddenApprovalCount > 0 && (
              <Link
                href="/dashboard/agents/approvals"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-primary hover:underline"
              >
                View {hiddenApprovalCount} more in queue
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
        )}

        {hasActivity && (
          <div className="mb-6">
            <div className="mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-menu-muted">
                Since yesterday
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Specialist agents that finished a run since your last visit.
              </p>
            </div>
            <ul className="space-y-2">
              {agentRuns.slice(0, VISIBLE_RUNS).map((run, i) => (
                <li key={i} className="flex gap-3 rounded-xl bg-surface-2 px-4 py-3">
                  <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-status-success" />
                  <p className="text-sm leading-relaxed text-text-primary">
                    <span className="font-medium text-text-sec">{run.agentName}</span>
                    {' — '}
                    {run.summary}
                  </p>
                </li>
              ))}
            </ul>
            {agentRuns.length > VISIBLE_RUNS && (
              <p className="mt-2 text-xs text-text-muted">
                +{agentRuns.length - VISIBLE_RUNS} more run{agentRuns.length - VISIBLE_RUNS === 1 ? '' : 's'} completed
              </p>
            )}
          </div>
        )}

        {hasActions && digest && (
          <div>
            <div className="mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-menu-muted">
                Today&apos;s plan
              </p>
              <p className="mt-1 text-xs text-text-muted">
                First actions from your active campaign — tap Start to open Maya with that task loaded.
              </p>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-gray-100 bg-white">
              {digest.today_actions.map((action, i) => (
                <li key={i} className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {action.task.length > 88 ? `${action.task.slice(0, 88)}…` : action.task}
                    </p>
                    <p className="truncate text-xs text-text-sec">{action.campaignTitle}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dispatchMayaTask(action)}
                    className="flex-shrink-0 text-xs font-semibold text-brand-primary hover:underline"
                  >
                    Start
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!hasBriefContent && (
          <p className="text-sm text-text-sec">
            Your workspace is set up. Use the cards below to run agents, open campaigns, or connect analytics.
          </p>
        )}
      </div>
    </section>
  )
}

function isSystemAgent(agentId: string): boolean {
  return agentId === 'maya' || agentId.startsWith('foundation_')
}
