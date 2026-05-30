'use client'

import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, UIMessage } from 'ai'
import { Rocket, PenLine, BarChart2, MessageCircle, X } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

export interface Profile {
  id?: string
  company_name?: string | null
  full_name?: string | null
  business_type?: string | null
  plan?: string | null
  website_url?: string | null
  instagram_handle?: string | null
  ideal_customer?: string | null
  sell_locations?: string[] | null
  marketing_budget?: string | null
  competitors?: string[] | null
  top_goals?: string[] | null
  marketing_challenge?: string | null
  content_comfort?: string | null
  foundation_complete?: boolean | null
}

interface Props {
  profile?: Profile | null
  initialMessages?: unknown[]
  initialMode?: string | null
  canvasContext?: string
  pendingTask?: string | null
  onTaskConsumed?: () => void
  onClose?: () => void
}

// ── Markdown components ───────────────────────────────────────────────────

const PLAIN_MD: Record<string, React.ComponentType<{ children?: React.ReactNode }>> = {
  p: ({ children }) => <p style={{ margin: '0 0 10px 0', fontSize: 13.5, lineHeight: 1.7, color: '#0a0a0a' }}>{children}</p>,
  strong: ({ children }) => <span style={{ fontWeight: 500, color: '#0a0a0a' }}>{children}</span>,
  em: ({ children }) => <span style={{ fontStyle: 'italic', color: '#555' }}>{children}</span>,
  ul: ({ children }) => <ul style={{ paddingLeft: 16, margin: '0 0 10px 0' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingLeft: 16, margin: '0 0 10px 0' }}>{children}</ol>,
  li: ({ children }) => <li style={{ marginBottom: 5, fontSize: 13.5, lineHeight: 1.65 }}>{children}</li>,
  h1: ({ children }) => <p style={{ fontSize: 13.5, fontWeight: 500, color: '#0a0a0a', margin: '0 0 8px 0' }}>{children}</p>,
  h2: ({ children }) => <p style={{ fontSize: 13.5, fontWeight: 500, color: '#0a0a0a', margin: '0 0 8px 0' }}>{children}</p>,
  h3: ({ children }) => <p style={{ fontSize: 13, fontWeight: 500, color: '#555', margin: '0 0 6px 0' }}>{children}</p>,
}

// ── Modes ─────────────────────────────────────────────────────────────────

const MODES = [
  { id: 'Build a campaign', label: 'Build a campaign', description: 'Create a 30-day marketing plan', Icon: Rocket },
  { id: 'Create content', label: 'Create content', description: 'Captions, emails, or ad copy', Icon: PenLine },
  { id: 'Analyze my marketing', label: 'Analyze my marketing', description: "Review what's working", Icon: BarChart2 },
  { id: 'Just talk to Maya', label: 'Just talk to Maya', description: 'Open conversation, no agenda', Icon: MessageCircle },
]

// ── Component ─────────────────────────────────────────────────────────────

