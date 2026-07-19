'use client'

import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { useMayaContext } from '@/hooks/useMayaContext'
import { buildAgentCommandCenterMayaContext } from '@/lib/maya/summaries/agentsContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AGENTS, AgentId, AgentDefinition, AGENT_COLORS, COMMAND_CENTER_AGENTS } from '@/lib/agents/registry'
import { agentRunHref } from '@/lib/agents/guidedSetup'
import { agentDisplayName, friendlyRunError } from '@/lib/agents/agentRunUi'
import {
  contentPostingStatsAgentIds,
  isLegacyContentAgent,
} from '@/lib/agents/contentPosting'
import OrchestrationProgress from '@/components/agents/OrchestrationProgress'
import AgentIcon from '@/components/agents/AgentIcon'

// ── Types ──────────────────────────────────────────────────────────────────

interface AgentTask {
  id: string
  agent: string
  status: string
  priority: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  requires_approval: boolean
  approved_at: string | null
  rejected_at: string | null
  rejection_note: string | null
  error?: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  updated_at: string | null
  agent_outputs?: AgentOutput[]
}

interface AgentOutput {
  id: string
  task_id: string
  agent: string
  output_type: string
  title: string
  content: { raw?: string; parsed?: Record<string, unknown> } | string | null
  status: string
  created_at: string
}

interface ScorecardEntry {
  agentId: string
  name: string
  icon: string
  lastRunAt: string | null
  lastRunStatus: string | null
  lastRunError: string | null
  totalOutputs: number
  approvalRate: number | null
  isScheduled: boolean
  scheduleId: string | null
}

