'use client'

import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'

type AgentOutputDetailProps = {
  agentName: string
  taskId: string
  outputId: string
  title: string
  subtitle: string
  status: string
  content: string
}

function statusStyles(status: string) {
  if (status === 'approved') {
    return { background: '#F0FDF4', color: '#16A34A' }
  }
  if (status === 'rejected') {
    return { background: '#FEF2F2', color: '#DC2626' }
  }
  return { background: '#FEF3C7', color: '#B45309' }
}

function looksLikeInputRequest(content: string): boolean {
  return /required inputs|need a few details|quick context questions|i need/i.test(content)
}

export default function AgentOutputDetail({
  agentName,
  taskId,
  outputId,
  title,
  subtitle,
  status: initialStatus,
  content,
}: AgentOutputDetailProps) {
  const [status, setStatus] = useState(initialStatus)
  const [showRevision, setShowRevision] = useState(false)
  const [revisionNote, setRevisionNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const asksForInput = useMemo(() => looksLikeInputRequest(content), [content])
  const isPending = status === 'pending_approval'
  const badge = statusStyles(status)

  async function approve() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/agents/tasks/${taskId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputId }),
      })
      if (!res.ok) throw new Error(await res.text())
      setStatus('approved')
      setMessage('Approved.')
    } catch {
      setMessage('Approval failed. Try again from the approval queue.')
    } finally {
      setBusy(false)
    }
  }

  async function requestRevision() {
    if (!revisionNote.trim()) {
      setMessage('Add a note so the agent knows what to change.')
      return
    }

    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/agents/tasks/${taskId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outputId,
          feedback: 'Needs revision',
          feedbackNote: revisionNote,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setStatus('rejected')
      setShowRevision(false)
      setMessage('Revision requested. A replacement task has been queued.')
    } catch {
      setMessage('Revision request failed. Try again from the approval queue.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '22px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#2D3748', margin: '0 0 5px' }}>
            {title}
          </h2>
          <p style={{ fontSize: 12.5, color: '#64748B', margin: 0 }}>
            {subtitle}
          </p>
        </div>
        <span style={{ fontSize: 11, borderRadius: 20, padding: '4px 10px', background: badge.background, color: badge.color, fontWeight: 700, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
          {status.replace(/_/g, ' ')}
        </span>
      </div>

      {asksForInput && isPending && (
        <div style={{ margin: '18px 24px 0', padding: 16, border: '1px solid #BFDBFE', background: '#EFF6FF', borderRadius: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#2D3748', margin: '0 0 4px' }}>
            This output needs more direction
          </p>
          <p style={{ fontSize: 12.5, color: '#64748B', margin: 0, lineHeight: 1.5 }}>
            {agentName} asked for details instead of producing a final asset. Add the missing details below and request a revision so the agent can rerun with clearer context.
          </p>
        </div>
      )}

      <div
        style={{
          padding: '22px 24px',
          fontSize: 14,
          lineHeight: 1.7,
          color: '#334155',
        }}
      >
        <ReactMarkdown
          components={{
            h1: props => <h1 style={{ fontSize: 22, lineHeight: 1.25, margin: '0 0 14px', color: '#2D3748' }} {...props} />,
            h2: props => <h2 style={{ fontSize: 18, lineHeight: 1.35, margin: '22px 0 10px', color: '#2D3748' }} {...props} />,
            h3: props => <h3 style={{ fontSize: 15, lineHeight: 1.4, margin: '18px 0 8px', color: '#2D3748' }} {...props} />,
            p: props => <p style={{ margin: '0 0 14px' }} {...props} />,
            ul: props => <ul style={{ margin: '0 0 16px', paddingLeft: 22 }} {...props} />,
            ol: props => <ol style={{ margin: '0 0 16px', paddingLeft: 22 }} {...props} />,
            li: props => <li style={{ marginBottom: 6 }} {...props} />,
            strong: props => <strong style={{ color: '#2D3748', fontWeight: 700 }} {...props} />,
          }}
        >
          {content || 'No content saved for this output.'}
        </ReactMarkdown>
      </div>

      {isPending && (
        <div style={{ padding: '18px 24px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC' }}>
          {showRevision && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#2D3748', marginBottom: 6 }}>
                Revision note
              </label>
              <textarea
                value={revisionNote}
                onChange={event => setRevisionNote(event.target.value)}
                rows={4}
                placeholder="Tell the agent what details to use or what needs to change..."
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #CBD5E1', borderRadius: 10, padding: '10px 12px', resize: 'vertical', font: 'inherit', fontSize: 13, color: '#2D3748', outline: 'none', background: '#fff' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={approve}
              disabled={busy}
              style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: '#2D3748', color: '#fff', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.65 : 1 }}
            >
              Approve output
            </button>
            <button
              type="button"
              onClick={showRevision ? requestRevision : () => setShowRevision(true)}
              disabled={busy}
              style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #CBD5E1', background: '#fff', color: '#2D3748', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.65 : 1 }}
            >
              {showRevision ? 'Send revision request' : 'Request revision'}
            </button>
            {showRevision && (
              <button
                type="button"
                onClick={() => setShowRevision(false)}
                disabled={busy}
                style={{ padding: '9px 10px', border: 'none', background: 'transparent', color: '#64748B', fontSize: 13, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {message && (
        <div style={{ padding: '0 24px 18px', background: status === 'approved' ? '#F8FAFC' : '#F8FAFC', color: status === 'approved' ? '#16A34A' : '#64748B', fontSize: 12.5 }}>
          {message}
        </div>
      )}
    </article>
  )
}