export default function MayChatPanel({
  profile,
  initialMessages = [],
  initialMode = null,
  canvasContext,
  pendingTask = null,
  onTaskConsumed,
  onClose,
}: Props) {
  const companyName = profile?.company_name ?? profile?.full_name ?? 'there'

  const profileData = {
    companyName,
    businessType:      profile?.business_type      ?? '',
    idealCustomer:     profile?.ideal_customer      ?? '',
    sellLocations:     profile?.sell_locations      ?? [],
    marketingBudget:   profile?.marketing_budget    ?? '',
    topGoals:          profile?.top_goals           ?? [],
    marketingChallenge: profile?.marketing_challenge ?? '',
    contentComfort:    profile?.content_comfort     ?? '',
    competitors:       profile?.competitors         ?? [],
    websiteUrl:        profile?.website_url         ?? '',
    instagramHandle:   profile?.instagram_handle    ?? '',
  }

  const [mode, setMode]         = useState<string | null>(initialMode)
  const [chatInput, setChatInput] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesRef    = useRef<UIMessage[]>([])
  const modeRef        = useRef<string | null>(initialMode)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api:  '/api/maya/chat',
      body: { profile: profileData, canvasContext },
    }),
    messages: initialMessages.length ? (initialMessages as UIMessage[]) : undefined,
    onFinish: async ({ message }: { message: UIMessage }) => {
      if (profile?.id) {
        fetch('/api/maya/session', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            userId:   profile.id,
            messages: [...messagesRef.current, message],
            mode:     modeRef.current,
          }),
        }).catch(() => {})
      }
    },
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  function getMsgText(msg: UIMessage) {
    return msg.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('')
  }

  const visibleMessages = messages.filter(msg => {
    const t = getMsgText(msg)
    return !t.startsWith('__SYSTEM_INIT__') && !t.startsWith('__MODE__') && !t.startsWith('__TASK__')
  })

  const chatStarted    = visibleMessages.length > 0 || mode !== null
  const showModePicker = mode === null && !chatStarted
  const showThinking   = isLoading && (!visibleMessages.at(-1) || visibleMessages.at(-1)!.role === 'user')

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Inject task from campaign "Do this with Maya →" button
  useEffect(() => {
    if (!pendingTask) return
    setMode('task')
    sendMessage({ text: `__TASK__${pendingTask}__` })
    onTaskConsumed?.()
  }, [pendingTask]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectMode(modeId: string) {
    setMode(modeId)
    sendMessage({ text: `__MODE__${modeId}__` })
  }

  function submitMessage(text?: string) {
    const content = (text ?? chatInput).trim()
    if (!content || isLoading) return
    sendMessage({ text: content })
    setChatInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitMessage() }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '0.5px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>M</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#0a0a0a' }}>Maya</span>
          <span style={{ fontSize: 11, color: '#bbb' }}>·</span>
          <span style={{ fontSize: 11, color: '#bbb' }}>online</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#555' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ccc' }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px' }}>
        {showModePicker ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <span style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>M</span>
            </div>
            <p style={{ fontSize: 16, fontWeight: 500, color: '#0a0a0a', marginBottom: 3 }}>Hey {companyName !== 'there' ? companyName : 'there'}.</p>
            <p style={{ fontSize: 12, color: '#999', marginBottom: 20 }}>What would you like to work on?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%' }}>
              {MODES.map(({ id, label, description, Icon }) => (
                <button
                  key={id}
                  onClick={() => selectMode(id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 10, border: '0.5px solid #e8e8e8', background: '#fafafa', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#0a0a0a'; (e.currentTarget as HTMLButtonElement).style.background = '#f5f5f5' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e8e8e8'; (e.currentTarget as HTMLButtonElement).style.background = '#fafafa' }}
                >
                  <Icon size={14} color="#555" strokeWidth={1.75} />
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: '#0a0a0a', marginBottom: 1 }}>{label}</p>
                    <p style={{ fontSize: 11, color: '#aaa', lineHeight: 1.4 }}>{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {visibleMessages.map((msg) => {
              const text = getMsgText(msg)
              return (
                <div key={msg.id} style={{ marginBottom: msg.role === 'user' ? 20 : 24 }}>
                  {msg.role === 'user' ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ background: '#0a0a0a', color: '#fff', borderRadius: '16px 16px 4px 16px', padding: '9px 13px', maxWidth: '80%', fontSize: 13.5, lineHeight: 1.55 }}>
                        {text}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        <span style={{ color: '#fff', fontSize: 11, fontWeight: 500 }}>M</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
                        <ReactMarkdown components={PLAIN_MD as never}>{text}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {showThinking && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: '#fff', fontSize: 11, fontWeight: 500 }}>M</span>
                </div>
                <p style={{ fontSize: 12.5, color: '#bbb', fontStyle: 'italic', paddingTop: 6 }}>Maya is thinking...</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0, borderTop: '0.5px solid #f0f0f0', padding: '12px 14px', background: '#fff' }}>
        <div style={{ position: 'relative' }}>
          <textarea
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Maya anything..."
            rows={1}
            disabled={isLoading}
            style={{ width: '100%', border: '0.5px solid #e0e0e0', borderRadius: 20, padding: '9px 42px 9px 14px', fontSize: 13.5, background: '#fafafa', color: '#0a0a0a', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box', display: 'block', opacity: isLoading ? 0.6 : 1 }}
          />
          <button
            onClick={() => submitMessage()}
            disabled={isLoading}
            style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: '50%', background: isLoading ? '#ccc' : '#0a0a0a', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isLoading ? 'not-allowed' : 'pointer' }}
          >
            <i className="ti ti-arrow-up" style={{ fontSize: 13, color: '#fff' }} />
          </button>
        </div>
        <p style={{ fontSize: 10.5, color: '#ddd', textAlign: 'center', marginTop: 7 }}>
          Maya makes mistakes. Verify important decisions.
        </p>
      </div>

      <style>{`
        @keyframes dotPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
