'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useMayaContext } from '@/hooks/useMayaContext'
import { useRegisterMayaFormSurface } from '@/context/MayaFormActuationContext'
import { buildAgentCommandCenterMayaContext } from '@/lib/maya/summaries/agentsContext'
import { AGENTS, type AgentId } from '@/lib/agents/registry'
import {
  AGENT_CONSTRAINT_TEMPLATES,
  AGENT_GUIDED_CONFIG,
  INITIAL_AGENT_FORMS,
  buildGuidedInstructions,
} from '@/lib/agents/guidedSetup'
import {
  friendlyRunError,
  runTrackerDoneState,
  runTrackerGeneratingMessage,
  type RunTracker,
} from '@/lib/agents/agentRunUi'
import AgentRunStatusBanner from '@/components/agents/AgentRunStatusBanner'

interface AgentTask {
  id: string
  status: string
  requires_approval: boolean
  approved_at: string | null
  rejected_at: string | null
  error?: string | null
}

interface Props {
  agentId: AgentId
  companyName: string
  profileWebsiteUrl?: string | null
  isTeamMember?: boolean
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

export default function AgentRunClient({
  agentId,
  companyName,
  profileWebsiteUrl = null,
  isTeamMember = false,
}: Props) {
  const agent = AGENTS[agentId]
  const config = AGENT_GUIDED_CONFIG[agentId]

  const [taskInstructions, setTaskInstructions] = useState('')
  const [taskPriority, setTaskPriority] = useState<'normal' | 'high'>('normal')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [agentForm, setAgentForm] = useState<Record<string, string>>(
    () => ({ ...INITIAL_AGENT_FORMS[agentId] }),
  )
  const [taskCreateError, setTaskCreateError] = useState<string | null>(null)
  const [runTracker, setRunTracker] = useState<RunTracker | null>(null)

  const [constraints, setConstraints] = useState('')
  const [savedConstraints, setSavedConstraints] = useState('')
  const [isCustomized, setIsCustomized] = useState(false)
  const [constraintsLastUpdated, setConstraintsLastUpdated] = useState<string | null>(null)
  const [savingConstraints, setSavingConstraints] = useState(false)
  const [constraintsSaved, setConstraintsSaved] = useState(false)

  const mayaContext = useMemo(() => {
    const filled = config.fields
      .filter(field => agentForm[field.key]?.trim())
      .map(field => `${field.label}: ${agentForm[field.key].trim()}`)

    const empty = config.fields
      .filter(field => !agentForm[field.key]?.trim())
      .map(field => field.label)

    return {
      ...buildAgentCommandCenterMayaContext({
        companyName,
        activeTaskCount: runTracker?.phase === 'generating' ? 1 : 0,
        pendingApprovalCount: 0,
        scorecard: [],
      }),
      activeView: {
        label: `${agent.name} setup`,
        state: filled.length
          ? `${filled.join(' · ')}${empty.length ? ` · Empty on screen: ${empty.join(', ')}` : ''}`
          : `Setup open — nothing filled yet (${empty.join(', ')})`,
      },
      affordance: `The user is on the ${agent.name} run page with the setup form visible. Use visible field values — do not ask for information already shown in the form.${profileWebsiteUrl?.trim() ? ` Canonical website on profile: ${profileWebsiteUrl.trim()} — never change the domain or TLD in websiteUrl.` : ''} They can ask you to fill empty fields — propose values and they will click Apply in chat.`,
    }
  }, [agent.name, agentForm, companyName, config.fields, profileWebsiteUrl, runTracker?.phase])

  const formSurfaceDescriptor = useMemo(() => ({
    id: `agent:${agentId}`,
    label: `${agent.name} setup form`,
    canonicalWebsite: profileWebsiteUrl,
    fields: config.fields.map(field => ({
      key: field.key,
      label: field.label,
      type: (field.type === 'select'
        ? 'select'
        : field.type === 'textarea'
          ? 'textarea'
          : 'text') as 'text' | 'textarea' | 'select',
      options: field.options,
    })),
  }), [agent.name, agentId, config.fields, profileWebsiteUrl])

  useRegisterMayaFormSurface(
    formSurfaceDescriptor,
    () => agentForm,
    patch => setAgentForm(prev => ({ ...prev, ...patch })),
  )

  useMayaContext(mayaContext)

  useEffect(() => {
    setConstraints('')
    setSavedConstraints('')
    setIsCustomized(false)
    setConstraintsLastUpdated(null)

    fetch(`/api/agents/constraints?agentId=${agentId}`)
      .then(r => r.json())
      .then(data => {
        const value = data.constraints ?? ''
        setConstraints(value)
        setSavedConstraints(value)
        setIsCustomized(!!data.constraints)
        setConstraintsLastUpdated(data.updated_at ?? null)
      })
      .catch(() => {})
  }, [agentId])

  async function handleSaveConstraints() {
    setSavingConstraints(true)
    try {
      await fetch('/api/agents/constraints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, constraints }),
      })
      setSavedConstraints(constraints)
      setIsCustomized(true)
      setConstraintsLastUpdated(new Date().toISOString())
      setConstraintsSaved(true)
      setTimeout(() => setConstraintsSaved(false), 2500)
    } finally {
      setSavingConstraints(false)
    }
  }