interface Props {
  profileId: string
  companyName: string
  foundationComplete: boolean
  activeTasks: AgentTask[]
  pendingApprovals: AgentTask[]
  recentTasks: AgentTask[]
  recentOutputs: AgentOutput[]
  scorecard: ScorecardEntry[]
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getOutputText(output: AgentOutput): string {
  const content = output.content
  if (!content) return ''
  if (typeof content === 'string') return content
  if (typeof content.raw === 'string') return content.raw
  if (content.parsed) return JSON.stringify(content.parsed, null, 2)
  return JSON.stringify(content, null, 2)
}

function getContentPreview(output: AgentOutput): string {
  const raw = getOutputText(output)
  return raw.length > 120 ? raw.slice(0, 120) + '…' : raw
}

function getOutputDescription(output: AgentOutput): string {
  const raw = getOutputText(output)
  const firstHeading = raw
    .split('\n')
    .map(line => line.trim())
    .find(line => line.startsWith('#'))
    ?.replace(/^#+\s*/, '')

  if (firstHeading) return firstHeading
  if (output.title) return output.title
  return getContentPreview(output) || 'Saved agent output'
}

function outputStatusMeta(status: string): { label: string; className: string } {
  switch (status) {
    case 'approved':
      return {
        label: 'Approved',
        className: 'border border-status-success/20 bg-status-success/10 text-status-success',
      }
    case 'rejected':
      return {
        label: 'Rejected',
        className: 'border border-status-danger/20 bg-status-danger/10 text-status-danger',
      }
    case 'pending_approval':
      return {
        label: 'In review',
        className: 'border border-status-warning/25 bg-status-warning/10 text-status-warning',
      }
    default:
      return {
        label: status.replace(/_/g, ' '),
        className: 'border border-border bg-surface-2 text-text-sec',
      }
  }
}

function OutputStatusBadge({ status }: { status: string }) {
  const meta = outputStatusMeta(status)
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  )
}

function LiveActivityCollapsible({
  title,
  count,
  defaultOpen = true,
  className = 'mb-5 last:mb-0',
  children,
}: {
  title: string
  count?: number
  defaultOpen?: boolean
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        className="mb-2 flex w-full items-center justify-between gap-2 rounded-lg py-1 text-left transition-colors hover:bg-surface-2"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">
          {title}
          {count !== undefined ? ` (${count})` : ''}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          className={`flex-shrink-0 text-text-muted transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
          aria-hidden
        />
      </button>
      {open ? children : null}
    </div>
  )
}

export default function AgentCommandCenter({
  profileId, companyName, foundationComplete,
  activeTasks: initActiveTasks,
  pendingApprovals: initPendingApprovals, recentTasks: initRecent, recentOutputs: initRecentOutputs, scorecard,
}: Props) {
  const router = useRouter()
  const [activeTasks, setActiveTasks] = useState(initActiveTasks)
  const [pendingApprovals, setPendingApprovals] = useState(initPendingApprovals)
  const [recentTasks, setRecentTasks] = useState(initRecent)
  const [recentOutputs, setRecentOutputs] = useState(initRecentOutputs)

  // Orchestration state
  const [activeOrchestration, setActiveOrchestration] = useState<string | null>(null)
  const [recentOrchestrations, setRecentOrchestrations] = useState<Array<{
    id: string
    triggered_by: string
    total_tasks: number
    completed_tasks: number
    total_cost_usd: number
    budget_exceeded: boolean
    completed_at: string | null
  }>>([])

  const agentList = useMemo(() => COMMAND_CENTER_AGENTS, [])

  function startSinglePostFlow() {
    router.push('/dashboard/agents/content-posting')
  }

  function handleAgentCardClick(agentId: AgentId) {
    router.push(agentRunHref(agentId))
  }

  const mayaContext = useMemo(() => buildAgentCommandCenterMayaContext({
    companyName,
    activeTaskCount: activeTasks.length,
    pendingApprovalCount: pendingApprovals.length,
    scorecard,
  }), [companyName, activeTasks.length, pendingApprovals.length, scorecard])

  useMayaContext(mayaContext)

  // Fetch active + recent orchestrations on mount
  useEffect(() => {
    fetch('/api/agents/orchestrations/active')
      .then(r => r.json())
      .then(data => { if (data.orchestration?.id) setActiveOrchestration(data.orchestration.id) })
      .catch(() => {})

    fetch('/api/agents/orchestrations/recent')
      .then(r => r.json())
      .then(data => { if (data.orchestrations) setRecentOrchestrations(data.orchestrations) })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`agent_tasks:user:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_tasks',
          filter: `user_id=eq.${profileId}`,
        },
        (payload) => {
          const updated = payload.new as AgentTask
          if (!updated) return

          if (updated.status === 'running' || updated.status === 'pending') {
            setActiveTasks(prev => {
              const exists = prev.find(t => t.id === updated.id)
              return exists
                ? prev.map(t => t.id === updated.id ? updated : t)
                : [updated, ...prev]
            })
          } else {
            setActiveTasks(prev => prev.filter(t => t.id !== updated.id))
          }

          if (
            updated.requires_approval &&
            updated.status === 'completed' &&
            !updated.approved_at &&
            !updated.rejected_at
          ) {
            setPendingApprovals(prev => {
              const exists = prev.find(t => t.id === updated.id)
              return exists ? prev.map(t => t.id === updated.id ? updated : t) : [updated, ...prev]
            })
          } else if (updated.approved_at || updated.rejected_at) {
            setPendingApprovals(prev => prev.filter(t => t.id !== updated.id))
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_outputs',
          filter: `user_id=eq.${profileId}`,
        },
        (payload) => {
          const output = payload.new as AgentOutput
          if (!output || output.status === 'pending_approval') return
          setPendingApprovals(prev => prev.filter(t => t.id !== output.task_id))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_outputs',
          filter: `user_id=eq.${profileId}`,
        },
        (payload) => {
          const output = payload.new as AgentOutput
          if (!output) return

          setRecentOutputs(prev => {
            if (prev.some(existing => existing.id === output.id)) return prev
            return [output, ...prev].slice(0, 50)
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profileId])


  const runningTasks = activeTasks.filter(t => t.status === 'running')
  const queuedTasks = activeTasks.filter(t => t.status === 'pending')
  const completedToday = recentTasks
    .filter(t => t.status === 'completed' && t.completed_at && (Date.now() - new Date(t.completed_at).getTime()) < 86400000)
    .slice(0, 5)
  const failedToday = recentTasks
    .filter(t => t.status === 'failed' && t.completed_at && (Date.now() - new Date(t.completed_at).getTime()) < 86400000)
    .slice(0, 5)
  const scorecardWithLiveCounts = scorecard.map(entry => ({
    ...entry,
    totalOutputs: Math.max(
      entry.totalOutputs,
      recentOutputs.filter(output => {
        if (entry.agentId === 'content_posting') {
          return contentPostingStatsAgentIds().includes(output.agent as AgentId)
        }
        return output.agent === entry.agentId
      }).length,
    ),
  }))
  const latestOutputs = recentOutputs.slice(0, 5)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-8">

      <section className="mb-6 overflow-hidden rounded-[24px] border border-border bg-surface shadow-[0_20px_60px_rgba(45,55,72,0.08)]">
        <div className="grid gap-0 lg:grid-cols-[1.35fr_0.9fr]">
          <div className="p-7">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-menu-muted">Agents</p>
            <h1 className="max-w-2xl text-[34px] font-semibold leading-tight text-text-primary">
              Agent Command Center
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-text-sec">
              Run focused marketing agents, review approval-required work, and open saved outputs from one workspace.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={startSinglePostFlow}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-[#2563EB]"
              >
                Content Posting
              </button>
              <a href="#run-agent" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:border-gray-200 hover:bg-surface-2">
                Run an agent
              </a>
              <Link href="/dashboard/agents/approvals" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:border-gray-200 hover:bg-surface-2">
                Review approvals
                {pendingApprovals.length > 0 && (
                  <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-xs font-semibold text-brand-primary">
                    {pendingApprovals.length}
                  </span>
                )}
              </Link>
            </div>
          </div>

          <div className="border-t border-border bg-surface-2 p-6 lg:border-l lg:border-t-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-menu-muted">Operating snapshot</p>
            <p className="mt-1 text-sm text-text-sec">{companyName} · {agentList.length} agents available</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-menu-muted">Running</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{runningTasks.length}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-menu-muted">Queued</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{queuedTasks.length}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-menu-muted">Approvals</p>
                <p className="mt-2 text-2xl font-semibold text-brand-primary">{pendingApprovals.length}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-menu-muted">Outputs</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{recentOutputs.length}</p>
              </div>
            </div>
          </div>
        </div>
      </section>


      <div id="run-agent" className="mb-6 rounded-2xl border border-gray-100 bg-white p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-menu-muted">Run an agent</p>
            <h2 className="mt-1 text-[18px] font-semibold text-text-primary">Choose the specialist for this task</h2>
            <p className="mt-1 text-sm text-text-sec">Each agent has a guided setup so the output comes back ready to review.</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {agentList.map((agent: AgentDefinition) => (
              <button
                key={agent.id}
                onClick={() => handleAgentCardClick(agent.id as AgentId)}
                className="group flex min-h-[118px] flex-col gap-3 rounded-2xl border border-border bg-surface p-4 text-left transition-all hover:border-gray-200 hover:bg-surface-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full transition-colors group-hover:bg-brand-primary/10 group-hover:text-brand-primary"
                    style={{
                      backgroundColor: AGENT_COLORS[agent.id as AgentId]?.bg ?? '#F3F4F6',
                      color: AGENT_COLORS[agent.id as AgentId]?.fg ?? '#6B7280',
                    }}
                  >
                    <AgentIcon agentId={agent.id} size={20} />
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    agent.defaultSchedule
                      ? 'bg-brand-primary/10 text-brand-primary'
                      : 'bg-surface-2 text-text-sec'
                  }`}>
                    {agent.id === 'content_posting'
                      ? 'Image · Video · Weekly'
                      : agent.defaultSchedule
                        ? 'Auto'
                        : agent.autonomyLevel === 'autonomous'
                          ? 'On request'
                          : 'Approval'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{agent.name}</p>
                  <p className="mt-1 text-xs leading-5 text-text-sec">{agent.description}</p>
                </div>
              </button>
          ))}
        </div>
      </div>

      {/* ═══ ZONE 1: Approval Queue Banner ═══ */}
      {pendingApprovals.length > 0 ? (
        <Link
          href="/dashboard/agents/approvals"
          className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-brand-primary/25 bg-brand-primary/5 p-5 no-underline transition-colors hover:border-brand-primary/50"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-primary">
              <span className="text-sm font-bold text-text-inverse">{pendingApprovals.length}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">
                {pendingApprovals.length} output{pendingApprovals.length !== 1 ? 's' : ''} waiting for your review
              </p>
              <p className="mt-1 truncate text-xs text-text-sec">
                {[...new Set(pendingApprovals.map(t => agentDisplayName(t.agent)))].slice(0, 3).join(', ')}
                {pendingApprovals.length > 3 ? ` +${pendingApprovals.length - 3} more` : ''}
              </p>
            </div>
          </div>
          <span className="flex-shrink-0 text-sm font-semibold text-brand-primary">Review</span>
        </Link>
      ) : (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-5">
          <i className="ti ti-circle-check text-status-success" style={{ fontSize: 16 }} />
          <span className="text-sm text-text-sec">Queue is clear. Nothing is waiting for review.</span>
        </div>
      )}

      {/* ═══ ZONE 2: Agent Activity ═══ */}
      <div className="mb-6 grid gap-6 xl:grid-cols-[0.9fr_1.25fr]">

        {/* Left: Live feed */}
        <div className="max-h-[360px] overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-menu-muted">Live activity</p>
          <p className="mt-1 mb-4 text-sm text-text-sec">
            Running and queued tasks show here first — expand completed and orchestration history when you need it.
          </p>

          {activeOrchestration ? (
            <OrchestrationProgress
              orchestrationId={activeOrchestration}
              onComplete={(session) => {
                setActiveOrchestration(null)
                setRecentOrchestrations(prev => [{
                  id: session.id,
                  triggered_by: session.triggered_by,
                  total_tasks: session.total_tasks,
                  completed_tasks: session.completed_tasks,
                  total_cost_usd: session.total_cost_usd,
                  budget_exceeded: session.budget_exceeded,
                  completed_at: session.completed_at,
                }, ...prev].slice(0, 5))
              }}
            />
          ) : (
            <>
              {runningTasks.length > 0 && (
                <div className="mb-5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">Running now</p>
                  {runningTasks.map(t => {
                    return (
                      <div key={t.id} className="flex items-center gap-3 border-b border-border py-2 last:border-0">
                        <div className="h-2 w-2 flex-shrink-0 rounded-full bg-status-success" style={{ animation: 'dotPulse 1.5s ease-in-out infinite' }} />
                        <AgentIcon agentId={t.agent} size={14} className="text-text-sec" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text-primary">{agentDisplayName(t.agent)}</p>
                        </div>
                        <span className="text-xs text-text-muted">{relativeTime(t.started_at)}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {queuedTasks.length > 0 && (
                <div className="mb-5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">Queued</p>
                  {queuedTasks.map(t => {
                    return (
                      <div key={t.id} className="flex items-center gap-3 border-b border-border py-2 last:border-0">
                        <div className="h-2 w-2 flex-shrink-0 rounded-full bg-border" />
                        <AgentIcon agentId={t.agent} size={14} className="text-text-muted" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-text-sec">{agentDisplayName(t.agent)}</p>
                        </div>
                        <span className="text-xs text-text-muted">Waiting</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {failedToday.length > 0 && (
                <div className="mb-5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">Failed today</p>
                  {failedToday.map(t => (
                    <div key={t.id} className="border-b border-border py-2 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />
                        <AgentIcon agentId={t.agent} size={14} className="text-text-muted" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text-primary">{agentDisplayName(t.agent)}</p>
                        </div>
                        <span className="text-xs text-text-muted">{relativeTime(t.completed_at)}</span>
                      </div>
                      <p className="mt-1 pl-7 text-[11px] leading-relaxed text-red-700">
                        {friendlyRunError(t.error)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {completedToday.length > 0 && (
                <LiveActivityCollapsible title="Completed today" count={completedToday.length}>
                  {completedToday.map(t => {
                    return (
                      <div key={t.id} className="flex items-center gap-3 border-b border-border py-2 last:border-0">
                        <i className="ti ti-check text-status-success" style={{ fontSize: 13 }} />
                        <AgentIcon agentId={t.agent} size={14} className="text-text-muted" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-text-sec">{agentDisplayName(t.agent)}</p>
                        </div>
                        <span className="text-xs text-text-muted">{relativeTime(t.completed_at)}</span>
                      </div>
                    )
                  })}
                </LiveActivityCollapsible>
              )}

              {activeTasks.length === 0 && completedToday.length === 0 && failedToday.length === 0 && (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-2">
                    <i className="ti ti-robot text-text-muted" style={{ fontSize: 18 }} />
                  </div>
                  <p className="text-sm font-medium text-text-primary">Your agents are ready.</p>
                  <p className="mt-1 text-xs text-text-muted">Run an agent to see live activity here.</p>
                </div>
              )}
            </>
          )}

          {/* Recent orchestrations */}
          {!activeOrchestration && recentOrchestrations.length > 0 && (
            <LiveActivityCollapsible
              title="Recent runs"
              count={recentOrchestrations.length}
              className="mt-5 border-t border-border pt-4"
            >
              {recentOrchestrations.map(orch => (
                <div key={orch.id} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
                  <div>
                    <p className="text-xs font-medium capitalize text-text-primary">
                      {orch.triggered_by.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {orch.completed_tasks} agents · {relativeTime(orch.completed_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      orch.budget_exceeded
                        ? 'bg-status-warning/10 text-status-warning'
                        : 'bg-status-success/10 text-status-success'
                    }`}>
                      {orch.budget_exceeded ? 'Budget reached' : 'Completed'}
                    </span>
                  </div>
                </div>
              ))}
            </LiveActivityCollapsible>
          )}
        </div>

        {/* Right: Scorecard */}
        <div className="min-w-0 max-h-[360px] overflow-y-auto overflow-x-auto rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-menu-muted">Agent scorecard</p>
          <p className="mt-1 mb-4 text-sm text-text-sec">
            Last run, saved output count, and schedule status per agent — open a row for the full archive.
          </p>
          {!foundationComplete && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
              <p className="text-xs leading-5 text-amber-900">
                <span className="font-semibold">Automatic runs are paused.</span>{' '}
                Agents marked Auto start running on their schedule once your Foundation is complete.{' '}
                <Link href="/foundation" className="font-semibold underline underline-offset-2">
                  Finish Foundation →
                </Link>
              </p>
            </div>
          )}
          <div className="grid min-w-[460px] grid-cols-[1fr_auto_auto_auto_28px] items-center gap-x-4">
            {/* Header */}
            <span className="border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">Agent</span>
            <span className="border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">Last run</span>
            <span className="border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">Outputs</span>
            <span className="border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">Status</span>
            <span className="border-b border-border pb-2 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted sr-only">
              Open
            </span>

