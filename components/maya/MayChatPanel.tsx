'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, UIMessage } from 'ai'
import { Rocket, PenLine, BarChart2, MessageCircle, X, ArrowUp, Paperclip, FileText, Loader2, AlertCircle } from 'lucide-react'
import MayaOrb from '@/components/maya/MayaOrb'
import { dedupeMessagesById, messagesForPersist } from '@/lib/maya/dedupeMessages'
import { useMayaFormActuation } from '@/context/MayaFormActuationContext'
import FormPatchApplyCard from '@/components/maya/FormPatchApplyCard'
import { extractFormPatch, validateFormPatch } from '@/lib/maya/formActuation'

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
  p:      ({ children }) => <p style={{ margin: '0 0 10px 0', fontSize: 13.5, lineHeight: 1.7, color: 'var(--color-text-primary)' }}>{children}</p>,
  strong: ({ children }) => <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{children}</span>,
  em:     ({ children }) => <span style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>{children}</span>,
  ul:     ({ children }) => <ul style={{ paddingLeft: 16, margin: '0 0 10px 0' }}>{children}</ul>,
  ol:     ({ children }) => <ol style={{ paddingLeft: 16, margin: '0 0 10px 0' }}>{children}</ol>,
  li:     ({ children }) => <li style={{ marginBottom: 5, fontSize: 13.5, lineHeight: 1.65, color: 'var(--color-text-primary)' }}>{children}</li>,
  h1:     ({ children }) => <p style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 8px 0' }}>{children}</p>,
  h2:     ({ children }) => <p style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 8px 0' }}>{children}</p>,
  h3:     ({ children }) => <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', margin: '0 0 6px 0' }}>{children}</p>,
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
  const formActuation = useMayaFormActuation()
  const formSurfaceRef = useRef(formActuation?.getSnapshot() ?? null)

  const [patchUiState, setPatchUiState] = useState<Record<string, 'applied' | 'dismissed'>>({})

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
  const [chatError, setChatError] = useState<string | null>(null)
  const [billingModalOpen, setBillingModalOpen] = useState(false)
  const attachmentsRef = useRef<Array<{ url: string; name: string; mimeType: string }>>([])
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef    = useRef<UIMessage[]>([])
  const modeRef        = useRef<string | null>(initialMode)
  const pageContextStartedRef = useRef(false)
  const pageContextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const greetedContextRef = useRef<string | null>(null)

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

  // The transport useMemo([]) freezes the initial canvasContext; keep a live ref
  // so requests sent after navigation carry the page the user is actually on.
  const canvasContextRef = useRef(canvasContext)
  useEffect(() => { canvasContextRef.current = canvasContext }, [canvasContext])

  const sessionIdRef = useRef<string | null>(initialSessionId)

  const adjustChatInputHeight = () => {
    const el = chatInputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }

  useEffect(() => {
    adjustChatInputHeight()
  }, [chatInput])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/maya/chat',
    body: { canvasContext, chatSurface: 'sidebar' as const, ...(isHelpMode ? { isHelpMode: true } : {}) },
    fetch: async (url, init) => {
      const body = JSON.parse((init?.body as string) ?? '{}')
      body.canvasContext = canvasContextRef.current ?? null
      if (canvasDataRef.current) body.canvasData = canvasDataRef.current
      formSurfaceRef.current = formActuation?.getSnapshot() ?? null
      if (formSurfaceRef.current) body.formSurface = formSurfaceRef.current
      if (attachmentsRef.current.length) {
        body.attachments = attachmentsRef.current
        attachmentsRef.current = []
      }
      const response = await fetch(url, { ...init, body: JSON.stringify(body) })
      if (!response.ok) {
        const data = await response.clone().json().catch(() => ({}))
        const message = data.message || data.error || `Maya request failed (${response.status})`
        throw new Error(message)
      }
      return response
    },
  }), [])

  const { messages, sendMessage, status } = useChat({
    transport,
    messages: initialMessages.length ? dedupeMessagesById(initialMessages as UIMessage[]) : undefined,
    onError: (error: Error) => {
      const message = error.message || 'Maya could not respond. Please try again.'
      if (message.includes('credits') || message === 'INSUFFICIENT_CREDITS') {
        setBillingModalOpen(true)
        setChatError(null)
        return
      }
      setChatError(message)
    },
    onFinish: async ({ message }: { message: UIMessage }) => {
      if (!profile?.id) return
      const allMessages = messagesForPersist(messagesRef.current, message)
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

  const visibleMessages = dedupeMessagesById(messages.filter(msg => {
    const t = getMsgText(msg)
    return !t.startsWith('__SYSTEM_INIT__') && !t.startsWith('__MODE__') && !t.startsWith('__TASK__') && !t.startsWith('__PAGE_CONTEXT__') && t !== '__HELP__'
  }))

  const chatStarted    = visibleMessages.length > 0 || mode !== null
  const showModePicker = mode === null && !chatStarted && !isHelpMode
  const showThinking   = isLoading && (!visibleMessages.at(-1) || visibleMessages.at(-1)!.role === 'user')

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    if (!pendingTask) return
    setMode('task')
    setChatError(null)
    setBillingModalOpen(false)
    sendMessage({ text: `__TASK__${pendingTask}__` })
    onTaskConsumed?.()
  }, [pendingTask]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isHelpMode) return
    setChatError(null)
    setBillingModalOpen(false)
    sendMessage({ text: '__HELP__' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isHelpMode || pendingTask || initialMessages.length || initialMode) return
    if (!canvasContext && !canvasData) return

    if (pageContextStartedRef.current) {
      // Already greeted. If the user navigated to a different page with the
      // panel open and hasn't said anything yet, re-greet so Maya acknowledges
      // the new screen. Once the user has engaged, stay quiet — fresh context
      // rides along with their next message via canvasContextRef.
      if (!canvasContext || canvasContext === greetedContextRef.current) return
      const userHasTyped = messagesRef.current.some(
        m => m.role === 'user' && !getMsgText(m).startsWith('__'),
      )
      if (userHasTyped || isLoading) {
        greetedContextRef.current = canvasContext
        return
      }
    }

    const sendPageContext = () => {
      pageContextStartedRef.current = true
      greetedContextRef.current = canvasContextRef.current ?? canvasContext ?? null
      setMode('page')
      setChatError(null)
      setBillingModalOpen(false)
      sendMessage({ text: '__PAGE_CONTEXT__' })
    }

    // Rich page payload (canvasData) arrives via a client effect after the coarse
    // nav label. If only the label is here, wait a beat so Maya greets with the
    // actual screen (e.g. a specific agent output) instead of "the Agents page".
    if (canvasData) {
      if (pageContextTimerRef.current) {
        clearTimeout(pageContextTimerRef.current)
        pageContextTimerRef.current = null
      }
      sendPageContext()
      return
    }

    if (!pageContextTimerRef.current) {
      pageContextTimerRef.current = setTimeout(() => {
        pageContextTimerRef.current = null
        sendPageContext()
      }, 700)
    }
  }, [canvasContext, canvasData]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (pageContextTimerRef.current) clearTimeout(pageContextTimerRef.current)
  }, [])

  function selectMode(modeId: string) {
    setMode(modeId)
    setChatError(null)
    setBillingModalOpen(false)
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
    setChatError(null)
    setBillingModalOpen(false)
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
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--color-surface)', width: panelWidth, maxWidth: '100vw', flexShrink: 0, position: 'relative', borderRight: '1px solid var(--color-border)' }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >

      {/* Drop overlay */}
      {isDragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 30,
          background: 'color-mix(in srgb, var(--color-surface-2) 96%, transparent)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10, pointerEvents: 'none',
          border: '2px dashed var(--color-brand-primary)', borderRadius: 0,
        }}>
          <Paperclip size={22} color="var(--color-brand-primary)" />
          <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-brand-primary)' }}>Drop to attach</p>
          <p style={{ fontSize: 12, color: 'var(--color-menu-muted)' }}>Images, PDFs, and documents</p>
        </div>
      )}

      {billingModalOpen && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 35, background: 'rgba(15, 23, 42, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
          <div style={{ width: '100%', maxWidth: 340, borderRadius: 18, border: '1px solid var(--color-border)', background: 'var(--color-surface)', boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 14, background: 'color-mix(in srgb, var(--color-brand-primary) 12%, var(--color-surface))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertCircle size={18} color="var(--color-brand-primary)" />
              </div>
              <button
                onClick={() => setBillingModalOpen(false)}
                aria-label="Close"
                style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: 2 }}
              >
                <X size={16} />
              </button>
            </div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 17, lineHeight: 1.25, color: 'var(--color-text-primary)', fontWeight: 650 }}>Choose a plan to keep using Maya</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, lineHeight: 1.55, color: 'var(--color-text-secondary)' }}>
              Your Foundation is ready. Pick a subscription package to unlock Maya chat, agents, campaigns, and monthly credits.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <a
                href={profile?.plan ? '/dashboard/billing' : '/pricing?source=maya'}
                style={{ flex: 1, textAlign: 'center', borderRadius: 12, background: 'var(--color-brand-primary)', color: 'var(--color-text-inverse)', padding: '10px 12px', fontSize: 13, fontWeight: 650, textDecoration: 'none' }}
              >
                {profile?.plan ? 'Add credits' : 'Choose a plan'}
              </a>
              <button
                onClick={() => setBillingModalOpen(false)}
                style={{ borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', padding: '10px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drag handle — right edge */}
      <div
        onMouseDown={handleDragMouseDown}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, cursor: 'col-resize',
          zIndex: 10, background: isDragging ? 'color-mix(in srgb, var(--color-brand-primary) 40%, transparent)' : 'transparent',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { if (!isDragging) (e.currentTarget as HTMLDivElement).style.background = 'color-mix(in srgb, var(--color-brand-primary) 20%, transparent)' }}
        onMouseLeave={e => { if (!isDragging) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
      />

      {/* Header */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MayaOrb size={24} active={isLoading} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>Maya</span>
          <span style={{ fontSize: 12, color: 'var(--color-status-success)', fontWeight: 500 }}>online</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close chat"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', transition: 'color 0.12s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)' }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', minHeight: 0 }}>
        {showModePicker ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 20 }}>
            <MayaOrb size={44} className="mb-3" />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 3 }}>Hey {companyName !== 'there' ? companyName : 'there'}.</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 20 }}>What would you like to work on?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%' }}>
              {MODES.map(({ id, label, description, Icon }) => (
                <button
                  key={id}
                  onClick={() => selectMode(id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%', transition: 'border-color 0.12s, background 0.12s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-text-secondary)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-hover)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-2)' }}
                >
                  <Icon size={14} color="var(--color-text-secondary)" strokeWidth={1.75} />
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 1 }}>{label}</p>
                    <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {visibleMessages.map((msg) => {
              const text = getMsgText(msg)
              const { cleanText, patch } = msg.role === 'assistant'
                ? extractFormPatch(text)
                : { cleanText: text, patch: null }
              const snapshot = formActuation?.getSnapshot() ?? null
              const validation = patch && snapshot
                ? validateFormPatch(patch, snapshot.fields, {
                    canonicalWebsite: snapshot.canonicalWebsite,
                  })
                : null
              const patchState = patchUiState[msg.id]
              return (
                <div key={msg.id} style={{ marginBottom: msg.role === 'user' ? 16 : 20 }}>
                  {msg.role === 'user' ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ background: 'var(--color-brand-secondary)', color: 'var(--color-text-inverse)', borderRadius: '16px 16px 4px 16px', padding: '9px 14px', maxWidth: '82%', fontSize: 13.5, lineHeight: 1.55 }}>
                        {text}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <MayaOrb size={24} className="mt-0.5" />
                      <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
                        <ReactMarkdown components={PLAIN_MD as never}>{cleanText}</ReactMarkdown>
                        {validation && patchState !== 'dismissed' && snapshot && (
                          <FormPatchApplyCard
                            snapshot={snapshot}
                            patch={validation.patch}
                            errors={validation.errors}
                            applied={patchState === 'applied'}
                            onApply={() => {
                              if (validation.errors.length) return
                              const ok = formActuation?.applyPatch(validation.patch)
                              if (ok) setPatchUiState(prev => ({ ...prev, [msg.id]: 'applied' }))
                            }}
                            onDismiss={() => setPatchUiState(prev => ({ ...prev, [msg.id]: 'dismissed' }))}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {showThinking && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20 }}>
                <MayaOrb size={24} active />
                <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', fontStyle: 'italic', paddingTop: 4 }}>Maya is thinking...</p>
              </div>
            )}

            {chatError && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 24, height: 24, borderRadius: 8, background: 'color-mix(in srgb, var(--color-status-warning) 14%, var(--color-surface))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertCircle size={13} color="var(--color-status-warning)" />
                </div>
                <div style={{ flex: 1, minWidth: 0, border: '1px solid color-mix(in srgb, var(--color-status-warning) 28%, var(--color-border))', background: 'color-mix(in srgb, var(--color-status-warning) 8%, var(--color-surface))', borderRadius: 12, padding: '9px 11px' }}>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-text-primary)' }}>{chatError}</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--color-border)', padding: '12px 14px', background: 'var(--color-surface)' }}>
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
                  background: att.error ? 'color-mix(in srgb, var(--color-status-danger) 8%, var(--color-surface))' : 'var(--color-surface-2)',
                  border: `1px solid ${att.error ? 'color-mix(in srgb, var(--color-status-danger) 28%, var(--color-surface))' : 'var(--color-border)'}`,
                  borderRadius: 8, padding: '4px 7px', maxWidth: 180,
                }}
              >
                {att.uploading ? (
                  <Loader2 size={11} color="var(--color-menu-muted)" className="animate-spin" />
                ) : att.mimeType.startsWith('image/') ? (
                  <span style={{ fontSize: 11 }}>🖼</span>
                ) : (
                  <FileText size={11} color={att.error ? 'var(--color-status-danger)' : 'var(--color-text-secondary)'} />
                )}
                <span style={{
                  fontSize: 11.5,
                  color: att.error ? 'var(--color-status-danger)' : 'var(--color-text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: 110,
                }}>
                  {att.error ? 'Upload failed' : att.name}
                </span>
                {!att.uploading && (
                  <button
                    onClick={() => removeAttachment(att.id)}
                    aria-label="Remove attachment"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-menu-muted)', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {formActuation?.hasSurface && !isHelpMode && (
          <button
            type="button"
            onClick={() => submitMessage('Fill the open form using my Foundation context. Propose values for empty fields only.')}
            disabled={isLoading}
            style={{
              display: 'block',
              width: '100%',
              marginBottom: 8,
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid color-mix(in srgb, var(--color-brand-primary) 25%, var(--color-border))',
              background: 'color-mix(in srgb, var(--color-brand-primary) 6%, var(--color-surface))',
              color: 'var(--color-brand-primary)',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.5 : 1,
              textAlign: 'left',
            }}
          >
            Fill form from Foundation →
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, background: 'var(--color-surface-2)', borderRadius: 14, padding: '10px 14px', border: '1px solid var(--color-border)', transition: 'border-color 0.12s' }}>
          {/* Paperclip button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="Attach image or document"
            style={{ background: 'none', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', color: 'var(--color-menu-muted)', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0, marginBottom: 2, opacity: isLoading ? 0.4 : 1, transition: 'color 0.12s' }}
            onMouseEnter={e => { if (!isLoading) (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-menu-muted)' }}
          >
            <Paperclip size={15} />
          </button>

          <textarea
            ref={chatInputRef}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Maya anything..."
            rows={1}
            disabled={isLoading}
            style={{ flex: 1, background: 'transparent', color: 'var(--color-text-primary)', resize: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.5, minHeight: 20, maxHeight: 128, overflowY: 'auto', opacity: isLoading ? 0.5 : 1 }}
          />
          <button
            onClick={() => submitMessage()}
            disabled={isLoading}
            style={{ width: 28, height: 28, borderRadius: 8, background: isLoading ? 'var(--color-border)' : 'var(--color-brand-secondary)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isLoading ? 'not-allowed' : 'pointer', flexShrink: 0, transition: 'background 0.12s' }}
          >
            <ArrowUp size={13} color="var(--color-text-inverse)" />
          </button>
        </div>
        <p style={{ fontSize: 10.5, color: 'var(--color-border-strong)', textAlign: 'center', marginTop: 7 }}>
          Maya makes mistakes. Verify important decisions.
        </p>
      </div>
    </div>
  )
}
