'use client'

import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, UIMessage } from 'ai'

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
  companyName: string
  businessType: string
  plan: string
  websiteUrl?: string
  instagramHandle?: string
  businessGoals?: string[]
  idealCustomer?: string
  sellLocations?: string[]
  marketingBudget?: string
  competitors?: string[]
  topGoals?: string[]
  marketingChallenge?: string
  contentComfort?: string
  pendingApprovalCount?: number
  initialPrompt?: string
}

type CanvasState = 'default' | 'building' | 'plan'

// ── Helpers ────────────────────────────────────────────────────────────────

const PLAN_TRIGGERS = [
  '30-day', "here's your plan", 'week 1', 'week 2',
  'your plan', 'put it together', 'here is your',
  'let me put something together', "i've got what i need",
]

function isPlanResponse(text: string) {
  return PLAN_TRIGGERS.some(t => text.toLowerCase().includes(t))
}

const SECTION_KEYWORDS = /\b(week|content|email|social|ads|paid|organic|strategy|brand|launch|phase|copy|instagram|facebook|seo|blog|reels|video|campaign|goals?|overview|summary)\b/i

function extractPlanSections(text: string): { title: string; body: string }[] {
  const lines = text.split('\n')
  const sections: { title: string; body: string }[] = []
  let current: { title: string; body: string } | null = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const isHeader =
      (line.endsWith(':') && line.length < 60) ||
      (SECTION_KEYWORDS.test(line) && line.length < 50 && !line.includes('.'))
    if (isHeader) {
      if (current) sections.push(current)
      current = { title: line.replace(/:$/, '').trim(), body: '' }
    } else if (current) {
      const stripped = line.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^[-*+]\s+/gm, '• ').trim()
      if (stripped) current.body += (current.body ? '\n' : '') + stripped
    }
  }
  if (current) sections.push(current)
  if (sections.length < 2) return [{ title: 'Your plan', body: text.replace(/[*#]/g, '').trim() }]
  return sections.slice(0, 8)
}

// ── Static nav ─────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: 'ti-message-circle', label: 'Talk to Maya', id: 'maya', href: '/maya' },
  { icon: 'ti-layout-grid', label: 'My campaigns', id: 'campaigns', href: null },
  { icon: 'ti-calendar', label: 'Content calendar', id: 'calendar', href: null },
  { icon: 'ti-chart-bar', label: 'Results', id: 'results', href: null },
  { icon: 'ti-robot', label: 'Agents', id: 'agents', href: '/dashboard/agents' },
  { icon: 'ti-heart', label: 'Saved', id: 'saved', href: null },
  { icon: 'ti-sparkles', label: 'Brand kit', id: 'brand', href: null },
  { icon: 'ti-shopping-bag', label: 'Services', id: 'services', href: null },
]

const SUGGESTIONS = [
  { icon: 'ti-sparkles', text: 'Build my 30-day campaign' },
  { icon: 'ti-photo', text: 'What should I post this week?' },
  { icon: 'ti-eye', text: 'Help me stand out from competitors' },
]

// ── ReactMarkdown plain components (no bubble styles, just text) ───────────

const PLAIN_MD: Record<string, React.ComponentType<{ children?: React.ReactNode }>> = {
  p: ({ children }) => <p style={{ margin: '0 0 12px 0', fontSize: 14, lineHeight: 1.7, color: '#0a0a0a' }}>{children}</p>,
  strong: ({ children }) => <span style={{ fontWeight: 500, color: '#0a0a0a' }}>{children}</span>,
  em: ({ children }) => <span style={{ fontStyle: 'italic', color: '#444' }}>{children}</span>,
  ul: ({ children }) => <ul style={{ paddingLeft: 16, margin: '0 0 12px 0' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingLeft: 16, margin: '0 0 12px 0' }}>{children}</ol>,
  li: ({ children }) => <li style={{ marginBottom: 6, fontSize: 14, lineHeight: 1.65 }}>{children}</li>,
  h1: ({ children }) => <p style={{ fontSize: 14, fontWeight: 500, color: '#0a0a0a', margin: '0 0 8px 0' }}>{children}</p>,
  h2: ({ children }) => <p style={{ fontSize: 14, fontWeight: 500, color: '#0a0a0a', margin: '0 0 8px 0' }}>{children}</p>,
  h3: ({ children }) => <p style={{ fontSize: 13, fontWeight: 500, color: '#555', margin: '0 0 6px 0' }}>{children}</p>,
}

// ── Component ──────────────────────────────────────────────────────────────

export default function MayaShell({
  companyName, businessType, websiteUrl, instagramHandle, businessGoals,
  idealCustomer, sellLocations, marketingBudget, competitors = [],
  topGoals, marketingChallenge, contentComfort, pendingApprovalCount = 0,
  initialPrompt,
}: Props) {
  const [activeNav, setActiveNav] = useState('maya')
  const [canvasOpen, setCanvasOpen] = useState(true)
  const [canvasState, setCanvasState] = useState<CanvasState>('default')
  const [planSections, setPlanSections] = useState<{ title: string; body: string }[]>([])
  const [knownFacts, setKnownFacts] = useState<string[]>(() => {
    const facts: string[] = []
    if (companyName && companyName !== 'there') facts.push(companyName)
    if (businessType) facts.push(businessType)
    if (idealCustomer) facts.push(idealCustomer.slice(0, 30) + (idealCustomer.length > 30 ? '…' : ''))
    if (marketingBudget) facts.push(marketingBudget)
    if (topGoals?.length) facts.push(topGoals[0])
    if (websiteUrl) facts.push(websiteUrl.replace(/^https?:\/\//, ''))
    return facts.slice(0, 6)
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const initSent = useRef(false)
  const initials = companyName && companyName !== 'there' ? companyName.slice(0, 2).toUpperCase() : 'ME'
  const displayName = companyName !== 'there' ? companyName : 'Your business'

  const profile = {
    companyName, businessType, idealCustomer, sellLocations,
    marketingBudget, topGoals, marketingChallenge, contentComfort,
    competitors, websiteUrl, instagramHandle,
  }

  const [chatInput, setChatInput] = useState('')
  const [agentRunning, setAgentRunning] = useState(false)

  const ORCHESTRATE_TRIGGER = "i'm spinning up the campaign builder"

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/maya/chat',
      body: { profile },
    }),
    onFinish: async ({ message }: { message: UIMessage }) => {
      const text = message.parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map(p => p.text).join('')

      if (isPlanResponse(text)) {
        setPlanSections(extractPlanSections(text))
        setCanvasState('plan')
      }

      // Maya is orchestrating — fire the Campaign Builder
      if (text.toLowerCase().includes(ORCHESTRATE_TRIGGER)) {
        setAgentRunning(true)
        try {
          await fetch('/api/agents/tasks/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agent: 'campaign_builder',
              input: {
                company_name: companyName,
                business_type: businessType,
                ideal_customer: idealCustomer,
                top_goals: topGoals,
                marketing_budget: marketingBudget,
                competitors,
                sell_locations: sellLocations,
              },
              priority: 'high',
            }),
          })
        } catch {
          // task creation failure is non-critical
        }
      }
    },
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  function getMsgText(msg: UIMessage) {
    return msg.parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map(p => p.text).join('')
  }

  const visibleMessages = messages.filter(msg => !getMsgText(msg).startsWith('__SYSTEM_INIT__'))
  const hasInitMessage = messages.some(msg => getMsgText(msg).startsWith('__SYSTEM_INIT__'))
  const chatStarted = visibleMessages.length > 0 || hasInitMessage
  const sessionTitle = (() => {
    const first = visibleMessages.find(m => m.role === 'user')
    if (!first) return ''
    const text = getMsgText(first)
    return text.length > 40 ? text.slice(0, 40) + '\u2026' : text
  })()

  useEffect(() => {
    const userMsgs = visibleMessages.filter(m => m.role === 'user')
    if (hasInitMessage && canvasState === 'default') setCanvasState('building')
    if (userMsgs.length === 0) return
    if (canvasState === 'default') setCanvasState('building')
    const latest = userMsgs[userMsgs.length - 1]
    const latestText = getMsgText(latest)
    const snippet = latestText.length > 22 ? latestText.slice(0, 22) + '\u2026' : latestText
    setKnownFacts(prev => [...new Set([...prev, snippet])].slice(0, 8))
  }, [messages]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialPrompt && !initSent.current) {
      initSent.current = true
      sendMessage({ text: initialPrompt })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  function submitMessage(text?: string) {
    const content = (text ?? chatInput).trim()
    if (!content || isLoading) return
    sendMessage({ text: content })
    setChatInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitMessage() }
  }

  const lastVisible = visibleMessages[visibleMessages.length - 1]
  const showThinking = isLoading && (!lastVisible || lastVisible.role === 'user')

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', fontFamily: 'var(--font-geist), system-ui, sans-serif', background: '#fff' }}>

      {/* ═══ NAV SIDEBAR ═══ */}
      <aside style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#fff', borderRight: '0.5px solid #ebebeb', padding: '16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, paddingLeft: 4 }}>
          <div style={{ width: 24, height: 24, background: '#0a0a0a', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>7</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#0a0a0a', letterSpacing: '-0.2px' }}>Agent7even</span>
        </div>
        <button style={{ width: '100%', background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontFamily: 'inherit' }}>
          <i className="ti ti-plus" style={{ fontSize: 14 }} />
          New campaign
        </button>
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = activeNav === item.id
            const inner = (
              <>
                <i className={`ti ${item.icon}`} style={{ fontSize: 15, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.id === 'agents' && pendingApprovalCount > 0 && (
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0a0a0a', flexShrink: 0 }} />
                )}
              </>
            )
            const sharedStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: isActive ? 500 : 400, color: isActive ? '#0a0a0a' : '#bbb', background: isActive ? '#f0f0f0' : 'transparent', width: '100%', textAlign: 'left', fontFamily: 'inherit', textDecoration: 'none' }
            if (item.href) {
              return (
                <a key={item.id} href={item.href} style={sharedStyle}
                  onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLAnchorElement).style.background = '#f5f5f5'; (e.currentTarget as HTMLAnchorElement).style.color = '#555' } }}
                  onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#bbb' } }}
                >
                  {inner}
                </a>
              )
            }
            return (
              <button key={item.id} onClick={() => setActiveNav(item.id)} style={sharedStyle}
                onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = '#f5f5f5'; (e.currentTarget as HTMLButtonElement).style.color = '#555' } }}
                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#bbb' } }}
              >
                {inner}
              </button>
            )
          })}
        </nav>
        <div style={{ borderTop: '0.5px solid #f0f0f0', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 10, fontWeight: 600 }}>{initials}</span>
          </div>
          <span style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
        </div>
      </aside>

      {/* ═══ CHAT PANEL ═══ */}
      <div style={{ flex: 55, minWidth: 480, maxWidth: 640, display: 'flex', flexDirection: 'column', background: '#fff', borderRight: '0.5px solid #ebebeb', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '0.5px solid #f0f0f0' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#0a0a0a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>
            {chatStarted && sessionTitle ? sessionTitle : 'Maya'}
          </span>
          <button onClick={() => setCanvasOpen(o => !o)} title={canvasOpen ? 'Collapse canvas' : 'Expand canvas'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#555' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#bbb' }}
          >
            <i className={`ti ${canvasOpen ? 'ti-layout-sidebar' : 'ti-layout-sidebar-right'}`} style={{ fontSize: 16 }} />
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {!chatStarted ? (
            /* GREETING */
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 48 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', border: '0.5px solid #e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontSize: 20, fontWeight: 600 }}>M</span>
                </div>
                <div style={{ position: 'absolute', bottom: 3, right: 3, width: 9, height: 9, borderRadius: '50%', background: '#0a0a0a', border: '1.5px solid #fff' }} />
              </div>
              <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#ccc', marginBottom: 12 }}>Maya · Your marketing strategist</p>
              <p style={{ fontSize: 20, fontWeight: 500, color: '#0a0a0a', marginBottom: 8, textAlign: 'center', letterSpacing: '-0.3px' }}>
                Hey {companyName !== 'there' ? companyName : 'there'}, good to see you.
              </p>
              <p style={{ fontSize: 14, color: '#888', textAlign: 'center', maxWidth: 320, lineHeight: 1.6, marginBottom: 28 }}>
                Ready to build something? Tell me what's on your mind — or pick a place to start.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%', maxWidth: 340 }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s.text} onClick={() => submitMessage(s.text)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 10, border: '0.5px solid #e8e8e8', background: '#fafafa', fontSize: 13, color: '#444', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'border-color 0.15s, background 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#0a0a0a'; (e.currentTarget as HTMLButtonElement).style.background = '#f5f5f5' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e8e8e8'; (e.currentTarget as HTMLButtonElement).style.background = '#fafafa' }}
                  >
                    <i className={`ti ${s.icon}`} style={{ fontSize: 14, color: '#bbb', flexShrink: 0 }} />
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* CHAT */
            <>
              {visibleMessages.map((msg) => {
                const text = getMsgText(msg)
                return (
                  <div key={msg.id} style={{ marginBottom: msg.role === 'user' ? 28 : 32 }}>
                    {msg.role === 'user' ? (
                      /* User bubble — dark, right aligned */
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ background: '#0a0a0a', color: '#fff', borderRadius: '18px 18px 4px 18px', padding: '10px 14px', maxWidth: '72%', fontSize: 14, lineHeight: 1.55 }}>
                          {text}
                        </div>
                      </div>
                    ) : (
                      /* Maya — plain text, no bubble */
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                          <span style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>M</span>
                        </div>
                        <div style={{ maxWidth: '85%', paddingTop: 4 }}>
                          <ReactMarkdown components={PLAIN_MD as never}>{text}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Thinking state */}
              {showThinking && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 28 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <span style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>M</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#bbb', fontStyle: 'italic', paddingTop: 7 }}>Maya is thinking...</p>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input bar */}
        <div style={{ flexShrink: 0, borderTop: '0.5px solid #f0f0f0', padding: '14px 20px', background: '#fff' }}>
          <div style={{ position: 'relative' }}>
            <textarea
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Maya anything..."
              rows={1}
              disabled={isLoading}
              style={{ width: '100%', border: '0.5px solid #e0e0e0', borderRadius: 24, padding: '11px 48px 11px 16px', fontSize: 14, background: '#fafafa', color: '#0a0a0a', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box', display: 'block', opacity: isLoading ? 0.6 : 1 }}
            />
            <button onClick={() => submitMessage()} disabled={isLoading}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: isLoading ? '#ccc' : '#0a0a0a', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isLoading ? 'not-allowed' : 'pointer' }}
            >
              <i className="ti ti-arrow-up" style={{ fontSize: 15, color: '#fff' }} />
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#ddd', textAlign: 'center', marginTop: 8 }}>
            Maya makes mistakes. Verify important decisions.
          </p>
        </div>
      </div>

      {/* ═══ WORKING CANVAS ═══ */}
      <div style={{ flex: canvasOpen ? 45 : 0, minWidth: canvasOpen ? 360 : 0, overflow: 'hidden', transition: 'flex 0.3s ease, min-width 0.3s ease', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>

        {/* DEFAULT: empty state */}
        {canvasState === 'default' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <i className="ti ti-layout-kanban" style={{ fontSize: 48, color: '#e0e0e0', marginBottom: 16 }} />
            <p style={{ fontSize: 14, color: '#ccc', marginBottom: 6 }}>Your working space</p>
            <p style={{ fontSize: 12, color: '#ddd', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
              References, samples, and your campaign will appear here as Maya builds.
            </p>
          </div>
        )}

        {/* BUILDING: what Maya knows + competitors */}
        {canvasState === 'building' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Known facts strip */}
            <div style={{ flexShrink: 0, borderBottom: '0.5px solid #f0f0f0', padding: '14px 20px', background: '#fafafa' }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#ccc', marginBottom: 8 }}>What Maya knows</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {knownFacts.map((fact, i) => (
                  <span key={fact} style={{ fontSize: 12, color: '#555', background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 20, padding: '4px 12px', lineHeight: 1.4, animation: 'fadeIn 0.4s ease', animationDelay: `${i * 0.05}s`, animationFillMode: 'both' }}>
                    {fact}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

              {/* Competitor cards — pre-populated from profile or static fallback */}
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#bbb', marginBottom: 12 }}>Competitors</p>

              {competitors.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {competitors.map((handle, i) => {
                    const clean = handle.replace(/^@/, '')
                    const abbrev = clean.slice(0, 2).toUpperCase()
                    return (
                      <div key={i} style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>{abbrev}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: '#0a0a0a', marginBottom: 2 }}>@{clean}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0a0a0a', animation: 'dotPulse 2s ease-in-out infinite', animationDelay: `${i * 0.3}s` }} />
                            <span style={{ fontSize: 11, color: '#bbb' }}>Watching...</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ background: '#fff', border: '0.5px dashed #e0e0e0', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
                  <p style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>+ Add competitors</p>
                  <p style={{ fontSize: 11, color: '#bbb', lineHeight: 1.5 }}>
                    I can suggest competitors based on your industry — just ask me.
                  </p>
                </div>
              )}

              {/* Agent running indicator */}
              {agentRunning && (
                <div style={{ background: '#0a0a0a', borderRadius: 10, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'dotPulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: '#fff', marginBottom: 2 }}>Campaign Builder is running...</p>
                    <p style={{ fontSize: 11, color: '#888' }}>Your 30-day plan will appear here when ready</p>
                  </div>
                </div>
              )}

              {/* Maya insight card */}
              <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#bbb' }}>Maya</span>
                </div>
                <p style={{ fontSize: 13, color: '#555', lineHeight: 1.65, fontStyle: 'italic' }}>
                  Social proof is outperforming product posts 3:1 in most niches right now. One real customer story beats ten product photos.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* PLAN: structured plan cards */}
        {canvasState === 'plan' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
            <p style={{ fontSize: 18, fontWeight: 500, color: '#0a0a0a', marginBottom: 4, letterSpacing: '-0.3px' }}>Your 30-day plan</p>
            <p style={{ fontSize: 12, color: '#aaa', marginBottom: 24 }}>
              {displayName} · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {planSections.map((section, i) => (
                <div key={i} style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 10, padding: 16 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#0a0a0a', marginBottom: section.body ? 8 : 0 }}>{section.title}</p>
                  {section.body && <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{section.body}</p>}
                </div>
              ))}
            </div>
            <button style={{ width: '100%', background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginTop: 20 }}>
              Save plan
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes dotPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
