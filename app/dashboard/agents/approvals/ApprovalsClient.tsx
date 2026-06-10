'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, ChevronUp, CheckCircle2, RotateCcw, ArrowLeft, Filter, SortDesc } from 'lucide-react'
import { AGENTS, AgentId } from '@/lib/agents/registry'

// ── Types ──────────────────────────────────────────────────────────────────

interface AgentOutput {
  id: string
  task_id: string
  agent: string
  output_type: string
  title: string | null
  content: { raw?: string; parsed?: Record<string, string> }
  status: string
  created_at: string
}

interface ApprovalTask {
  id: string
  agent: string
  status: string
  priority: string
  input: Record<string, unknown>
  requires_approval: boolean
  approved_at: string | null
  rejected_at: string | null
  rejection_note: string | null
  created_at: string
  completed_at: string | null
  agent_outputs: AgentOutput[]
}

interface Props {
  profileId: string
  initialTasks: ApprovalTask[]
}

// ── Quick rejection reasons ────────────────────────────────────────────────

const REJECTION_CHIPS = [
  { label: 'Off-brand tone',      note: 'The tone doesn\'t match our brand voice. Please rewrite to feel more on-brand.' },
  { label: 'Inaccurate info',     note: 'This contains inaccurate or outdated information. Please fact-check and rewrite.' },
  { label: 'Too long',            note: 'This is too long. Please condense to the key points.' },
  { label: 'Too aggressive',      note: 'The tone is too salesy/aggressive. Make it more conversational and helpful.' },
  { label: 'Wrong format',        note: 'The format is incorrect for this use case. Please follow the standard format.' },
  { label: 'Needs more detail',   note: 'This needs more depth and specificity. Please expand with relevant details.' },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7)   return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── ApprovalItem ───────────────────────────────────────────────────────────

