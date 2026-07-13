'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import {
  MARKETING_CHAT_MAX_SESSION_MESSAGES,
  MARKETING_CHAT_SESSION_LIMIT_MESSAGE,
} from '@/lib/marketing/marketingChatConfig'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

const STARTER_CHIPS = [
  'What does Maya actually do?',
  'How much does it cost?',
  'Does anything publish without my approval?',
] as const

const SESSION_KEY = 'ask_maya_session_id'
const UNAVAILABLE = 'Maya is unavailable right now. Try again later or email support@agent7even.ai.'

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

function renderMessageContent(content: string) {
  const marker = '→ /sign-up'
  const idx = content.indexOf(marker)
  if (idx === -1) return content
  return (
    <>
      {content.slice(0, idx)}
      <a href="/sign-up">Sign up and continue inside Agent7even</a>
    </>
  )
}

export default function AskMaya() {
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setSessionId(getOrCreateSessionId())
  }, [])

  useEffect(() => {
    fetch('/api/marketing/chat')
      .then((r) => r.json())
      .then((data: { enabled?: boolean }) => setEnabled(data.enabled !== false))
      .catch(() => setEnabled(false))
  }, [])

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, open, loading])

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 120)
      return () => window.clearTimeout(t)
    }
  }, [open])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading || !sessionId) return

      if (!enabled) {
        setError(UNAVAILABLE)
        return
      }

      if (sessionEnded) return

      setError(null)
      setLoading(true)
      setInput('')

      const userMessage: ChatMessage = { role: 'user', content: trimmed }
      setMessages((prev) => [...prev, userMessage])

      try {
        const res = await fetch('/api/marketing/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            message: trimmed,
            history: messages.slice(-12),
          }),
        })

        const data = (await res.json()) as { reply?: string; error?: string; code?: string }

        if (!res.ok) {
          if (data.code === 'session_limit') {
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: data.error ?? MARKETING_CHAT_SESSION_LIMIT_MESSAGE,
              },
            ])
            setSessionEnded(true)
            return
          }
          setError(data.error ?? UNAVAILABLE)
          if (data.code === 'disabled') setEnabled(false)
          return
        }

        const reply = data.reply?.trim() || UNAVAILABLE
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      } catch {
        setError(UNAVAILABLE)
      } finally {
        setLoading(false)
      }
    },
    [enabled, loading, messages, sessionEnded, sessionId],
  )

  const userMessageCount = messages.filter((m) => m.role === 'user').length
  const atSessionLimit = sessionEnded || userMessageCount >= MARKETING_CHAT_MAX_SESSION_MESSAGES

  return (
    <div className="ask-maya-root" aria-live="polite">
      {open && (
        <div
          className="ask-maya-backdrop"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`ask-maya-panel${open ? ' is-open' : ''}`}
        role="dialog"
        aria-label="Ask Maya"
        aria-hidden={!open}
      >
        <header className="ask-maya-header">
          <div>
            <p className="ask-maya-kicker">Ask</p>
            <h2 className="ask-maya-title">
              <span className="ask-maya-name">Maya</span>
            </h2>
          </div>
          <button
            type="button"
            className="ask-maya-close"
            onClick={() => setOpen(false)}
            aria-label="Close chat"
          >
            ×
          </button>
        </header>

        <div className="ask-maya-messages" ref={listRef}>
          {!enabled && (
            <p className="ask-maya-system">{UNAVAILABLE}</p>
          )}

          {enabled && messages.length === 0 && (
            <div className="ask-maya-starters">
              <p className="ask-maya-intro">
                Questions about Agent7even? I answer from our product docs, not guesses.
              </p>
              {STARTER_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="ask-maya-chip"
                  onClick={() => sendMessage(chip)}
                  disabled={loading || atSessionLimit}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={`${msg.role}-${i}`}
              className={msg.role === 'user' ? 'ask-maya-bubble ask-maya-bubble-user' : 'ask-maya-bubble ask-maya-bubble-bot'}
            >
              {msg.role === 'assistant' ? renderMessageContent(msg.content) : msg.content}
            </div>
          ))}

          {loading && <p className="ask-maya-typing">Maya is typing…</p>}

          {error && <p className="ask-maya-error">{error}</p>}
        </div>

        <form
          className="ask-maya-form"
          onSubmit={(e) => {
            e.preventDefault()
            void sendMessage(input)
          }}
        >
          <textarea
            ref={inputRef}
            className="ask-maya-input"
            rows={2}
            maxLength={500}
            placeholder={enabled ? 'Ask about Agent7even…' : 'Chat unavailable'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!enabled || loading || atSessionLimit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void sendMessage(input)
              }
            }}
          />
          <button
            type="submit"
            className="ask-maya-send"
            disabled={!enabled || loading || atSessionLimit || !input.trim()}
          >
            Send
          </button>
        </form>
      </div>

      <button
        type="button"
        className={`ask-maya-launcher${open ? ' is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="ask-maya-panel"
        aria-label={open ? 'Close chat' : 'Ask Maya'}
      >
        {open ? (
          <X size={22} strokeWidth={2} aria-hidden="true" />
        ) : (
          <MessageCircle size={24} strokeWidth={2} aria-hidden="true" />
        )}
        {!open && (
          <span className="ask-maya-launcher-tip" aria-hidden="true">
            <MessageCircle size={15} strokeWidth={2} />
            Ask Maya
          </span>
        )}
      </button>
    </div>
  )
}