            {scorecardWithLiveCounts.map(entry => (
              <Link
                key={entry.agentId}
                href={`/dashboard/agents/${entry.agentId}/outputs`}
                title={`Open ${entry.name} output archive`}
                className="col-span-5 grid grid-cols-subgrid items-center border-b border-border py-2.5 no-underline transition-colors hover:bg-surface-2 group"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: AGENT_COLORS[entry.agentId as AgentId]?.bg ?? '#F3F4F6',
                      color: AGENT_COLORS[entry.agentId as AgentId]?.fg ?? '#6B7280',
                    }}
                  >
                    <AgentIcon agentId={entry.agentId} size={14} />
                  </span>
                  <span className="whitespace-nowrap text-sm font-medium text-text-primary group-hover:text-brand-primary">
                    {entry.name}
                  </span>
                </span>
                <span className="whitespace-nowrap text-xs text-text-sec">
                  {relativeTime(entry.lastRunAt)}
                </span>
                <span className={`text-center text-xs ${entry.totalOutputs > 0 ? 'font-semibold text-brand-primary' : 'text-text-sec'}`}>
                  {entry.totalOutputs}
                </span>
                <span>
                  {entry.lastRunStatus === 'failed' ? (
                    <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700" title={entry.lastRunError ?? undefined}>
                      Failed
                    </span>
                  ) : entry.isScheduled ? (
                    <span className="rounded-full bg-status-success/10 px-2 py-1 text-[11px] font-semibold text-status-success">Active</span>
                  ) : !foundationComplete && AGENTS[entry.agentId as AgentId]?.defaultSchedule ? (
                    <span
                      className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700"
                      title="This agent runs on a schedule once your Foundation is complete"
                    >
                      Needs Foundation
                    </span>
                  ) : (
                    <span className="rounded-full border border-border bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-sec">Idle</span>
                  )}
                </span>
                <span className="flex justify-center text-brand-primary opacity-50 transition-opacity group-hover:opacity-100">
                  <ExternalLink size={14} strokeWidth={2} aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ ZONE 2B: Agent Outputs ═══ */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-menu-muted">Recent outputs</p>
            <p className="mt-1 text-sm text-text-sec">Open an output archive to read the full result.</p>
          </div>
          <Link href="/dashboard/agents/approvals" className="text-sm font-semibold text-brand-primary hover:underline">
            Review approvals
          </Link>
        </div>

        {latestOutputs.length > 0 ? (
          <div className="grid gap-2">
            {latestOutputs.map(output => {
              const agent = AGENTS[output.agent as AgentId]
              const displayName = isLegacyContentAgent(output.agent)
                ? AGENTS.content_posting.name
                : (agent?.name ?? output.agent)
              return (
                <Link
                  key={output.id}
                  href={`/dashboard/agents/${output.agent}/outputs?output=${output.id}`}
                  className="flex min-w-0 items-center justify-between gap-4 overflow-hidden rounded-xl border border-gray-100 bg-white px-4 py-3 no-underline transition-colors hover:border-gray-200 hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {getOutputDescription(output)}
                    </p>
                    <p className="mt-1 text-xs text-text-sec">
                      {displayName} · {relativeTime(output.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <OutputStatusBadge status={output.status} />
                    <span className="whitespace-nowrap text-sm font-semibold text-brand-primary">Open</span>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-text-sec">
              Saved auto-agent outputs will appear here as one-line links.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes dotPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
