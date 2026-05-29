'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AGENTS, AgentId, AgentDefinition } from '@/lib/agents/registry'

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
  created_at: string
  started_at: string | null
  completed_at: string | null
  agent_outputs?: AgentOutput[]
}

interface AgentOutput {
  id: string
  task_id: string
  agent: string
  output_type: string
  title: string
  content: { raw?: string; parsed?: Record<string, string> }
  status: string
  created_at: string
}

interface ScorecardEntry {
  agentId: string
  name: string
  icon: string
  lastRunAt: string | null
  totalOutputs: number
  approvalRate: number | null
  isScheduled: boolean
  scheduleId: string | null
}

interface Props {
  profileId: string
  companyName: string
  activeTasks: AgentTask[]
  pendingApprovals: AgentTask[]
  recentTasks: AgentTask[]
  scorecard: ScorecardEntry[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

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

function getContentPreview(output: AgentOutput): string {
  const raw = output.content?.raw ?? ''
  return raw.length > 120 ? raw.slice(0, 120) + '…' : raw
}

const STATUS_COLORS: Record<string, string> = {
  running: '#22c55e',
  pending: '#f59e0b',
  complete: '#6b7280',
  failed: '#ef4444',
  scheduled: '#3b82f6',
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function AgentCommandCenter({
  profileId, companyName, activeTasks: initActiveTasks,
  pendingApprovals: initPendingApprovals, recentTasks: initRecent, scorecard,
}: Props) {
  const [activeTasks, setActiveTasks] = useState(initActiveTasks)
  const [pendingApprovals, setPendingApprovals] = useState(initPendingApprovals)
  const [recentTasks] = useState(initRecent)
  const [approving, setApproving] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejectTarget, setRejectTarget] = useState<{ taskId: string; outputId: string } | null>(null)

  // New task form state
  const [selectedAgent, setSelectedAgent] = useState<AgentId | null>(null)
  const [taskInstructions, setTaskInstructions] = useState('')
  const [taskPriority, setTaskPriority] = useState<'normal' | 'high'>('normal')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Constraints state
  const [constraints, setConstraints] = useState('')
  const [savedConstraints, setSavedConstraints] = useState('')
  const [isCustomized, setIsCustomized] = useState(false)
  const [constraintsLastUpdated, setConstraintsLastUpdated] = useState<string | null>(null)
  const [savingConstraints, setSavingConstraints] = useState(false)
  const [constraintsSaved, setConstraintsSaved] = useState(false)

  const agentList = Object.values(AGENTS)

  const CONSTRAINT_TEMPLATES = [
    { label: 'No discounting', text: 'Never offer discounts, promotions, or reduced pricing without explicit client approval.' },
    { label: 'No delivery promises', text: 'Never promise specific delivery timelines, turnaround times, or completion dates.' },
    { label: 'No competitor mentions', text: 'Never name or reference specific competitors by name.' },
    { label: 'Route pricing to human', text: 'Always direct pricing and cost questions to a human team member.' },
    { label: 'No guarantees', text: 'Never promise specific results, outcomes, rankings, or revenue figures.' },
    { label: 'No sensitive topics', text: 'Never engage with political, religious, or controversial social topics.' },
  ]

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
            updated.status === 'complete' &&
            !updated.approved_at &&
            !updated.rejected_at
          ) {
            setPendingApprovals(prev => {
              const exists = prev.find(t => t.id === updated.id)
              return exists ? prev : [updated, ...prev]
            })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profileId])

  useEffect(() => {
    if (!selectedAgent) return
    setConstraints('')
    setSavedConstraints('')
    setIsCustomized(false)
    setConstraintsLastUpdated(null)

    fetch(`/api/agents/constraints?agentId=${selectedAgent}`)
      .then(r => r.json())
      .then(data => {
        const value = data.constraints ?? ''
        setConstraints(value)
        setSavedConstraints(value)
        setIsCustomized(!!data.constraints)
        setConstraintsLastUpdated(data.updated_at ?? null)
      })
      .catch(() => {})
  }, [selectedAgent])