  async function pollTaskRun(taskId: string) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      const res = await fetch(`/api/agents/tasks/${taskId}`)
      if (!res.ok) continue

      const data = await res.json().catch(() => ({}))
      const task = data.task as AgentTask | undefined
      if (!task) continue

      if (task.status === 'pending' || task.status === 'running') {
        setRunTracker(prev => prev?.taskId === taskId ? {
          ...prev,
          phase: 'generating',
          message: runTrackerGeneratingMessage(agentId),
          detail: undefined,
        } : prev)
        continue
      }

      if (task.status === 'completed') {
        setRunTracker({
          taskId,
          agent: agentId,
          phase: 'done',
          ...runTrackerDoneState(taskId, agentId, undefined, task.requires_approval, isTeamMember),
        })
        return
      }

      if (task.status === 'failed') {
        setRunTracker({
          taskId,
          agent: agentId,
          phase: 'error',
          message: 'Run failed',
          detail: friendlyRunError(task.error),
        })
        return
      }
    }

    setRunTracker({
      taskId,
      agent: agentId,
      phase: 'error',
      message: 'Run is taking longer than expected',
      detail: 'Refresh the page in a moment, or check Live activity on the Agents page.',
    })
  }

  async function handleCreateTask() {
    setTaskCreateError(null)
    setSubmitting(true)
    try {
      const instructions = buildGuidedInstructions(agentId, agentForm, taskInstructions)
      const input: Record<string, unknown> = { instructions, ...agentForm }

      const res = await fetch('/api/agents/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: agentId,
          input,
          priority: taskPriority,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTaskCreateError(typeof data.error === 'string' ? data.error : 'Could not queue this agent run.')
        return
      }

      setSubmitted(true)
      setTaskInstructions('')
      setTimeout(() => setSubmitted(false), 3000)

      if (typeof data.taskId === 'string') {
        setRunTracker({
          taskId: data.taskId,
          agent: agentId,
          phase: 'generating',
          message: runTrackerGeneratingMessage(agentId),
        })
        void pollTaskRun(data.taskId)
      }
    } finally {
      setSubmitting(false)
    }
  }

  function updateAgentForm(key: string, value: string) {
    setAgentForm(prev => ({ ...prev, [key]: value }))
  }

  const controlClass = 'w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-brand-primary'
  const isRunning = runTracker?.phase === 'generating'

  return (
    <>
      {runTracker && (
        <AgentRunStatusBanner tracker={runTracker} onDismiss={() => setRunTracker(null)} />
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6">
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-6">
          {config.fields.map(field => {
            const type = field.type ?? 'text'
            const columnSpan = field.columns === 1 ? 6 : field.columns === 3 ? 2 : 3
            const spanClass = columnSpan === 6 ? 'sm:col-span-6' : columnSpan === 2 ? 'sm:col-span-2' : 'sm:col-span-3'

            return (
              <label key={field.key} className={`grid gap-1.5 ${spanClass}`}>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">
                  {field.label}
                </span>
                {type === 'select' ? (
                  <select
                    value={agentForm[field.key] ?? ''}
                    onChange={e => updateAgentForm(field.key, e.target.value)}
                    className={controlClass}
                  >
                    {(field.options ?? []).map(option => <option key={option}>{option}</option>)}
                  </select>
                ) : type === 'textarea' ? (
                  <textarea
                    value={agentForm[field.key] ?? ''}
                    onChange={e => updateAgentForm(field.key, e.target.value)}
                    rows={field.columns === 1 ? 4 : 3}
                    placeholder={field.placeholder}
                    className={`${controlClass} resize-y leading-6`}
                  />
                ) : (
                  <input
                    value={agentForm[field.key] ?? ''}
                    onChange={e => updateAgentForm(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className={controlClass}
                  />
                )}
              </label>
            )
          })}
        </div>

        <label className="mb-6 grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">
            Additional instructions
          </span>
          <textarea
            value={taskInstructions}
            onChange={e => setTaskInstructions(e.target.value)}
            placeholder={`Optional: add anything specific ${agent.name} should know for this run.`}
            rows={3}
            className={`${controlClass} resize-y leading-6`}
          />
        </label>

        <div className="mb-6 border-t border-border pt-5">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">
                What this agent will never do
              </p>
              <p className="mt-1 text-xs text-text-sec">
                Brand safety guardrails applied to every run.
              </p>
            </div>
            {isCustomized && (
              <span className="flex-shrink-0 rounded-full bg-status-success/10 px-2.5 py-1 text-xs font-semibold text-status-success">
                Customized
              </span>
            )}
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {AGENT_CONSTRAINT_TEMPLATES.map(t => (
              <button
                key={t.label}
                type="button"
                onClick={() => setConstraints(prev => prev ? `${prev}\n${t.text}` : t.text)}
                className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-sec transition-colors hover:border-gray-200 hover:text-text-primary"
              >
                + {t.label}
              </button>
            ))}
          </div>

          <textarea
            value={constraints}
            onChange={e => setConstraints(e.target.value)}
            rows={4}
            placeholder={agent.defaultConstraints}
            className={`${controlClass} resize-none leading-6`}
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {constraints !== savedConstraints && (
              <button
                type="button"
                onClick={handleSaveConstraints}
                disabled={savingConstraints}
                className="rounded-xl bg-brand-primary px-4 py-2 text-xs font-semibold text-text-inverse transition-colors hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingConstraints ? 'Saving…' : 'Save constraints'}
              </button>
            )}
            {constraintsSaved && (
              <span className="text-xs font-medium text-status-success">Constraints saved</span>
            )}
            {constraintsLastUpdated && !constraintsSaved && (
              <span className="text-xs text-text-muted">
                Last updated {relativeTime(constraintsLastUpdated)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          {taskCreateError && (
            <p className="w-full text-sm text-red-600">{taskCreateError}</p>
          )}
          <div className="flex gap-2">
            {(['normal', 'high'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setTaskPriority(p)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  taskPriority === p
                    ? 'border border-brand-primary bg-brand-primary/10 text-brand-primary'
                    : 'border border-border bg-surface-2 text-text-sec hover:border-border-strong'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleCreateTask}
            disabled={submitting || submitted || isRunning}
            className={`ml-auto min-w-[180px] rounded-xl px-5 py-3 text-sm font-semibold text-text-inverse transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              submitted ? 'bg-status-success' : 'bg-brand-primary hover:bg-[#2563EB]'
            }`}
          >
            {isRunning
              ? 'Generating…'
              : submitted
                ? 'Task queued'
                : submitting
                  ? 'Queuing...'
                  : `Run ${agent.name}`}
          </button>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-text-muted">
        Maya can help fill this form — ask in chat, then Apply suggested values.{' '}
        <Link href={`/dashboard/agents/${agentId}/outputs`} className="font-medium text-brand-primary hover:underline">
          View past outputs
        </Link>
      </p>
    </>
  )
}
