'use client'

import { useEffect, useState } from 'react'
import { Loader2, MessageSquare, Send } from 'lucide-react'
import type { ApprovalNoteKind, ApprovalNoteRow } from '@/lib/agents/approvalNotes'
import { formatNoteTimestamp } from '@/lib/team/taskNoteUi'

const KIND_LABELS: Record<ApprovalNoteKind, string> = {
  comment: '',
  approved: 'Approved',
  rejected: 'Rejected',
}

const KIND_STYLES: Record<ApprovalNoteKind, { bg: string; color: string } | null> = {
  comment: null,
  approved: { bg: '#F0FDF4', color: '#15803D' },
  rejected: { bg: '#FEF2F2', color: '#B91C1C' },
}

type Props = {
  taskId: string
  enabled: boolean
  mentionHints: string[]
}

export default function ApprovalDiscussion({ taskId, enabled, mentionHints }: Props) {
  const [notes, setNotes] = useState<ApprovalNoteRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || loaded) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/agents/tasks/${taskId}/approval-notes`)
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to load discussion')
        if (!cancelled) {
          setNotes((data.notes ?? []) as ApprovalNoteRow[])
          setLoaded(true)
        }
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load discussion')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [enabled, loaded, taskId])

  async function postNote() {
    const body = draft.trim()
    if (!body || posting) return
    setPosting(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/tasks/${taskId}/approval-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to post note')
      setNotes(prev => [...prev, data.note as ApprovalNoteRow])
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post note')
    } finally {
      setPosting(false)
    }
  }

  if (!enabled) return null

  return (
    <div style={{
      marginBottom: 14,
      border: '0.5px solid #E2E8F0',
      borderRadius: 10,
      background: '#FAFAFA',
      padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <MessageSquare size={13} color="#64748B" />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Discussion</span>
        {notes.length > 0 && (
          <span style={{ fontSize: 11, color: '#94A3B8' }}>{notes.length}</span>
        )}
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94A3B8', marginBottom: 8 }}>
          <Loader2 size={12} className="animate-spin" />
          Loading…
        </div>
      )}

      {error && (
        <p style={{ fontSize: 12, color: '#B91C1C', marginBottom: 8 }}>{error}</p>
      )}

      {notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10, maxHeight: 220, overflowY: 'auto' }}>
          {notes.map(note => {
            const kindStyle = KIND_STYLES[note.note_kind]
            const kindLabel = KIND_LABELS[note.note_kind]
            return (
              <div key={note.id} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{note.authorName ?? 'Team member'}</span>
                  {kindLabel && kindStyle && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, borderRadius: 20, padding: '1px 7px',
                      background: kindStyle.bg, color: kindStyle.color,
                    }}>
                      {kindLabel}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>{formatNoteTimestamp(note.created_at)}</span>
                </div>
                <p style={{ margin: 0, color: '#475569', whiteSpace: 'pre-wrap' }}>{note.body}</p>
              </div>
            )
          })}
        </div>
      )}

      {!loading && notes.length === 0 && (
        <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 10px' }}>
          Leave a note for your team before approving or rejecting.
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Add a note… use @name to mention"
          rows={2}
          style={{
            flex: 1,
            border: '0.5px solid #E2E8F0',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 12.5,
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            color: '#334155',
            background: '#fff',
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void postNote()
            }
          }}
        />
        <button
          type="button"
          onClick={() => void postNote()}
          disabled={posting || !draft.trim()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '8px 12px',
            borderRadius: 8,
            border: 'none',
            background: '#3B82F6',
            color: '#fff',
            fontSize: 12,
            fontWeight: 500,
            cursor: posting || !draft.trim() ? 'not-allowed' : 'pointer',
            opacity: posting || !draft.trim() ? 0.5 : 1,
            fontFamily: 'inherit',
          }}
        >
          {posting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          Post
        </button>
      </div>

      {mentionHints.length > 0 && (
        <p style={{ fontSize: 10.5, color: '#94A3B8', margin: '8px 0 0' }}>
          Mention: {mentionHints.join(' · ')}
        </p>
      )}
    </div>
  )
}