  async function handleSaveConstraints() {
    if (!selectedAgent) return
    setSavingConstraints(true)
    try {
      await fetch('/api/agents/constraints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedAgent, constraints }),
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

  async function handleApprove(taskId: string, outputId: string) {
    setApproving(outputId)
    try {
      await fetch(`/api/agents/tasks/${taskId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputId }),
      })
      setPendingApprovals(prev => prev.filter(t => t.id !== taskId))
    } finally {
      setApproving(null)
    }
  }

  async function handleReject() {
    if (!rejectTarget) return
    setRejecting(rejectTarget.outputId)
    try {
      await fetch(`/api/agents/tasks/${rejectTarget.taskId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputId: rejectTarget.outputId, note: rejectNote }),
      })
      setPendingApprovals(prev => prev.filter(t => t.id !== rejectTarget.taskId))
      setRejectTarget(null)
      setRejectNote('')
    } finally {
      setRejecting(null)
    }
  }

  async function handleCreateTask() {
    if (!selectedAgent) return
    setSubmitting(true)
    try {
      await fetch('/api/agents/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: selectedAgent,
          input: { instructions: taskInstructions },
          priority: taskPriority,
        }),
      })
      setSubmitted(true)
      setTaskInstructions('')
      setSelectedAgent(null)
      setTimeout(() => setSubmitted(false), 3000)
    } finally {
      setSubmitting(false)
    }
  }

  const runningTasks = activeTasks.filter(t => t.status === 'running')
  const queuedTasks = activeTasks.filter(t => t.status === 'pending')
  const completedToday = recentTasks
    .filter(t => t.status === 'complete' && t.completed_at && (Date.now() - new Date(t.completed_at).getTime()) < 86400000)
    .slice(0, 5)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px 64px', fontFamily: 'var(--font-geist), system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0a0a0a', marginBottom: 4, letterSpacing: '-0.3px' }}>
          Agent Command Center
        </h1>
        <p style={{ fontSize: 14, color: '#888' }}>
          {companyName} · {agentList.length} agents available
        </p>
      </div>

      {/* ═══ ZONE 1: Needs Attention ═══ */}
      {pendingApprovals.length > 0 && (
        <div style={{ background: '#fafafa', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#bbb' }}>
              Needs your attention
            </span>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>{pendingApprovals.length}</span>
            </div>
          </div>

          {pendingApprovals.map((task, i) => {
            const agentDef = AGENTS[task.agent as AgentId]
            const outputs = task.agent_outputs ?? []
            const output = outputs[0]

            return (
              <div key={task.id}>
                {i > 0 && <div style={{ height: '0.5px', background: '#ebebeb', margin: '16px 0' }} />}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <i className={`ti ${agentDef?.icon ?? 'ti-robot'}`} style={{ fontSize: 16, color: '#555', marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#0a0a0a' }}>{agentDef?.name}</span>
                      <span style={{ fontSize: 11, color: '#bbb' }}>{relativeTime(task.completed_at)}</span>
                    </div>
                    {output && (
                      <>
                        <p style={{ fontSize: 14, color: '#0a0a0a', fontWeight: 500, marginBottom: 4 }}>{output.title}</p>
                        <p style={{ fontSize: 13, color: '#666', lineHeight: 1.55, marginBottom: 12 }}>
                          {getContentPreview(output)}
                        </p>
                      </>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => output && handleApprove(task.id, output.id)}
                        disabled={approving === output?.id}
                        style={{ padding: '6px 14px', borderRadius: 7, background: '#0a0a0a', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: approving === output?.id ? 0.6 : 1, fontFamily: 'inherit' }}
                      >
                        {approving === output?.id ? 'Approving…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => output && setRejectTarget({ taskId: task.id, outputId: output.id })}
                        style={{ padding: '6px 14px', borderRadius: 7, background: 'transparent', color: '#0a0a0a', border: '0.5px solid #ddd', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Edit &amp; resubmit
                      </button>
                      <button
                        onClick={() => output && setRejectTarget({ taskId: task.id, outputId: output.id })}
                        style={{ padding: '6px 14px', borderRadius: 7, background: 'transparent', color: '#bbb', border: 'none', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <p style={{ fontSize: 15, fontWeight: 500, color: '#0a0a0a', marginBottom: 8 }}>Reject and re-run?</p>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Tell the agent what to do differently. It'll re-run with your feedback.</p>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="What should the agent change? (optional)"
              rows={3}
              style={{ width: '100%', border: '0.5px solid #e0e0e0', borderRadius: 8, padding: 10, fontSize: 13, resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={handleReject} disabled={!!rejecting}
                style={{ flex: 1, padding: '8px 0', background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                {rejecting ? 'Rejecting…' : 'Reject & re-run'}
              </button>
              <button onClick={() => { setRejectTarget(null); setRejectNote('') }}
                style={{ padding: '8px 16px', background: 'transparent', color: '#888', border: '0.5px solid #ddd', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ZONE 2: Agent Activity ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, marginBottom: 24 }}>

        {/* Left: Live feed */}
        <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#bbb', marginBottom: 16 }}>Live activity</p>

          {runningTasks.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: '#aaa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Running now</p>
              {runningTasks.map(t => {
                const def = AGENTS[t.agent as AgentId]
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #f5f5f5' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'dotPulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
                    <i className={`ti ${def?.icon ?? 'ti-robot'}`} style={{ fontSize: 14, color: '#555' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, fontWeight: 500, color: '#0a0a0a' }}>{def?.name}</p>
                    </div>
                    <span style={{ fontSize: 11, color: '#bbb' }}>{relativeTime(t.started_at)}</span>
                  </div>
                )
              })}
            </div>
          )}

          {queuedTasks.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: '#aaa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Queued</p>
              {queuedTasks.map(t => {
                const def = AGENTS[t.agent as AgentId]
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #f5f5f5' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#e5e5e5', flexShrink: 0 }} />
                    <i className={`ti ${def?.icon ?? 'ti-robot'}`} style={{ fontSize: 14, color: '#bbb' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, color: '#888' }}>{def?.name}</p>
                    </div>
                    <span style={{ fontSize: 11, color: '#bbb' }}>Waiting</span>
                  </div>
                )
              })}
            </div>
          )}

          {completedToday.length > 0 && (
            <div>
              <p style={{ fontSize: 11, color: '#aaa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Completed today</p>
              {completedToday.map(t => {
                const def = AGENTS[t.agent as AgentId]
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #f5f5f5' }}>
                    <i className="ti ti-check" style={{ fontSize: 13, color: '#22c55e' }} />
                    <i className={`ti ${def?.icon ?? 'ti-robot'}`} style={{ fontSize: 14, color: '#bbb' }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12.5, color: '#555' }}>{def?.name}</p>
                    </div>
                    <span style={{ fontSize: 11, color: '#bbb' }}>{relativeTime(t.completed_at)}</span>
                  </div>
                )
              })}
            </div>
          )}

          {activeTasks.length === 0 && completedToday.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <i className="ti ti-robot" style={{ fontSize: 28, color: '#e0e0e0', display: 'block', marginBottom: 8 }} />
              <p style={{ fontSize: 13, color: '#ccc' }}>No activity yet</p>
              <p style={{ fontSize: 12, color: '#ddd' }}>Run an agent to get started</p>
            </div>
          )}
        </div>

        {/* Right: Scorecard */}
        <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#bbb', marginBottom: 16 }}>Agent scorecard</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0 16px', alignItems: 'center' }}>
            {/* Header */}
            <span style={{ fontSize: 10, color: '#ccc', textTransform: 'uppercase', paddingBottom: 8, borderBottom: '0.5px solid #f0f0f0' }}>Agent</span>
            <span style={{ fontSize: 10, color: '#ccc', textTransform: 'uppercase', paddingBottom: 8, borderBottom: '0.5px solid #f0f0f0' }}>Last run</span>
            <span style={{ fontSize: 10, color: '#ccc', textTransform: 'uppercase', paddingBottom: 8, borderBottom: '0.5px solid #f0f0f0' }}>Outputs</span>
            <span style={{ fontSize: 10, color: '#ccc', textTransform: 'uppercase', paddingBottom: 8, borderBottom: '0.5px solid #f0f0f0' }}>Status</span>

            {scorecard.map(entry => (
              <>
                <div key={`${entry.agentId}-name`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: '0.5px solid #f8f8f8' }}>
                  <i className={`ti ${entry.icon}`} style={{ fontSize: 14, color: '#888', flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: '#333', whiteSpace: 'nowrap' }}>{entry.name}</span>
                </div>
                <span key={`${entry.agentId}-last`} style={{ fontSize: 12, color: '#888', padding: '9px 0', borderBottom: '0.5px solid #f8f8f8', whiteSpace: 'nowrap' }}>
                  {relativeTime(entry.lastRunAt)}
                </span>
                <span key={`${entry.agentId}-count`} style={{ fontSize: 12, color: '#555', padding: '9px 0', borderBottom: '0.5px solid #f8f8f8', textAlign: 'center' }}>
                  {entry.totalOutputs}
                </span>
                <div key={`${entry.agentId}-status`} style={{ padding: '9px 0', borderBottom: '0.5px solid #f8f8f8' }}>
                  {entry.isScheduled ? (
                    <span style={{ fontSize: 11, background: '#f0f7f0', color: '#16a34a', borderRadius: 20, padding: '2px 8px' }}>Active</span>
                  ) : (
                    <span style={{ fontSize: 11, background: '#f5f5f5', color: '#aaa', borderRadius: 20, padding: '2px 8px' }}>Idle</span>
                  )}
                </div>
              </>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ ZONE 3: Create New Task ═══ */}
      <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: 24 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: '#0a0a0a', marginBottom: 4 }}>Run an agent</p>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Choose an agent and tell it what you need.</p>

        {/* Agent grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {agentList.map((agent: AgentDefinition) => {
            const isSelected = selectedAgent === agent.id
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(isSelected ? null : agent.id as AgentId)}
                style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', borderRadius: 10, border: isSelected ? '1px solid #0a0a0a' : '0.5px solid #ebebeb', background: isSelected ? '#fafafa' : '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = '#ccc' }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = '#ebebeb' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <i className={`ti ${agent.icon}`} style={{ fontSize: 20, color: isSelected ? '#0a0a0a' : '#888' }} />
                  <span style={{
                    fontSize: 10, borderRadius: 20, padding: '2px 7px', fontWeight: 500,
                    background: agent.autonomyLevel === 'autonomous' ? '#f0f0f0' : '#0a0a0a',
                    color: agent.autonomyLevel === 'autonomous' ? '#555' : '#fff',
                  }}>
                    {agent.autonomyLevel === 'autonomous' ? 'Auto' : 'Approval'}
                  </span>
                </div>
                <p style={{ fontSize: 12.5, fontWeight: 500, color: isSelected ? '#0a0a0a' : '#333', margin: 0 }}>{agent.name}</p>
                <p style={{ fontSize: 11, color: '#999', lineHeight: 1.4, margin: 0 }}>{agent.description}</p>
              </button>
            )
          })}
        </div>

        {/* Instructions + submit */}
        {selectedAgent && (
          <div style={{ borderTop: '0.5px solid #f0f0f0', paddingTop: 18 }}>
            <textarea
              value={taskInstructions}
              onChange={e => setTaskInstructions(e.target.value)}
              placeholder={`Tell ${AGENTS[selectedAgent].name} what you need — plain language...`}
              rows={3}
              style={{ width: '100%', border: '0.5px solid #e0e0e0', borderRadius: 8, padding: '10px 12px', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box', color: '#0a0a0a' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['normal', 'high'] as const).map(p => (
                  <button key={p} onClick={() => setTaskPriority(p)}
                    style={{ padding: '5px 12px', borderRadius: 20, border: taskPriority === p ? '1px solid #0a0a0a' : '0.5px solid #e0e0e0', background: taskPriority === p ? '#0a0a0a' : '#fff', color: taskPriority === p ? '#fff' : '#888', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
                    {p}
                  </button>
                ))}
              </div>
              <button
                onClick={handleCreateTask}
                disabled={submitting || submitted}
                style={{ marginLeft: 'auto', padding: '8px 24px', background: submitted ? '#16a34a' : '#0a0a0a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: submitting || submitted ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minWidth: 160 }}
              >
                {submitted ? '✓ Task queued' : submitting ? 'Queuing…' : `Run ${AGENTS[selectedAgent].name}`}
              </button>
            </div>

            {/* Constraints section */}
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '0.5px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#888', margin: 0 }}>
                    What this agent will never do
                  </p>
                  <p style={{ fontSize: 11.5, color: '#bbb', marginTop: 3 }}>
                    Brand safety guardrails — applied to every run
                  </p>
                </div>
                {isCustomized && (
                  <span style={{ fontSize: 11, padding: '2px 8px', background: '#f0fdf4', color: '#16a34a', borderRadius: 20, fontWeight: 500, flexShrink: 0 }}>
                    Customized
                  </span>
                )}
              </div>

              {/* Template quick-insert buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {CONSTRAINT_TEMPLATES.map(t => (
                  <button
                    key={t.label}
                    onClick={() => setConstraints(prev => prev ? `${prev}\n${t.text}` : t.text)}
                    style={{ padding: '3px 10px', borderRadius: 20, border: '0.5px solid #e0e0e0', background: '#fafafa', color: '#555', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#0a0a0a' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e0e0e0' }}
                  >
                    + {t.label}
                  </button>
                ))}
              </div>

              <textarea
                value={constraints}
                onChange={e => setConstraints(e.target.value)}
                rows={4}
                placeholder={AGENTS[selectedAgent].defaultConstraints}
                style={{ width: '100%', border: '0.5px solid #e0e0e0', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: '#0a0a0a', lineHeight: 1.6 }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                {constraints !== savedConstraints && (
                  <button
                    onClick={handleSaveConstraints}
                    disabled={savingConstraints}
                    style={{ padding: '6px 16px', background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: savingConstraints ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: savingConstraints ? 0.6 : 1 }}
                  >
                    {savingConstraints ? 'Saving…' : 'Save constraints'}
                  </button>
                )}
                {constraintsSaved && (
                  <span style={{ fontSize: 12, color: '#16a34a' }}>✓ Constraints saved</span>
                )}
                {constraintsLastUpdated && !constraintsSaved && (
                  <span style={{ fontSize: 11, color: '#ccc' }}>
                    Last updated {relativeTime(constraintsLastUpdated)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {!selectedAgent && (
          <div style={{ textAlign: 'center', color: '#ccc', fontSize: 13, padding: '8px 0' }}>
            Select an agent above to get started
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
