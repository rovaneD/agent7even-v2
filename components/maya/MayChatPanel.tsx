'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, UIMessage } from 'ai'
import { Rocket, PenLine, BarChart2, MessageCircle, X, ArrowUp, Paperclip, FileText, Loader2 } from 'lucide-react'

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
  canvasData?: string
  pendingTask?: string | null
  onTaskConsumed?: () => void
  onClose?: () => void
  sessionId?: string | null
  onSessionCreated?: (id: string, title: string) => void
  isHelpMode?: boolean
}

// ── Markdown components ───────────────────────────────────────────────────

const PLAIN_MD: Record<string, React.ComponentType<{ children?: React.ReactNode }>> = {
  p:      ({ children }) => <p style={{ margin: '0 0 10px 0', fontSize: 13.5, lineHeight: 1.7, color: '#2D3748' }}>{children}</p>,
  strong: ({ children }) => <span style={{ fontWeight: 500, color: '#2D3748' }}>{children}</span>,
  em:     ({ children }) => <span style={{ fontStyle: 'italic', color: '#64748B' }}>{children}</span>,
  ul:     ({ children }) => <ul style={{ paddingLeft: 16, margin: '0 0 10px 0' }}>{children}</ul>,
  ol:     ({ children }) => <ol style={{ paddingLeft: 16, margin: '0 0 10px 0' }}>{children}</ol>,
  li:     ({ children }) => <li style={{ marginBottom: 5, fontSize: 13.5, lineHeight: 1.65, color: '#2D3748' }}>{children}</li>,
  h1:     ({ children }) => <p style={{ fontSize: 13.5, fontWeight: 500, color: '#2D3748', margin: '0 0 8px 0' }}>{children}</p>,
  h2:     ({ children }) => <p style={{ fontSize: 13.5, fontWeight: 500, color: '#2D3748', margin: '0 0 8px 0' }}>{children}</p>,
  h3:     ({ children }) => <p style={{ fontSize: 13, fontWeight: 500, color: '#64748B', margin: '0 0 6px 0' }}>{children}</p>,
}

interface PendingAttachment {
  id: string
  url?: string
  name: string
  mimeType: string
  size: number
  uploading: boolean
  error?: string
}

// ── Modes ─────────────────────────────────────────────────────────────────

const MODES = [
  { id: 'Build a campaign',     label: 'Build a campaign',     description: 'Create a 30-day marketing plan',  Icon: Rocket        },
  { id: 'Create content',       label: 'Create content',       description: 'Captions, emails, or ad copy',    Icon: PenLine       },
  { id: 'Analyze my marketing', label: 'Analyze my marketing', description: "Review what's working",           Icon: BarChart2     },
  { id: 'Just talk to Maya',    label: 'Just talk to Maya',    description: 'Open conversation, no agenda',    Icon: MessageCircle },
]

// ── Constants ─────────────────────────────────────────────────────────────

const MIN_WIDTH = 320
const MAX_WIDTH = 640
const DEFAULT_WIDTH = 380

// ── Component ─────────────────────────────────────────────────────────────