function ApprovalItem({
  task,
  isExpanded,
  isChecked,
  hasReviewedOne,
  onToggleExpand,
  onToggleCheck,
  onApprove,
  onReject,
  onMarkReviewed,
}: {
  task: ApprovalTask
  isExpanded: boolean
  isChecked: boolean
  hasReviewedOne: boolean
  onToggleExpand: () => void
  onToggleCheck: () => void
  onApprove: (taskId: string, outputId: string, edited?: string) => Promise<void>
  onReject: (taskId: string, outputId: string, note: string, reason: string) => Promise<void>
  onMarkReviewed: () => void
}) {
  const agentDef  = AGENTS[task.agent as AgentId]
  const output    = task.agent_outputs?.[0]
  const raw       = output?.content?.raw ?? ''

  const [approving,   setApproving]   = useState(false)
  const [rejecting,   setRejecting]   = useState(false)
  const [isEditing,   setIsEditing]   = useState(false)
  const [editVal,     setEditVal]     = useState(raw)
  const [rejectNote,  setRejectNote]  = useState('')
  const [activeChip,  setActiveChip]  = useState<string | null>(null)
  const [showReject,  setShowReject]  = useState(false)

  function handleExpand() {
    onToggleExpand()
    if (!isExpanded) onMarkReviewed()
  }

  function selectChip(chip: { label: string; note: string }) {
    setActiveChip(chip.label)
    setRejectNote(chip.note)
    setShowReject(true)
  }

  async function doApprove() {
    if (!output) return
    setApproving(true)
    try {
      await onApprove(task.id, output.id, isEditing ? editVal : undefined)
    } finally {
      setApproving(false)
    }
  }

  async function doReject() {
    if (!output) return
    setRejecting(true)
    try {
      await onReject(task.id, output.id, rejectNote, activeChip ?? '')
      setShowReject(false)
      setRejectNote('')
      setActiveChip(null)
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div style={{ borderBottom: '0.5px solid #f0f0f0', paddingBottom: 20, marginBottom: 20 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Checkbox — only enabled after hasReviewedOne */}
        <div style={{ paddingTop: 2 }}>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={onToggleCheck}
            disabled={!hasReviewedOne}
            title={!hasReviewedOne ? 'Expand at least one item to enable bulk selection' : undefined}
            style={{ width: 14, height: 14, accentColor: '#3B82F6', cursor: hasReviewedOne ? 'pointer' : 'not-allowed', opacity: hasReviewedOne ? 1 : 0.4 }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Agent + meta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <i className={`ti ${agentDef?.icon ?? 'ti-robot'}`} style={{ fontSize: 14, color: '#888' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#2D3748' }}>{agentDef?.name ?? task.agent}</span>
            <span style={{ fontSize: 11, color: '#bbb' }}>{relativeTime(task.completed_at)}</span>
          </div>

          {/* Output title */}
          {output?.title && (
            <p style={{ fontSize: 14, fontWeight: 500, color: '#2D3748', marginBottom: 6 }}>{output.title}</p>
          )}

          {/* Collapsed preview */}
          {!isExpanded && raw && (
            <p style={{ fontSize: 13, color: '#666', lineHeight: 1.55, marginBottom: 10 }}>
              {raw.length > 180 ? raw.slice(0, 180) + '…' : raw}
            </p>
          )}

          {/* Expanded: full content or editor */}
          {isExpanded && (
            <div style={{ marginBottom: 12 }}>
              {isEditing ? (
                <textarea
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  rows={8}
                  style={{
                    width: '100%', border: '0.5px solid #2D3748', borderRadius: 8, padding: '10px 12px',
                    fontSize: 13, lineHeight: 1.6, resize: 'vertical', outline: 'none',
                    fontFamily: 'inherit', boxSizing: 'border-box', color: '#2D3748',
                  }}
                />
              ) : (
                <div style={{ background: '#fafafa', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#333', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                  {raw || <span style={{ color: '#ccc', fontStyle: 'italic' }}>No content</span>}
                </div>
              )}
            </div>
          )}

          {/* Expand / collapse */}
          <button
            onClick={handleExpand}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#888', background: 'none', border: 'none', padding: '0 0 12px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {isExpanded ? 'Collapse' : 'Read full output'}
          </button>

          {/* Quick rejection chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {REJECTION_CHIPS.map(chip => (
              <button
                key={chip.label}
                onClick={() => selectChip(chip)}
                style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  border: activeChip === chip.label ? '0.5px solid #3B82F6' : '0.5px solid #E2E8F0',
                  background: activeChip === chip.label ? '#fff5f2' : '#f8f8f8',
                  color: activeChip === chip.label ? '#3B82F6' : '#666',
                  transition: 'all 0.1s',
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Reject note (shown when chip selected or manually opened) */}
          {showReject && (
            <div style={{ marginBottom: 12 }}>
              <textarea
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="Rejection note for the agent (optional)"
                rows={2}
                style={{
                  width: '100%', border: '0.5px solid #E2E8F0', borderRadius: 8, padding: '8px 12px',
                  fontSize: 12.5, resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                  color: '#555',
                }}
              />
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isEditing ? (
              <>
                <button
                  onClick={doApprove}
                  disabled={approving}
                  style={{ padding: '6px 16px', borderRadius: 7, background: '#2D3748', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: approving ? 0.6 : 1, fontFamily: 'inherit' }}
                >
                  {approving ? 'Saving…' : 'Save edits & approve'}
                </button>
                <button
                  onClick={() => { setIsEditing(false); setEditVal(raw) }}
                  style={{ padding: '6px 14px', borderRadius: 7, background: 'transparent', color: '#888', border: '0.5px solid #ddd', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Cancel
                </button>
              </>
            ) : showReject ? (
              <>
                <button
                  onClick={doReject}
                  disabled={rejecting}
                  style={{ padding: '6px 16px', borderRadius: 7, background: '#3B82F6', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: rejecting ? 0.6 : 1, fontFamily: 'inherit' }}
                >
                  {rejecting ? 'Rejecting…' : 'Reject & re-run'}
                </button>
                <button
                  onClick={() => { setShowReject(false); setActiveChip(null); setRejectNote('') }}
                  style={{ padding: '6px 14px', borderRadius: 7, background: 'transparent', color: '#888', border: '0.5px solid #ddd', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={doApprove}
                  disabled={approving}
                  style={{ padding: '6px 16px', borderRadius: 7, background: '#2D3748', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: approving ? 0.6 : 1, fontFamily: 'inherit' }}
                >
                  {approving ? 'Approving…' : 'Approve'}
                </button>
                <button
                  onClick={() => { setIsEditing(true); setEditVal(raw); onToggleExpand() }}
                  style={{ padding: '6px 14px', borderRadius: 7, background: 'transparent', color: '#2D3748', border: '0.5px solid #ddd', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Edit &amp; approve
                </button>
                <button
                  onClick={() => setShowReject(true)}
                  style={{ padding: '6px 14px', borderRadius: 7, background: 'transparent', color: '#bbb', border: 'none', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Reject &amp; redo
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function ApprovalsClient({ profileId, initialTasks }: Props) {
  const searchParams = useSearchParams()
  const autoExpandId = searchParams.get('task')

  const [tasks,          setTasks]          = useState<ApprovalTask[]>(initialTasks)
  const [expanded,       setExpanded]       = useState<Set<string>>(new Set(autoExpandId ? [autoExpandId] : []))
  const [checkedIds,     setCheckedIds]     = useState<Set<string>>(new Set())
  const [hasReviewedOne, setHasReviewedOne] = useState(!!autoExpandId)
  const [agentFilter,    setAgentFilter]    = useState<string>('all')
  const [sortOrder,      setSortOrder]      = useState<'newest' | 'oldest'>('newest')
  const [bulkAction,     setBulkAction]     = useState<'approve' | 'reject' | null>(null)
  const [bulkNote,       setBulkNote]       = useState('')
  const [bulkLoading,    setBulkLoading]    = useState(false)

  // Scroll to auto-expanded task
  useEffect(() => {
    if (autoExpandId) {
      setTimeout(() => {
        document.getElementById(`task-${autoExpandId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 200)
    }
  }, [autoExpandId])

  // Maya canvas context
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('maya:canvas-context', {
      detail: {
        context: `APPROVAL QUEUE
Pending approvals: ${tasks.length}
The user is reviewing agent outputs. They can approve, edit-and-approve, or reject-and-redo each item. Bulk actions are available after expanding at least one item.`,
      },
    }))
  }, [tasks.length])

  // Derived: unique agents in queue
  const agentsInQueue = [...new Set(tasks.map(t => t.agent))]

  // Filtered + sorted
  const visible = tasks
    .filter(t => agentFilter === 'all' || t.agent === agentFilter)
    .sort((a, b) => {
      const da = new Date(a.created_at).getTime()
      const db = new Date(b.created_at).getTime()
      return sortOrder === 'newest' ? db - da : da - db
    })

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleCheck(id: string) {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setCheckedIds(new Set(visible.map(t => t.id)))
  }

  function deselectAll() {
    setCheckedIds(new Set())
  }

  function markReviewed() {
    setHasReviewedOne(true)
  }

  const removeTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setCheckedIds(prev => { const n = new Set(prev); n.delete(taskId); return n })
  }, [])

  async function handleApprove(taskId: string, outputId: string, edited?: string) {
    const body: Record<string, unknown> = { outputId }
    if (edited !== undefined) body.editedContent = edited
    await fetch(`/api/agents/tasks/${taskId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    removeTask(taskId)
  }

  async function handleReject(taskId: string, outputId: string, note: string, reason: string) {
    await fetch(`/api/agents/tasks/${taskId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outputId, note, feedback: reason, feedbackNote: note }),
    })
    removeTask(taskId)
  }

  async function handleBulkActionWith(action: 'approve' | 'reject') {
    if (checkedIds.size === 0) return
    setBulkLoading(true)
    try {
      await fetch('/api/agents/approvals/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          taskIds:      [...checkedIds],
          feedback:     action === 'reject' ? bulkNote : undefined,
          feedbackNote: action === 'reject' ? bulkNote : undefined,
        }),
      })
      const done = new Set(checkedIds)
      setTasks(prev => prev.filter(t => !done.has(t.id)))
      setCheckedIds(new Set())
      setBulkAction(null)
      setBulkNote('')
    } finally {
      setBulkLoading(false)
    }
  }

  async function handleBulkAction() {
    if (!bulkAction) return
    await handleBulkActionWith(bulkAction)
  }

  const allChecked = visible.length > 0 && visible.every(t => checkedIds.has(t.id))

  return (
    <div className="mx-auto max-w-[860px] px-4 pt-8 pb-16 sm:px-8" style={{ fontFamily: 'var(--font-geist), system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <Link
          href="/dashboard/agents"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#aaa', textDecoration: 'none', marginBottom: 14 }}
        >
          <ArrowLeft size={12} />
          Agent Command Center
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2D3748', letterSpacing: '-0.3px', margin: 0 }}>
            Approval Queue
          </h1>
          {tasks.length > 0 && (
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{tasks.length}</span>
            </div>
          )}
        </div>
        <p style={{ fontSize: 13.5, color: '#888', marginTop: 4 }}>
          Review agent outputs before they go anywhere. Expand an item to enable bulk selection.
        </p>
      </div>

      {/* Empty state */}
      {tasks.length === 0 && (
        <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
          <CheckCircle2 size={32} color="#E2E8F0" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: '#aaa', margin: 0 }}>Queue is clear</p>
          <p style={{ fontSize: 13, color: '#ccc', marginTop: 4 }}>Outputs from approval-required agents will appear here</p>
          <Link
            href="/dashboard/agents"
            style={{ display: 'inline-block', marginTop: 16, fontSize: 12.5, color: '#3B82F6', textDecoration: 'none', fontWeight: 500 }}
          >
            ← Back to agents
          </Link>
        </div>
      )}

      {tasks.length > 0 && (
        <>
          {/* Controls bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>

            {/* Agent filter */}
            {agentsInQueue.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={12} color="#bbb" />
                <select
                  value={agentFilter}
                  onChange={e => setAgentFilter(e.target.value)}
                  style={{ fontSize: 12, border: '0.5px solid #E2E8F0', borderRadius: 7, padding: '4px 8px', background: '#fff', color: '#555', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}
                >
                  <option value="all">All agents ({tasks.length})</option>
                  {agentsInQueue.map(a => {
                    const def = AGENTS[a as AgentId]
                    const count = tasks.filter(t => t.agent === a).length
                    return <option key={a} value={a}>{def?.name ?? a} ({count})</option>
                  })}
                </select>
              </div>
            )}

            {/* Sort */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <SortDesc size={12} color="#bbb" />
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest')}
                style={{ fontSize: 12, border: '0.5px solid #E2E8F0', borderRadius: 7, padding: '4px 8px', background: '#fff', color: '#555', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>

            {/* Select all / deselect all — only after hasReviewedOne */}
            {hasReviewedOne && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button
                  onClick={allChecked ? deselectAll : selectAll}
                  style={{ fontSize: 12, color: '#888', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {allChecked ? 'Deselect all' : 'Select all'}
                </button>
              </div>
            )}
          </div>

          {/* Bulk action bar — appears when items checked */}
          {checkedIds.size > 0 && (
            <div style={{ background: '#2D3748', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, color: '#fff', fontWeight: 500 }}>
                {checkedIds.size} selected
              </span>

              {bulkAction === 'reject' ? (
                <>
                  <input
                    value={bulkNote}
                    onChange={e => setBulkNote(e.target.value)}
                    placeholder="Rejection reason (optional)"
                    style={{ flex: 1, minWidth: 200, fontSize: 12, border: '0.5px solid #333', borderRadius: 7, padding: '5px 10px', background: '#1a1a1a', color: '#fff', outline: 'none', fontFamily: 'inherit' }}
                  />
                  <button
                    onClick={handleBulkAction}
                    disabled={bulkLoading}
                    style={{ padding: '5px 14px', borderRadius: 7, background: '#3B82F6', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: bulkLoading ? 0.6 : 1, fontFamily: 'inherit' }}
                  >
                    {bulkLoading ? 'Rejecting…' : 'Reject & re-run all'}
                  </button>
                  <button
                    onClick={() => { setBulkAction(null); setBulkNote('') }}
                    style={{ fontSize: 12, color: '#888', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={async () => { setBulkAction('approve'); await handleBulkActionWith('approve') }}
                    disabled={bulkLoading}
                    style={{ padding: '5px 14px', borderRadius: 7, background: '#fff', color: '#2D3748', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: bulkLoading ? 0.6 : 1, fontFamily: 'inherit' }}
                  >
                    {bulkLoading && bulkAction === 'approve' ? 'Approving…' : 'Approve all'}
                  </button>
                  <button
                    onClick={() => setBulkAction('reject')}
                    style={{ padding: '5px 14px', borderRadius: 7, background: 'transparent', color: '#aaa', border: '0.5px solid #333', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Reject all
                  </button>
                  <button
                    onClick={deselectAll}
                    style={{ marginLeft: 'auto', fontSize: 12, color: '#555', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Deselect
                  </button>
                </>
              )}
            </div>
          )}

          {/* Task list */}
          <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: '20px 24px' }}>
            {visible.length === 0 ? (
              <p style={{ fontSize: 13, color: '#bbb', textAlign: 'center', padding: '24px 0', margin: 0 }}>
                No items match the current filter.
              </p>
            ) : (
              visible.map((task) => (
                <div key={task.id} id={`task-${task.id}`}>
                  <ApprovalItem
                    task={task}
                    isExpanded={expanded.has(task.id)}
                    isChecked={checkedIds.has(task.id)}
                    hasReviewedOne={hasReviewedOne}
                    onToggleExpand={() => toggleExpand(task.id)}
                    onToggleCheck={() => toggleCheck(task.id)}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onMarkReviewed={markReviewed}
                  />
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
