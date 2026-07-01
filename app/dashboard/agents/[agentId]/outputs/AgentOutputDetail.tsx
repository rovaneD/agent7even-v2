'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import AdVariationsOutputView from '@/components/agents/AdVariationsOutputView'
import CampaignOutputView from '@/components/agents/CampaignOutputView'
import EmailSequenceOutputView, { AgentOutputCopyButton } from '@/components/agents/EmailSequenceOutputView'
import IdeaAnalysisOutputView from '@/components/agents/IdeaAnalysisOutputView'
import { readIdeaAnalysisFromContent } from '@/lib/agents/ideaAnalysis'
import { formatOutputLifecycle } from '@/lib/content/outputLifecycleLabel'
import type { ViralHooksDraftHints } from '@/lib/services/viralHooks'

type AgentOutputDetailProps = {
  agentName: string
  agentId?: string
  taskId: string
  outputId: string
  title: string
  subtitle: string
  status: string
  content: string
  outputContent?: { raw?: string; parsed?: unknown } | string | null
  viralHooksHints?: ViralHooksDraftHints
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

type OutputSection = {
  title: string
  body: string[]
  bullets: string[]
}

function stripMarkdown(value: string) {
  return value
    .replace(/^#+\s*/g, '')
    .replace(/\*\*/g, '')
    .trim()
}

function markdownComponents() {
  return {
    h1: (props: any) => <h1 style={{ fontSize: 22, lineHeight: 1.25, margin: '0 0 14px', color: '#2D3748' }} {...props} />,
    h2: (props: any) => <h2 style={{ fontSize: 18, lineHeight: 1.35, margin: '22px 0 10px', color: '#2D3748' }} {...props} />,
    h3: (props: any) => <h3 style={{ fontSize: 15, lineHeight: 1.4, margin: '18px 0 8px', color: '#2D3748' }} {...props} />,
    p: (props: any) => <p style={{ margin: '0 0 14px' }} {...props} />,
    ul: (props: any) => <ul style={{ margin: '0 0 16px', paddingLeft: 22 }} {...props} />,
    ol: (props: any) => <ol style={{ margin: '0 0 16px', paddingLeft: 22 }} {...props} />,
    li: (props: any) => <li style={{ marginBottom: 6 }} {...props} />,
    strong: (props: any) => <strong style={{ color: '#2D3748', fontWeight: 700 }} {...props} />,
  }
}

function parseStructuredSections(content: string): OutputSection[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const sections: OutputSection[] = []
  let current: OutputSection | null = null

  function startSection(title: string) {
    if (current && (current.body.length || current.bullets.length)) sections.push(current)
    current = { title: stripMarkdown(title), body: [], bullets: [] }
  }

  function activeSection() {
    if (!current) startSection('Summary')
    return current as OutputSection
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const heading = line.match(/^#{1,3}\s+(.+)$/)
    const labeledHeading = line.match(/^\**([A-Z][A-Z0-9 /&'()-]{2,}):\**\s*(.*)$/)

    if (heading) {
      startSection(heading[1])
      continue
    }

    if (labeledHeading && line.length < 90) {
      startSection(labeledHeading[1])
      if (labeledHeading[2]) activeSection().body.push(stripMarkdown(labeledHeading[2]))
      continue
    }

    if (/^[-•*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      activeSection().bullets.push(stripMarkdown(line.replace(/^[-•*]\s+/, '').replace(/^\d+\.\s+/, '')))
    } else {
      activeSection().body.push(stripMarkdown(line))
    }
  }

  const finalSection = current as OutputSection | null
  if (finalSection && (finalSection.body.length || finalSection.bullets.length)) sections.push(finalSection)
  return sections
}

function sectionAccent(index: number) {
  const accents = [
    { background: '#EFF6FF', color: '#2563EB' },
    { background: '#ECFDF5', color: '#059669' },
    { background: '#FFF7ED', color: '#EA580C' },
    { background: '#F5F3FF', color: '#7C3AED' },
    { background: '#F8FAFC', color: '#64748B' },
  ]
  return accents[index % accents.length]
}

function agentAction(agentName: string) {
  if (agentName === 'Weekly Content') return 'Turn this into schedule-ready posts and emails.'
  if (agentName === 'Email Sequence Builder') return 'Help me edit this sequence and prepare it for sending.'
  if (agentName === 'Ad Variations') return 'Help me choose the best ad variations to test.'
  if (agentName === 'Brand Voice Guardian') return 'Apply these brand voice edits to the content.'
  if (agentName === 'SEO Scanner') return 'Turn these SEO findings into a prioritized fix list.'
  if (agentName === 'Performance Digest') return 'Turn this performance digest into next actions.'
  if (agentName === 'Competitor Watcher') return 'Turn this competitor read into moves we should make.'
  if (agentName === 'Trend Spotter') return 'Turn these trend opportunities into content ideas.'
  return 'Help me turn this agent output into clear next actions.'
}

function GenericOutputView({ agentName, content }: { agentName: string; content: string }) {
  const sections = useMemo(() => parseStructuredSections(content), [content])
  const meaningfulSections = sections.filter(section => section.title || section.body.length || section.bullets.length)

  if (meaningfulSections.length < 2) {
    return (
      <ReactMarkdown components={markdownComponents()}>
        {content || 'No content saved for this output.'}
      </ReactMarkdown>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <AgentOutputCopyButton text={content} label="Copy all" />
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('maya:open-task', {
              detail: { task: agentAction(agentName) },
            }))
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 10, background: '#2D3748', color: '#fff', padding: '9px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none' }}
        >
          <i className="ti ti-sparkles" style={{ fontSize: 14 }} />
          Work on this with Maya
        </button>
      </div>

      {meaningfulSections.map((section, index) => {
        const accent = sectionAccent(index)
        return (
          <section key={`${section.title}-${index}`} style={{ border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
            <div style={{ padding: '15px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: accent.color, flexShrink: 0 }} />
              <h3 style={{ fontSize: 15, color: '#2D3748', fontWeight: 800, margin: 0 }}>
                {section.title || `Section ${index + 1}`}
              </h3>
            </div>
            <div style={{ padding: 18 }}>
              {section.body.length > 0 && (
                <div style={{ display: 'grid', gap: 10, marginBottom: section.bullets.length ? 14 : 0 }}>
                  {section.body.map((paragraph, paragraphIndex) => (
                    <p key={paragraphIndex} style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.65, margin: 0 }}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}
              {section.bullets.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  {section.bullets.map((bullet, bulletIndex) => (
                    <div key={bulletIndex} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 9, alignItems: 'start', border: '1px solid #F1F5F9', borderRadius: 12, padding: 11, background: '#F8FAFC' }}>
                      <span style={{ marginTop: 5, width: 5, height: 5, borderRadius: 999, background: accent.color }} />
                      <p style={{ fontSize: 12.8, color: '#334155', lineHeight: 1.55, margin: 0 }}>
                        {bullet}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default function AgentOutputDetail({
  agentName,
  agentId,
  taskId,
  outputId,
  title,
  subtitle,
  status: initialStatus,
  content,
  outputContent,
  viralHooksHints,
}: AgentOutputDetailProps) {
  const [status, setStatus] = useState(initialStatus)
  const [showRevision, setShowRevision] = useState(false)
  const [revisionNote, setRevisionNote] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [draftContent, setDraftContent] = useState(content)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const asksForInput = useMemo(() => looksLikeInputRequest(content), [content])
  const useCampaignView = agentName === 'Campaign Builder'
  const useEmailSequenceView = agentName === 'Email Sequence Builder'
  const useAdVariationsView = agentName === 'Ad Variations'
  const ideaAnalysis = agentId === 'idea_analysis'
    ? readIdeaAnalysisFromContent(outputContent ?? content)
    : null
  const isPending = status === 'pending_approval'
  const badge = statusStyles(status)
  const lifecycle = useMemo(
    () => formatOutputLifecycle(status, agentId ?? '', taskId),
    [status, agentId, taskId],
  )

  async function approve() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/agents/tasks/${taskId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputId, editedContent: isEditing ? draftContent : undefined }),
      })
      if (!res.ok) throw new Error(await res.text())
      setStatus('approved')
      setIsEditing(false)
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
      <div style={{ padding: '22px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#2D3748', margin: '0 0 5px' }}>
            {title}
          </h2>
          <p style={{ fontSize: 12.5, color: '#64748B', margin: 0 }}>
            {subtitle}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {!isEditing && (
            <AgentOutputCopyButton text={draftContent || content} label="Copy" compact />
          )}
          {isPending && (
            <button
              type="button"
              onClick={() => {
                setDraftContent(content)
                setIsEditing(prev => !prev)
                setMessage(null)
              }}
              style={{ border: '1px solid #CBD5E1', background: '#fff', color: '#2D3748', borderRadius: 20, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            >
              {isEditing ? 'Preview' : 'Edit'}
            </button>
          )}
          <span style={{ fontSize: 11, borderRadius: 20, padding: '4px 10px', background: badge.background, color: badge.color, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {lifecycle.label}
          </span>
        </div>
      </div>

      {(lifecycle.hint || lifecycle.href) && (
        <div style={{ margin: '0 24px 18px', padding: '12px 14px', border: '1px solid #E2E8F0', borderRadius: 10, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          {lifecycle.hint && (
            <p style={{ fontSize: 12.5, color: '#64748B', margin: 0, lineHeight: 1.5 }}>{lifecycle.hint}</p>
          )}
          {lifecycle.href && (
            <Link href={lifecycle.href} style={{ fontSize: 12, fontWeight: 600, color: '#3B82F6', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              {isPending ? 'Open in Approvals →' : lifecycle.href.includes('/posts') ? 'Open Posts drafts →' : 'Open Approvals →'}
            </Link>
          )}
        </div>
      )}

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

      <div style={{ padding: '22px 24px', fontSize: 14, lineHeight: 1.7, color: '#334155' }}>
        {isEditing ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                Editing mode
              </p>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>Changes are saved when you approve.</span>
            </div>
            <textarea
              value={draftContent}
              onChange={event => setDraftContent(event.target.value)}
              rows={24}
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #CBD5E1', borderRadius: 12, padding: '14px 16px', resize: 'vertical', font: 'inherit', fontSize: 13.5, lineHeight: 1.65, color: '#2D3748', outline: 'none', background: '#fff' }}
            />
          </div>
        ) : useCampaignView ? (
          <CampaignOutputView content={draftContent || 'No content saved for this output.'} />
        ) : useEmailSequenceView ? (
          <EmailSequenceOutputView content={draftContent || 'No content saved for this output.'} />
        ) : useAdVariationsView ? (
          <AdVariationsOutputView content={draftContent || 'No content saved for this output.'} />
        ) : ideaAnalysis ? (
          <IdeaAnalysisOutputView analysis={ideaAnalysis} hints={viralHooksHints} />
        ) : (
          <GenericOutputView agentName={agentName} content={draftContent || 'No content saved for this output.'} />
        )}
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

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
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
            {isEditing && (
              <button
                type="button"
                onClick={() => {
                  setDraftContent(content)
                  setIsEditing(false)
                }}
                disabled={busy}
                style={{ padding: '9px 10px', border: 'none', background: 'transparent', color: '#64748B', fontSize: 13, cursor: busy ? 'not-allowed' : 'pointer' }}
              >
                Discard edits
              </button>
            )}
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