export default function MayChatPanel({
  profile,
  initialMessages = [],
  initialMode = null,
  canvasContext,
  canvasData,
  pendingTask = null,
  onTaskConsumed,
  onClose,
  sessionId: initialSessionId = null,
  onSessionCreated,
  isHelpMode = false,
}: Props) {
  const companyName = profile?.company_name ?? profile?.full_name ?? 'there'

  const [mode, setMode]         = useState<string | null>(initialMode)
  const [chatInput, setChatInput] = useState('')
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_WIDTH
    return parseInt(localStorage.getItem('maya-panel-width') ?? String(DEFAULT_WIDTH))
  })
  const [isDragging, setIsDragging] = useState(false)
  const panelWidthRef = useRef(panelWidth)

  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const attachmentsRef = useRef<Array<{ url: string; name: string; mimeType: string }>>([])
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesRef    = useRef<UIMessage[]>([])
  const modeRef        = useRef<string | null>(initialMode)
  const pageContextStartedRef = useRef(false)

  function handleDragMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    setIsDragging(true)
    const startX = e.clientX
    const startWidth = panelWidthRef.current

    function onMouseMove(ev: MouseEvent) {
      const delta = ev.clientX - startX
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta))
      setPanelWidth(newWidth)
      panelWidthRef.current = newWidth
    }

    function onMouseUp() {
      setIsDragging(false)
      localStorage.setItem('maya-panel-width', String(panelWidthRef.current))
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const canvasDataRef = useRef(canvasData)
  useEffect(() => { canvasDataRef.current = canvasData }, [canvasData])

  const sessionIdRef = useRef<string | null>(initialSessionId)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/maya/chat',
    body: { canvasContext, ...(isHelpMode ? { isHelpMode: true } : {}) },
    fetch: async (url, init) => {
      const body = JSON.parse((init?.body as string) ?? '{}')
      if (canvasDataRef.current) body.canvasData = canvasDataRef.current
      if (attachmentsRef.current.length) {
        body.attachments = attachmentsRef.current
        attachmentsRef.current = []
      }
      return fetch(url, { ...init, body: JSON.stringify(body) })
    },
  }), [])

  const { messages, sendMessage, status } = useChat({
    transport,
    messages: initialMessages.length ? (initialMessages as UIMessage[]) : undefined,
    onFinish: async ({ message }: { message: UIMessage }) => {
      if (!profile?.id) return
      const allMessages = [...messagesRef.current, message]
      try {
        const res = await fetch('/api/maya/session', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            userId:        profile.id,
            sessionId:     sessionIdRef.current,
            messages:      allMessages,
            mode:          modeRef.current,
            canvasContext: canvasContext ?? null,
          }),
        })
        const data = await res.json()
        if (data.sessionId && !sessionIdRef.current) {
          sessionIdRef.current = data.sessionId
          onSessionCreated?.(data.sessionId, data.title ?? 'New conversation')
        }
      } catch {
        // non-fatal
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
    return !t.startsWith('__SYSTEM_INIT__') && !t.startsWith('__MODE__') && !t.startsWith('__TASK__') && !t.startsWith('__PAGE_CONTEXT__') && t !== '__HELP__'
  })

  const chatStarted    = visibleMessages.length > 0 || mode !== null
  const showModePicker = mode === null && !chatStarted && !isHelpMode
  const showThinking   = isLoading && (!visibleMessages.at(-1) || visibleMessages.at(-1)!.role === 'user')

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    if (!pendingTask) return
    setMode('task')
    sendMessage({ text: `__TASK__${pendingTask}__` })
    onTaskConsumed?.()
  }, [pendingTask]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isHelpMode) return
    sendMessage({ text: '__HELP__' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pageContextStartedRef.current || isHelpMode || pendingTask || initialMessages.length || initialMode) return
    if (!canvasContext && !canvasData) return
    pageContextStartedRef.current = true
    setMode('page')
    sendMessage({ text: '__PAGE_CONTEXT__' })
  }, [canvasContext, canvasData]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectMode(modeId: string) {
    setMode(modeId)
    sendMessage({ text: `__MODE__${modeId}__` })
  }

  async function uploadFiles(files: File[]) {
    if (!files.length) return
    const newItems: PendingAttachment[] = files.map(f => ({
      id: Math.random().toString(36).slice(2),
      name: f.name,
      mimeType: f.type,
      size: f.size,
      uploading: true,
    }))
    setPendingAttachments(prev => [...prev, ...newItems])

    await Promise.all(newItems.map(async (item, i) => {
      const fd = new FormData()
      fd.append('file', files[i])
      try {
        const res  = await fetch('/api/maya/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Upload failed')
        setPendingAttachments(prev => prev.map(a =>
          a.id === item.id ? { ...a, url: data.url, uploading: false } : a
        ))
      } catch {
        setPendingAttachments(prev => prev.map(a =>
          a.id === item.id ? { ...a, uploading: false, error: 'Failed' } : a
        ))
      }
    }))
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (fileInputRef.current) fileInputRef.current.value = ''
    uploadFiles(files)
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setIsDragOver(false)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) uploadFiles(files)
  }

  function removeAttachment(id: string) {
    setPendingAttachments(prev => prev.filter(a => a.id !== id))
  }

  function submitMessage(text?: string) {
    const content = (text ?? chatInput).trim()
    if (!content || isLoading) return
    const ready = pendingAttachments.filter(a => a.url && !a.uploading && !a.error)
    if (ready.length) {
      attachmentsRef.current = ready.map(a => ({ url: a.url!, name: a.name, mimeType: a.mimeType }))
    }
    sendMessage({ text: content })
    setChatInput('')
    setPendingAttachments([])
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitMessage() }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', width: panelWidth, flexShrink: 0, position: 'relative', borderRight: '1px solid #E2E8F0' }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >

      {/* Drop overlay */}
      {isDragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 30,
          background: 'rgba(248,250,252,0.96)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10, pointerEvents: 'none',
          border: '2px dashed #3B82F6', borderRadius: 0,
        }}>
          <Paperclip size={22} color="#3B82F6" />
          <p style={{ fontSize: 13.5, fontWeight: 600, color: '#3B82F6' }}>Drop to attach</p>
          <p style={{ fontSize: 12, color: '#94A3B8' }}>Images, PDFs, and documents</p>
        </div>
      )}

      {/* Drag handle — right edge */}
      <div
        onMouseDown={handleDragMouseDown}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, cursor: 'col-resize',
          zIndex: 10, background: isDragging ? 'rgba(59,130,246,0.4)' : 'transparent',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { if (!isDragging) (e.currentTarget as HTMLDivElement).style.background = 'rgba(59,130,246,0.2)' }}
        onMouseLeave={e => { if (!isDragging) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
      />

      {/* Header */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 8, background: '#2D3748', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>M</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#2D3748' }}>Maya</span>
          <span style={{ fontSize: 12, color: '#10B981', fontWeight: 500 }}>online</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', transition: 'color 0.12s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#2D3748' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#64748B' }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
        {showModePicker ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: '#2D3748', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>M</span>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#2D3748', marginBottom: 3 }}>Hey {companyName !== 'there' ? companyName : 'there'}.</p>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 20 }}>What would you like to work on?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%' }}>
              {MODES.map(({ id, label, description, Icon }) => (
                <button
                  key={id}
                  onClick={() => selectMode(id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 12, border: '1px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%', transition: 'border-color 0.12s, background 0.12s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#64748B'; (e.currentTarget as HTMLButtonElement).style.background = '#F1F5F9' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0'; (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFC' }}
                >
                  <Icon size={14} color="#64748B" strokeWidth={1.75} />
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: '#2D3748', marginBottom: 1 }}>{label}</p>
                    <p style={{ fontSize: 11, color: '#64748B', lineHeight: 1.4 }}>{description}</p>
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
                <div key={msg.id} style={{ marginBottom: msg.role === 'user' ? 16 : 20 }}>
                  {msg.role === 'user' ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ background: '#2D3748', color: '#fff', borderRadius: '16px 16px 4px 16px', padding: '9px 14px', maxWidth: '82%', fontSize: 13.5, lineHeight: 1.55 }}>
                        {text}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 8, background: '#2D3748', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                        <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>M</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
                        <ReactMarkdown components={PLAIN_MD as never}>{text}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {showThinking && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 24, height: 24, borderRadius: 8, background: '#2D3748', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>M</span>
                </div>
                <p style={{ fontSize: 12.5, color: '#64748B', fontStyle: 'italic', paddingTop: 4 }}>Maya is thinking...</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0, borderTop: '1px solid #E2E8F0', padding: '12px 14px', background: '#fff' }}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.txt,.md,.csv,.doc,.docx"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {/* Attachment chips */}
        {pendingAttachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {pendingAttachments.map(att => (
              <div
                key={att.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: att.error ? '#FEF2F2' : '#F1F5F9',
                  border: `1px solid ${att.error ? '#FECACA' : '#E2E8F0'}`,
                  borderRadius: 8, padding: '4px 7px', maxWidth: 180,
                }}
              >
                {att.uploading ? (
                  <Loader2 size={11} color="#94A3B8" className="animate-spin" />
                ) : att.mimeType.startsWith('image/') ? (
                  <span style={{ fontSize: 11 }}>🖼</span>
                ) : (
                  <FileText size={11} color={att.error ? '#EF4444' : '#64748B'} />
                )}
                <span style={{
                  fontSize: 11.5,
                  color: att.error ? '#EF4444' : '#2D3748',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: 110,
                }}>
                  {att.error ? 'Upload failed' : att.name}
                </span>
                {!att.uploading && (
                  <button
                    onClick={() => removeAttachment(att.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, background: '#F8FAFC', borderRadius: 14, padding: '10px 14px', border: '1px solid #E2E8F0', transition: 'border-color 0.12s' }}>
          {/* Paperclip button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="Attach image or document"
            style={{ background: 'none', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', color: '#94A3B8', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0, marginBottom: 2, opacity: isLoading ? 0.4 : 1, transition: 'color 0.12s' }}
            onMouseEnter={e => { if (!isLoading) (e.currentTarget as HTMLButtonElement).style.color = '#64748B' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8' }}
          >
            <Paperclip size={15} />
          </button>

          <textarea
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Maya anything..."
            rows={1}
            disabled={isLoading}
            style={{ flex: 1, background: 'transparent', color: '#2D3748', resize: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.5, maxHeight: 128, opacity: isLoading ? 0.5 : 1 }}
          />
          <button
            onClick={() => submitMessage()}
            disabled={isLoading}
            style={{ width: 28, height: 28, borderRadius: 8, background: isLoading ? '#E2E8F0' : '#2D3748', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isLoading ? 'not-allowed' : 'pointer', flexShrink: 0, transition: 'background 0.12s' }}
          >
            <ArrowUp size={13} color="#fff" />
          </button>
        </div>
        <p style={{ fontSize: 10.5, color: '#CBD5E1', textAlign: 'center', marginTop: 7 }}>
          Maya makes mistakes. Verify important decisions.
        </p>
      </div>
    </div>
  )
}
