'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useMayaContext } from '@/hooks/useMayaContext'
import { buildApprovalsMayaContext } from '@/lib/maya/summaries/agentsContext'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, ChevronUp, CheckCircle2, RotateCcw, ArrowLeft, Filter, SortDesc, Image as ImageIcon, CalendarDays, FileText } from 'lucide-react'
import { AGENTS, AgentId } from '@/lib/agents/registry'
import AgentIcon from '@/components/agents/AgentIcon'
import EmailSequenceOutputView from '@/components/agents/EmailSequenceOutputView'
import IdeaAnalysisOutputView from '@/components/agents/IdeaAnalysisOutputView'
import { readIdeaAnalysisFromContent } from '@/lib/agents/ideaAnalysis'
import type { ViralHooksDraftHints } from '@/lib/services/viralHooks'
import {
  approvalQueueKind,
  type ApprovalQueueKind,
  isLegacyContentAgent,
  latestAgentOutput,
  singlePostPublishBlockReason,
} from '@/lib/agents/contentPosting'

// ── Types ──────────────────────────────────────────────────────────────────

interface AgentOutput {
  id: string
  task_id: string
  agent: string
  output_type: string
  title: string | null
  content: {
    raw?: string
    parsed?: Record<string, string>
    media_storage_path?: string
    media_mime?: string
    image_caption_mode?: boolean
  }
  status: string
  created_at: string
  mediaPreviewUrl?: string | null
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

interface RunningVideoTask {
  id: string
  createdAt: string
  input: Record<string, unknown>
}

interface Props {
  profileId: string
  initialTasks: ApprovalTask[]
  runningVideoTasks?: RunningVideoTask[]
  viralHooksHints?: ViralHooksDraftHints
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

function agentDisplayName(agentId: string): string {
  if (isLegacyContentAgent(agentId)) return AGENTS.content_posting.name
  return AGENTS[agentId as AgentId]?.name ?? agentId
}

const QUEUE_KIND_LABELS: Record<ApprovalQueueKind, string> = {
  post: 'Post to review',
  plan: 'Weekly plan',
  other: 'Other',
}

const QUEUE_KIND_STYLES: Record<ApprovalQueueKind, { bg: string; color: string }> = {
  post: { bg: '#EFF6FF', color: '#1D4ED8' },
  plan: { bg: '#F0FDF4', color: '#15803D' },
  other: { bg: '#F8FAFC', color: '#64748B' },
}

// ── ApprovalItem ───────────────────────────────────────────────────────────

function ApprovalItem({
  task,
  isExpanded,
  isChecked,
  hasReviewedOne,
  viralHooksHints,
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
  viralHooksHints?: ViralHooksDraftHints
  onToggleExpand: () => void
  onToggleCheck: () => void
  onApprove: (taskId: string, outputId: string, edited?: string) => Promise<void>
  onReject: (taskId: string, outputId: string, note: string, reason: string, rerun: boolean) => Promise<void>
  onMarkReviewed: () => void
}) {
  const output    = latestAgentOutput(task.agent_outputs)
  const ideaAnalysis = task.agent === 'idea_analysis'
    ? readIdeaAnalysisFromContent(output?.content)
    : null
  const raw       = ideaAnalysis ? '' : (output?.content?.raw ?? '')
  const mediaPreviewUrl = output?.mediaPreviewUrl ?? null
  const queueKind = approvalQueueKind(task)
  const kindStyle = QUEUE_KIND_STYLES[queueKind]

  const [approving,   setApproving]   = useState(false)
  const [rejecting,   setRejecting]   = useState(false)
  const [isEditing,   setIsEditing]   = useState(false)
  const [editVal,     setEditVal]     = useState(raw)
  const [rejectNote,  setRejectNote]  = useState('')
  const [activeChip,  setActiveChip]  = useState<string | null>(null)
  const [showReject,  setShowReject]  = useState(false)

  const publishWarning = queueKind === 'post' && output
    ? singlePostPublishBlockReason({
        agentId: task.agent,
        taskInput: task.input ?? {},
        outputContent: (output.content ?? {}) as Record<string, unknown>,
        caption: isEditing ? editVal : raw,
      })
    : null

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

  async function doReject(rerun: boolean) {
    if (!output) return
    setRejecting(true)
    try {
      await onReject(task.id, output.id, rejectNote, activeChip ?? '', rerun)
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <AgentIcon agentId={task.agent} size={14} className="text-[#888]" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#2D3748' }}>{agentDisplayName(task.agent)}</span>
            <span style={{
              fontSize: 10, fontWeight: 600, borderRadius: 20, padding: '2px 8px',
              background: kindStyle.bg, color: kindStyle.color,
            }}>
              {QUEUE_KIND_LABELS[queueKind]}
            </span>
            <span style={{ fontSize: 11, color: '#bbb' }}>{relativeTime(task.completed_at)}</span>
          </div>

          {/* Output title */}
          {output?.title && (
            <p style={{ fontSize: 14, fontWeight: 500, color: '#2D3748', marginBottom: 6 }}>{output.title}</p>
          )}

          {mediaPreviewUrl && (
            <div style={{ marginBottom: 10 }}>
              {output?.content?.media_mime === 'video/mp4' ? (
                <video
                  src={mediaPreviewUrl}
                  controls
                  muted
                  style={{
                    width: 68,
                    height: 120,
                    objectFit: 'cover',
                    borderRadius: 12,
                    border: '0.5px solid #f0f0f0',
                    display: 'block',
                  }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaPreviewUrl}
                  alt="Post preview"
                  style={{
                    width: 120,
                    height: 120,
                    objectFit: 'cover',
                    borderRadius: 12,
                    border: '0.5px solid #f0f0f0',
                  }}
                />
              )}
            </div>
          )}

          {!isExpanded && (ideaAnalysis?.topic || raw) && (
            <p style={{ fontSize: 13, color: '#666', lineHeight: 1.55, marginBottom: 10 }}>
              {ideaAnalysis?.topic ?? (raw.length > 180 ? raw.slice(0, 180) + '…' : raw)}
            </p>
          )}

          {isExpanded && publishWarning && (
            <div style={{
              background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 8,
              padding: '10px 12px', marginBottom: 12, fontSize: 12.5, color: '#92400E', lineHeight: 1.5,
            }}>
              <strong>Will not create a Posts draft:</strong> {publishWarning}
              {queueKind === 'post' && ' Use Edit & approve to fix the caption, or Reject & re-run.'}
            </div>
          )}

          {/* Expanded: full content or editor */}
          {isExpanded && (
            <div style={{ marginBottom: 12 }}>
              {mediaPreviewUrl && (
                <div style={{ marginBottom: 12 }}>
                  {output?.content?.media_mime === 'video/mp4' ? (
                    <video
                      src={mediaPreviewUrl}
                      controls
                      muted
                      style={{
                        maxWidth: 124,
                        maxHeight: 220,
                        objectFit: 'cover',
                        borderRadius: 12,
                        border: '0.5px solid #f0f0f0',
                        display: 'block',
                      }}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaPreviewUrl}
                      alt="Post preview"
                      style={{
                        maxWidth: 220,
                        maxHeight: 220,
                        objectFit: 'cover',
                        borderRadius: 12,
                        border: '0.5px solid #f0f0f0',
                      }}
                    />
                  )}
                </div>
              )}
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
              ) : task.agent === 'email_sequence_builder' ? (
                <EmailSequenceOutputView content={raw} showGuide={false} />
              ) : ideaAnalysis ? (
                <IdeaAnalysisOutputView
                  analysis={ideaAnalysis}
                  hints={{
                    ...viralHooksHints,
                    platform: typeof task.input?.platform === 'string' ? task.input.platform : viralHooksHints?.platform,
                  }}
                  compact
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
                  onClick={() => doReject(false)}
                  disabled={rejecting}
                  style={{ padding: '6px 16px', borderRadius: 7, background: 'transparent', color: '#64748B', border: '0.5px solid #CBD5E1', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: rejecting ? 0.6 : 1, fontFamily: 'inherit' }}
                >
                  {rejecting ? 'Rejecting…' : 'Reject only'}
                </button>
                <button
                  onClick={() => doReject(true)}
                  disabled={rejecting || !rejectNote.trim()}
                  style={{ padding: '6px 16px', borderRadius: 7, background: '#3B82F6', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: rejecting || !rejectNote.trim() ? 0.6 : 1, fontFamily: 'inherit' }}
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
                {task.agent !== 'idea_analysis' && (
                  <button
                    onClick={() => { setIsEditing(true); setEditVal(raw); onToggleExpand() }}
                    style={{ padding: '6px 14px', borderRadius: 7, background: 'transparent', color: '#2D3748', border: '0.5px solid #ddd', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Edit &amp; approve
                  </button>
                )}
                <button
                  onClick={() => doReject(false)}
                  style={{ padding: '6px 14px', borderRadius: 7, background: 'transparent', color: '#64748B', border: '0.5px solid #CBD5E1', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Reject
                </button>
                <button
                  onClick={() => setShowReject(true)}
                  style={{ padding: '6px 14px', borderRadius: 7, background: 'transparent', color: '#bbb', border: 'none', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Reject &amp; re-run
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── VideoGeneratingCard ────────────────────────────────────────────────────

function prettyModelLabel(slug: string): string {
  const map: Record<string, string> = {
    'kwaivgi/kling-v3.0-std':      'Kling v3.0 Standard',
    'kwaivgi/kling-v3.0-pro':      'Kling v3.0 Pro',
    'kwaivgi/kling-video-o1':      'Kling Video O1',
    'bytedance/seedance-2.0-fast': 'Seedance 2.0 Fast',
    'bytedance/seedance-2.0':      'Seedance 2.0',
    'bytedance/seedance-1-5-pro':  'Seedance 1.5 Pro',
    'google/veo-3.1':              'Google Veo 3.1',
    'google/veo-3.1-fast':         'Google Veo 3.1 Fast',
    'google/veo-3.1-lite':         'Google Veo 3.1 Lite',
    'xai/grok-imagine-video':      'xAI Grok Imagine Video',
    'minimax/hailuo-2.3':          'MiniMax Hailuo 2.3',
    'alibaba/wan-2.7':             'Alibaba Wan 2.7',
    'alibaba/wan-2.6':             'Alibaba Wan 2.6',
    'openai/sora-2-pro':           'OpenAI Sora 2 Pro',
  }
  return map[slug] ?? slug
}

function VideoGeneratingCard({ task, onCheckReady }: {
  task: RunningVideoTask
  onCheckReady: () => Promise<void>
}) {
  const [checking, setChecking] = useState(false)
  const [elapsed, setElapsed]   = useState(
    Math.floor((Date.now() - new Date(task.createdAt).getTime()) / 1000),
  )

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(task.createdAt).getTime()) / 1000))
    }, 10_000)
    return () => clearInterval(id)
  }, [task.createdAt])

  const totalEstSec = 5 * 60
  const pct      = Math.min(Math.round((elapsed / totalEstSec) * 100), 92)
  const isLong   = elapsed > totalEstSec
  const minsAgo  = Math.floor(elapsed / 60)
  const timeLabel = minsAgo < 1 ? 'just now' : `${minsAgo}m ago`

  const modelSlug = (task.input.video_model as string | undefined) ?? ''
  const postGoal  = (task.input.postGoal   as string | undefined) ?? ''

  async function handleCheck() {
    if (checking) return
    setChecking(true)
    try { await onCheckReady() } finally { setChecking(false) }
  }

  return (
    <div style={{
      background: '#F0F9FF', border: '0.5px solid #BAE6FD',
      borderRadius: 14, padding: '18px 20px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#3B82F6',
            display: 'inline-block', animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
          }} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0C4A6E' }}>Video generating…</span>
        </div>
        <span style={{ fontSize: 11, color: '#7DD3FC' }}>Started {timeLabel}</span>
      </div>

      <div style={{ display: 'flex', gap: 20, marginBottom: 14, flexWrap: 'wrap' }}>
        {postGoal && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#7DD3FC', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Goal</p>
            <p style={{ fontSize: 12.5, color: '#0C4A6E' }}>{postGoal}</p>
          </div>
        )}
        {modelSlug && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#7DD3FC', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Model</p>
            <p style={{ fontSize: 12.5, color: '#0C4A6E' }}>{prettyModelLabel(modelSlug)}</p>
          </div>
        )}
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#7DD3FC', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Format</p>
          <p style={{ fontSize: 12.5, color: '#0C4A6E' }}>9:16 · 8 sec</p>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: '#38BDF8' }}>
            {isLong ? 'Taking a little longer than usual…' : 'Rendering video'}
          </span>
          <span style={{ fontSize: 11, color: '#38BDF8' }}>{pct}%</span>
        </div>
        <div style={{ height: 6, background: '#BAE6FD', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: 'linear-gradient(90deg, #3B82F6, #60A5FA)',
            borderRadius: 99, transition: 'width 2s ease',
          }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={() => void handleCheck()}
          disabled={checking}
          style={{
            fontSize: 12, fontWeight: 500, color: '#1D4ED8',
            background: 'white', border: '0.5px solid #93C5FD',
            borderRadius: 7, padding: '5px 12px', cursor: 'pointer',
            opacity: checking ? 0.6 : 1, fontFamily: 'inherit',
          }}
        >
          {checking ? 'Checking…' : 'Check if ready'}
        </button>
        <span style={{ fontSize: 11, color: '#7DD3FC' }}>
          Your video will appear here automatically when it&apos;s done.
        </span>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function ApprovalsClient({ profileId, initialTasks, runningVideoTasks = [], viralHooksHints }: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const autoExpandId = searchParams.get('task')
  const queueParam   = searchParams.get('queue')

  const [tasks,          setTasks]          = useState<ApprovalTask[]>(initialTasks)
  const [expanded,       setExpanded]       = useState<Set<string>>(new Set(autoExpandId ? [autoExpandId] : []))
  const [checkedIds,     setCheckedIds]     = useState<Set<string>>(new Set())
  const [hasReviewedOne, setHasReviewedOne] = useState(!!autoExpandId)
  const [agentFilter,    setAgentFilter]    = useState<string>('all')
  const [queueKindFilter, setQueueKindFilter] = useState<'all' | ApprovalQueueKind>(() => {
    if (queueParam === 'post' || queueParam === 'plan' || queueParam === 'other') return queueParam
    return 'all'
  })
  const [sortOrder,      setSortOrder]      = useState<'newest' | 'oldest'>('newest')
  const [bulkAction,     setBulkAction]     = useState<'approve' | 'reject' | null>(null)
  const [bulkNote,       setBulkNote]       = useState('')
  const [bulkLoading,    setBulkLoading]    = useState(false)
  const [approveNotice,  setApproveNotice]  = useState<{ message: string; postsLink?: string } | null>(null)
  const [newItemsBanner, setNewItemsBanner] = useState(false)
  const [refreshing,     setRefreshing]     = useState(false)

  // Track which task IDs we've already surfaced so we can detect new arrivals
  const knownIdsRef = useRef<Set<string>>(new Set(initialTasks.map(t => t.id)))

  // Merge newly arrived tasks from server re-render without clobbering local state
  useEffect(() => {
    const incoming = initialTasks.filter(t => !knownIdsRef.current.has(t.id))
    if (incoming.length === 0) return
    incoming.forEach(t => knownIdsRef.current.add(t.id))
    setTasks(prev => [...incoming, ...prev])
    setNewItemsBanner(true)
  }, [initialTasks])

  // On mount: reconcile any running video tasks so completed ones surface immediately
  useEffect(() => {
    fetch('/api/posts/reconcile-video', { method: 'POST' })
      .then(r => r.json())
      .then((d: { processed?: number }) => {
        if ((d.processed ?? 0) > 0) router.refresh()
      })
      .catch(() => undefined)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll every 45 s — triggers router.refresh() so the server re-fetches the queue
  useEffect(() => {
    const id = setInterval(() => { router.refresh() }, 45_000)
    return () => clearInterval(id)
  }, [router])

  function handleManualRefresh() {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 1500)
  }

  async function handleReconcile() {
    const res  = await fetch('/api/posts/reconcile-video', { method: 'POST' })
    const data = await res.json().catch(() => ({})) as { processed?: number }
    if ((data.processed ?? 0) > 0) router.refresh()
  }

  // Scroll to auto-expanded task
  useEffect(() => {
    if (autoExpandId) {
      setTimeout(() => {
        document.getElementById(`task-${autoExpandId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 200)
    }
  }, [autoExpandId])

  const mayaContext = useMemo(() => buildApprovalsMayaContext(tasks.length), [tasks.length])
  useMayaContext(mayaContext)

  // Derived: unique agents in queue
  const agentsInQueue = [...new Set(tasks.map(t => t.agent))]

  const queueCounts = useMemo(() => ({
    post: tasks.filter(t => approvalQueueKind(t) === 'post').length,
    plan: tasks.filter(t => approvalQueueKind(t) === 'plan').length,
    other: tasks.filter(t => approvalQueueKind(t) === 'other').length,
  }), [tasks])

  // Filtered + sorted
  const visible = tasks
    .filter(t => agentFilter === 'all' || t.agent === agentFilter)
    .filter(t => queueKindFilter === 'all' || approvalQueueKind(t) === queueKindFilter)
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
    const task = tasks.find(t => t.id === taskId)
    const kind = task ? approvalQueueKind(task) : 'other'
    const body: Record<string, unknown> = { outputId }
    if (edited !== undefined) body.editedContent = edited
    const res = await fetch(`/api/agents/tasks/${taskId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    removeTask(taskId)
    if (data.publish?.scheduled && data.publish?.postId) {
      setApproveNotice({
        message: 'Post draft saved on Posts — schedule or publish when ready.',
        postsLink: `/dashboard/posts?edit=${data.publish.postId}`,
      })
    } else if (kind === 'plan') {
      setApproveNotice({ message: 'Weekly plan approved and saved to your output archive.' })
    } else if (kind === 'post' && typeof data.publishBlocked === 'string') {
      setApproveNotice({ message: `Approved and saved, but not sent to Posts: ${data.publishBlocked}` })
    } else if (kind === 'post') {
      setApproveNotice({ message: 'Post approved and saved to your output archive.' })
    }
  }

  async function handleReject(taskId: string, outputId: string, note: string, reason: string, rerun: boolean) {
    await fetch(`/api/agents/tasks/${taskId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outputId, note, feedback: reason, feedbackNote: note, rerun }),
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
          rerun:        false,
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
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
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#888', background: 'transparent', border: '0.5px solid #e5e7eb', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', opacity: refreshing ? 0.5 : 1, fontFamily: 'inherit' }}
          >
            <RotateCcw size={11} style={refreshing ? { animation: 'spin 0.8s linear infinite' } : undefined} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <p style={{ fontSize: 13.5, color: '#888', marginTop: 4 }}>
          Review agent outputs before they go anywhere. Posts with images can become drafts on Posts after you approve.
        </p>
      </div>

      {newItemsBanner && (
        <div style={{
          background: '#EFF6FF', border: '0.5px solid #BFDBFE', borderRadius: 10,
          padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <p style={{ fontSize: 13, color: '#1D4ED8', margin: 0 }}>New items are ready to review.</p>
          <button
            type="button"
            onClick={() => setNewItemsBanner(false)}
            style={{ fontSize: 12, color: '#1D4ED8', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
          >
            Dismiss
          </button>
        </div>
      )}

      {approveNotice && (
        <div style={{
          background: '#EFF6FF', border: '0.5px solid #BFDBFE', borderRadius: 10,
          padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <p style={{ fontSize: 13, color: '#1D4ED8', margin: 0 }}>{approveNotice.message}</p>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {approveNotice.postsLink && (
              <Link href={approveNotice.postsLink} style={{ fontSize: 12, fontWeight: 600, color: '#1D4ED8', textDecoration: 'none' }}>
                Open in Posts →
              </Link>
            )}
            <button
              type="button"
              onClick={() => setApproveNotice(null)}
              style={{ fontSize: 12, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Generating video cards */}
      {runningVideoTasks.map(t => (
        <VideoGeneratingCard key={t.id} task={t} onCheckReady={handleReconcile} />
      ))}

      {/* Empty state */}
      {tasks.length === 0 && runningVideoTasks.length === 0 && (
        <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
          <CheckCircle2 size={32} color="#E2E8F0" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: '#aaa', margin: 0 }}>Queue is clear</p>
          <p style={{ fontSize: 13, color: '#ccc', marginTop: 4 }}>Outputs from approval-required agents will appear here. Videos generating in the background will appear automatically.</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16 }}>
            <Link
              href="/dashboard/agents"
              style={{ fontSize: 12.5, color: '#3B82F6', textDecoration: 'none', fontWeight: 500 }}
            >
              ← Back to agents
            </Link>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              style={{ fontSize: 12.5, color: '#888', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', opacity: refreshing ? 0.5 : 1 }}
            >
              {refreshing ? 'Checking…' : 'Check now'}
            </button>
          </div>
        </div>
      )}

      {tasks.length > 0 && (
        <>
          {/* Queue kind tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {([
              { id: 'all' as const, label: 'All', count: tasks.length, icon: null },
              { id: 'post' as const, label: 'Posts to review', count: queueCounts.post, icon: ImageIcon },
              { id: 'plan' as const, label: 'Weekly plans', count: queueCounts.plan, icon: CalendarDays },
              { id: 'other' as const, label: 'Other', count: queueCounts.other, icon: FileText },
            ]).map(tab => {
              const active = queueKindFilter === tab.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setQueueKindFilter(tab.id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                    border: active ? '0.5px solid #3B82F6' : '0.5px solid #E2E8F0',
                    background: active ? '#EFF6FF' : '#fff',
                    color: active ? '#1D4ED8' : '#64748B',
                  }}
                >
                  {Icon && <Icon size={13} />}
                  {tab.label} ({tab.count})
                </button>
              )
            })}
          </div>

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
                    viralHooksHints={viralHooksHints}
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
