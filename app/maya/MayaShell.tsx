'use client'

import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, UIMessage } from 'ai'
import { Rocket, PenLine, BarChart2, MessageCircle } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface CampaignPlan {
  title: string
  summary: string
  weeks: { week: number; theme: string; focus: string; tasks: { day: string; action: string; channel: string; time_required: string; priority: string }[] }[]
  quick_wins: string[]
  metrics_to_track: string[]
  budget_allocation: Record<string, string>
}

interface Profile {
  id?: string
  company_name?: string | null
  full_name?: string | null
  business_type?: string | null
  plan?: string | null
  website_url?: string | null
  instagram_handle?: string | null
  business_goals?: string[] | null
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
  pendingApprovalCount?: number
  initialPrompt?: string | null
  activeCampaignId?: string | null
  isEdit?: boolean
  priorOption?: string
  initialMessages?: unknown[]
  initialMode?: string | null
}

type CanvasState = 'default' | 'building' | 'plan' | 'task'

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

// Detects "Option N" / "Version N" / bold variants and splits into cards.
// Tries each pattern in order; returns on the first that yields 2+ matches.
function parseTaskOptions(text: string): { label: string; content: string }[] | null {
  const optionPatterns = [
    /Option\s+(\d+)[:\s*]+([\s\S]*?)(?=Option\s+\d+|Version\s+\d+|$)/gi,
    /Version\s+(\d+)[:\s*]+([\s\S]*?)(?=Option\s+\d+|Version\s+\d+|$)/gi,
    /\*\*Option\s+(\d+)\*\*[:\s]+([\s\S]*?)(?=\*\*Option|\*\*Version|$)/gi,
  ]

  for (const re of optionPatterns) {
    re.lastIndex = 0
    const matches: { label: string; content: string }[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const content = m[2]
        .replace(/^\*+\s*/gm, '')
        .replace(/^\s*[-–]\s*/gm, '')
        .trim()
      if (content) matches.push({ label: `Option ${m[1]}`, content })
    }
    if (matches.length >= 2) return matches
  }

  return null
}

// ── Static nav ─────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: 'ti-message-circle', label: 'Talk to Maya', id: 'maya', href: '/maya' },
  { icon: 'ti-layout-grid', label: 'My campaigns', id: 'campaigns', href: '/my-campaigns' },
  { icon: 'ti-calendar', label: 'Content calendar', id: 'calendar', href: null },
  { icon: 'ti-chart-bar', label: 'Results', id: 'results', href: null },
  { icon: 'ti-robot', label: 'Agents', id: 'agents', href: '/dashboard/agents' },
  { icon: 'ti-heart', label: 'Saved', id: 'saved', href: null },
  { icon: 'ti-sparkles', label: 'Brand kit', id: 'brand', href: null },
  { icon: 'ti-shopping-bag', label: 'Services', id: 'services', href: null },
]

const MODES = [
  { id: 'Build a campaign', label: 'Build a campaign', description: 'Create a 30-day marketing plan', Icon: Rocket },
  { id: 'Create content', label: 'Create content', description: 'Generate captions, emails, or ad copy', Icon: PenLine },
  { id: 'Analyze my marketing', label: 'Analyze my marketing', description: "Review what's working and what's not", Icon: BarChart2 },
  { id: 'Just talk to Maya', label: 'Just talk to Maya', description: 'Open conversation, no agenda', Icon: MessageCircle },
]

// ── ReactMarkdown plain components ─────────────────────────────────────────

const PLAIN_MD: Record<string, React.ComponentType<{ children?: React.ReactNode }>> = {
  p: ({ children }) => <p style={{ margin: '0 0 12px 0', fontSize: 14, lineHeight: 1.7, color: '#2D3748' }}>{children}</p>,
  strong: ({ children }) => <span style={{ fontWeight: 500, color: '#2D3748' }}>{children}</span>,
  em: ({ children }) => <span style={{ fontStyle: 'italic', color: '#444' }}>{children}</span>,
  ul: ({ children }) => <ul style={{ paddingLeft: 16, margin: '0 0 12px 0' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingLeft: 16, margin: '0 0 12px 0' }}>{children}</ol>,
  li: ({ children }) => <li style={{ marginBottom: 6, fontSize: 14, lineHeight: 1.65 }}>{children}</li>,
  h1: ({ children }) => <p style={{ fontSize: 14, fontWeight: 500, color: '#2D3748', margin: '0 0 8px 0' }}>{children}</p>,
  h2: ({ children }) => <p style={{ fontSize: 14, fontWeight: 500, color: '#2D3748', margin: '0 0 8px 0' }}>{children}</p>,
  h3: ({ children }) => <p style={{ fontSize: 13, fontWeight: 500, color: '#555', margin: '0 0 6px 0' }}>{children}</p>,
}

// ── Component ──────────────────────────────────────────────────────────────

export default function MayaShell({
  profile,
  pendingApprovalCount = 0,
  initialPrompt,
  activeCampaignId,
  isEdit = false,
  priorOption = '',
  initialMessages = [],
  initialMode = null,
}: Props) {
  // Restore session only when not in task or edit mode
  const shouldRestore = !isEdit && !initialPrompt
  const companyName = profile?.company_name ?? profile?.full_name ?? 'there'
  const businessType = profile?.business_type ?? ''
  const websiteUrl = profile?.website_url ?? ''
  const instagramHandle = profile?.instagram_handle ?? ''
  const idealCustomer = profile?.ideal_customer ?? ''
  const sellLocations = profile?.sell_locations ?? []
  const marketingBudget = profile?.marketing_budget ?? ''
  const competitors = profile?.competitors ?? []
  const topGoals = profile?.top_goals ?? []
  const marketingChallenge = profile?.marketing_challenge ?? ''
  const contentComfort = profile?.content_comfort ?? ''

  const router = useRouter()
  const [activeNav, setActiveNav] = useState('maya')
  const [canvasOpen, setCanvasOpen] = useState(true)
  const [canvasState, setCanvasState] = useState<CanvasState>('default')
  const [planSections, setPlanSections] = useState<{ title: string; body: string }[]>([])
  const [campaignPlan, setCampaignPlan] = useState<CampaignPlan | null>(null)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [planSaved, setPlanSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<string | null>(() => shouldRestore ? (initialMode ?? null) : null)
  const [taskOutput, setTaskOutput] = useState<string>('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
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
  const isTaskMode = useRef(!!(initialPrompt && !initialPrompt.startsWith('__')))
  const taskCanvasLocked = useRef(false)
  const activeCampaignIdRef = useRef<string | null>(activeCampaignId ?? null)
  const messagesRef = useRef<UIMessage[]>([])
  const modeRef = useRef<string | null>(shouldRestore ? (initialMode ?? null) : null)

  const initials = companyName && companyName !== 'there' ? companyName.slice(0, 2).toUpperCase() : 'ME'
  const displayName = companyName !== 'there' ? companyName : 'Your business'

  const taskTitle = (() => {
    if (!isTaskMode.current || !initialPrompt) return ''
    const t = initialPrompt.trim()
    return t.length > 60 ? t.slice(0, 60) + '…' : t
  })()

  const profileData = {
    companyName, businessType, idealCustomer, sellLocations,
    marketingBudget, topGoals, marketingChallenge, contentComfort,
    competitors, websiteUrl, instagramHandle,
  }

  const [chatInput, setChatInput] = useState('')

  const ORCHESTRATE_TRIGGER = "spinning up the campaign builder"

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback for non-secure contexts
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  function selectOption(optId: string, label: string, content: string) {
    setSelectedOptionId(optId)
    const preview = content.length > 40 ? content.slice(0, 40) + '…' : content
    submitMessage(`I like ${label} — "${preview}"`)
    const targetCampaignId = activeCampaignIdRef.current
    console.log('Saving task to campaign:', targetCampaignId)
    fetch('/api/maya/task-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: targetCampaignId,
        task: initialPrompt ?? '',
        selectedOption: content,
        messages,
      }),
    }).catch(err => console.error('[selectOption] task-complete failed:', err))
  }

  async function generateCampaign(currentMessages: UIMessage[]) {
    setPlanLoading(true)
    setCanvasState('plan')
    try {
      const simplified = currentMessages.map(m => ({
        role: m.role,
        content: m.parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map(p => p.text).join(''),
      }))
      const res = await fetch('/api/maya/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: simplified, profile: profileData }),
      })
      const data = await res.json()
      if (data.plan) {
        setCampaignPlan(data.plan)
        if (data.campaign?.id) {
          setCampaignId(data.campaign.id)
          activeCampaignIdRef.current = data.campaign.id
        }
      }
    } catch (err) {
      console.error('Campaign generation failed:', err)
    } finally {
      setPlanLoading(false)
    }
  }

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/maya/chat',
      body: { profile: profileData, isEdit, priorOption },
    }),
    messages: shouldRestore && initialMessages.length ? (initialMessages as UIMessage[]) : undefined,
    onFinish: async ({ message }: { message: UIMessage }) => {
      const text = message.parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map(p => p.text).join('')

      if (isPlanResponse(text)) {
        setPlanSections(extractPlanSections(text))
        setCanvasState('plan')
      }

      if (
        text.toLowerCase().includes(ORCHESTRATE_TRIGGER) &&
        canvasState !== 'plan' &&
        canvasState !== 'task' &&
        !campaignPlan
      ) {
        generateCampaign([...messages, message])
      }

      // Capture FIRST assistant response in task mode — then lock so subsequent replies don't overwrite
      if (isTaskMode.current && !taskCanvasLocked.current) {
        setTaskOutput(text)
        taskCanvasLocked.current = true
      }

      // Persist session (fire-and-forget) — skip for task/edit sessions
      if (!isEdit && !initialPrompt && profile?.id) {
        fetch('/api/maya/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: profile.id,
            messages: [...messagesRef.current, message],
            mode: modeRef.current,
          }),
        }).catch(err => console.error('[session] save failed:', err))
      }
    },
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  function getMsgText(msg: UIMessage) {
    return msg.parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map(p => p.text).join('')
  }

  const visibleMessages = messages.filter(msg => {
    const t = getMsgText(msg)
    return !t.startsWith('__SYSTEM_INIT__') && !t.startsWith('__MODE__') && !t.startsWith('__TASK__')
  })
  const hasInitMessage = messages.some(msg => getMsgText(msg).startsWith('__SYSTEM_INIT__'))
  const chatStarted = visibleMessages.length > 0 || hasInitMessage || mode !== null
  const showModePicker = mode === null && !chatStarted && !initialPrompt
  const sessionTitle = (() => {
    const first = visibleMessages.find(m => m.role === 'user')
    if (!first) return ''
    const text = getMsgText(first)
    return text.length > 40 ? text.slice(0, 40) + '…' : text
  })()

  useEffect(() => {
    const userMsgs = visibleMessages.filter(m => m.role === 'user')
    if (hasInitMessage && canvasState === 'default') setCanvasState('building')
    if (userMsgs.length === 0) return
    if (canvasState === 'default') setCanvasState('building')
    const latest = userMsgs[userMsgs.length - 1]
    const latestText = getMsgText(latest)
    const snippet = latestText.length > 22 ? latestText.slice(0, 22) + '…' : latestText
    setKnownFacts(prev => [...new Set([...prev, snippet])].slice(0, 8))
  }, [messages]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!initialPrompt || initSent.current) return
    initSent.current = true

    if (isEdit) {
      // Edit mode: inject a pre-written Maya message; don't trigger a model call yet
      const intro = `Looks like you want to revisit this one: **"${initialPrompt}"**${
        priorOption
          ? `\n\nLast time you went with:\n\n*"${priorOption.slice(0, 80)}..."*\n\nWhat felt off about it? Or do you want me to generate fresh options in a different direction?`
          : '\n\nWhat would you like to change or improve?'
      }`
      setMessages([{
        id: 'edit-intro',
        role: 'assistant',
        parts: [{ type: 'text', text: intro }],
        createdAt: new Date(),
      } as UIMessage])
      setCanvasState('task')
      return
    }

    // Normal task / system-init flow
    const content = initialPrompt.startsWith('__')
      ? initialPrompt
      : `__TASK__${initialPrompt}__`
    if (isTaskMode.current) setCanvasState('task')
    sendMessage({ text: content })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { modeRef.current = mode }, [mode])

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

  async function savePlan() {
    if (planSaved || saving) return
    setSaving(true)
    try {
      if (!campaignId) {
        const res = await fetch('/api/maya/campaign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, profile: profileData }),
        })
        const data = await res.json()
        if (data.campaign?.id) {
          setCampaignId(data.campaign.id)
          activeCampaignIdRef.current = data.campaign.id
        }
      }
    } catch (err) {
      console.error('savePlan failed:', err)
    } finally {
      setSaving(false)
      setPlanSaved(true)
      setTimeout(() => setPlanSaved(false), 2000)
    }
  }

  const lastVisible = visibleMessages[visibleMessages.length - 1]
  const showThinking = isLoading && (!lastVisible || lastVisible.role === 'user')

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', fontFamily: 'var(--font-geist), system-ui, sans-serif', background: '#fff' }}>

      {/* ═══ NAV SIDEBAR ═══ */}
      <aside style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#fff', borderRight: '0.5px solid #ebebeb', padding: '16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, paddingLeft: 4 }}>
          <div style={{ width: 24, height: 24, background: '#2D3748', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>7</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#2D3748', letterSpacing: '-0.2px' }}>Agent7even</span>
        </div>
        <button
          onClick={() => {
            setMode(null)
            setMessages([])
            setCampaignPlan(null)
            setCampaignId(null)
            setPlanSaved(false)
            setTaskOutput('')
            setSelectedOptionId(null)
            setCanvasState('default')
            initSent.current = false
            isTaskMode.current = false
            taskCanvasLocked.current = false
            activeCampaignIdRef.current = null
          }}
          style={{ width: '100%', background: '#2D3748', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontFamily: 'inherit' }}
        >
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
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2D3748', flexShrink: 0 }} />
                )}
              </>
            )
            const sharedStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: isActive ? 500 : 400, color: isActive ? '#2D3748' : '#9BA1AE', background: isActive ? '#F8FAFC' : 'transparent', width: '100%', textAlign: 'left', fontFamily: 'inherit', textDecoration: 'none' }
            if (item.href) {
              return (
                <a key={item.id} href={item.href} style={sharedStyle}
                  onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLAnchorElement).style.background = '#f5f5f5'; (e.currentTarget as HTMLAnchorElement).style.color = '#555' } }}
                  onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#9BA1AE' } }}
                >
                  {inner}
                </a>
              )
            }
            return (
              <button key={item.id} onClick={() => setActiveNav(item.id)} style={sharedStyle}
                onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = '#f5f5f5'; (e.currentTarget as HTMLButtonElement).style.color = '#555' } }}
                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#9BA1AE' } }}
              >
                {inner}
              </button>
            )
          })}
        </nav>
        <div style={{ borderTop: '0.5px solid #F8FAFC', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2D3748', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 10, fontWeight: 600 }}>{initials}</span>
          </div>
          <span style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
        </div>
      </aside>

      {/* ═══ CHAT PANEL ═══ */}
      <div style={{ flex: 55, minWidth: 480, maxWidth: 640, display: 'flex', flexDirection: 'column', background: '#fff', borderRight: '0.5px solid #ebebeb', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '0.5px solid #F8FAFC' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#2D3748', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>
            {chatStarted && sessionTitle ? sessionTitle : 'Maya'}
          </span>
          <button onClick={() => setCanvasOpen(o => !o)} title={canvasOpen ? 'Collapse canvas' : 'Expand canvas'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9BA1AE', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#555' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#9BA1AE' }}
          >
            <i className={`ti ${canvasOpen ? 'ti-layout-sidebar' : 'ti-layout-sidebar-right'}`} style={{ fontSize: 16 }} />
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {showModePicker ? (
            /* MODE PICKER */
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 32 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', border: '0.5px solid #e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#2D3748', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontSize: 17, fontWeight: 600 }}>M</span>
                </div>
                <div style={{ position: 'absolute', bottom: 2, right: 2, width: 8, height: 8, borderRadius: '50%', background: '#2D3748', border: '1.5px solid #fff' }} />
              </div>
              <p style={{ fontSize: 18, fontWeight: 500, color: '#2D3748', marginBottom: 4, letterSpacing: '-0.3px' }}>
                Hey {companyName !== 'there' ? companyName : 'there'}.
              </p>
              <p style={{ fontSize: 13, color: '#999', marginBottom: 24 }}>What would you like to work on?</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 380 }}>
                {MODES.map(({ id, label, description, Icon }) => (
                  <button key={id} onClick={() => selectMode(id)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: '14px 14px', borderRadius: 12, border: '0.5px solid #e8e8e8', background: '#fafafa', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2D3748'; (e.currentTarget as HTMLButtonElement).style.background = '#f5f5f5' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e8e8e8'; (e.currentTarget as HTMLButtonElement).style.background = '#fafafa' }}
                  >
                    <Icon size={16} color="#2D3748" strokeWidth={1.75} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#2D3748', marginBottom: 2 }}>{label}</p>
                      <p style={{ fontSize: 11.5, color: '#999', lineHeight: 1.4 }}>{description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : !chatStarted ? (
            /* GREETING */
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 48 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', border: '0.5px solid #e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#2D3748', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontSize: 20, fontWeight: 600 }}>M</span>
                </div>
                <div style={{ position: 'absolute', bottom: 3, right: 3, width: 9, height: 9, borderRadius: '50%', background: '#2D3748', border: '1.5px solid #fff' }} />
              </div>
              <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#ccc', marginBottom: 12 }}>Maya · Your marketing strategist</p>
              <p style={{ fontSize: 20, fontWeight: 500, color: '#2D3748', marginBottom: 8, textAlign: 'center', letterSpacing: '-0.3px' }}>
                Hey {companyName !== 'there' ? companyName : 'there'}, good to see you.
              </p>
              <p style={{ fontSize: 14, color: '#888', textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}>
                One moment while Maya gets ready...
              </p>
            </div>
          ) : (
            /* CHAT */
            <>
              {visibleMessages.map((msg) => {
                const text = getMsgText(msg)
                return (
                  <div key={msg.id} style={{ marginBottom: msg.role === 'user' ? 28 : 32 }}>
                    {msg.role === 'user' ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ background: '#2D3748', color: '#fff', borderRadius: '18px 18px 4px 18px', padding: '10px 14px', maxWidth: '72%', fontSize: 14, lineHeight: 1.55 }}>
                          {text}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2D3748', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
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

              {showThinking && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 28 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2D3748', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <span style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>M</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#9BA1AE', fontStyle: 'italic', paddingTop: 7 }}>Maya is thinking...</p>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input bar — hidden during mode picker */}
        <div style={{ flexShrink: 0, borderTop: '0.5px solid #F8FAFC', padding: '14px 20px', background: '#fff', display: showModePicker ? 'none' : undefined }}>
          <div style={{ position: 'relative' }}>
            <textarea
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Maya anything..."
              rows={1}
              disabled={isLoading}
              style={{ width: '100%', border: '0.5px solid #e0e0e0', borderRadius: 24, padding: '11px 48px 11px 16px', fontSize: 14, background: '#fafafa', color: '#2D3748', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box', display: 'block', opacity: isLoading ? 0.6 : 1 }}
            />
            <button onClick={() => submitMessage()} disabled={isLoading}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: isLoading ? '#ccc' : '#2D3748', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isLoading ? 'not-allowed' : 'pointer' }}
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

        {/* DEFAULT */}
        {canvasState === 'default' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <i className="ti ti-layout-kanban" style={{ fontSize: 48, color: '#e0e0e0', marginBottom: 16 }} />
            <p style={{ fontSize: 14, color: '#ccc', marginBottom: 6 }}>Your working space</p>
            <p style={{ fontSize: 12, color: '#ddd', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
              References, samples, and your campaign will appear here as Maya builds.
            </p>
          </div>
        )}

        {/* BUILDING */}
        {canvasState === 'building' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flexShrink: 0, borderBottom: '0.5px solid #F8FAFC', padding: '14px 20px', background: '#fafafa' }}>
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
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#9BA1AE', marginBottom: 12 }}>Competitors</p>
              {competitors.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {competitors.map((handle, i) => {
                    const clean = handle.replace(/^@/, '')
                    const abbrev = clean.slice(0, 2).toUpperCase()
                    return (
                      <div key={i} style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2D3748', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>{abbrev}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: '#2D3748', marginBottom: 2 }}>@{clean}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2D3748', animation: 'dotPulse 2s ease-in-out infinite', animationDelay: `${i * 0.3}s` }} />
                            <span style={{ fontSize: 11, color: '#9BA1AE' }}>Watching...</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ background: '#fff', border: '0.5px dashed #e0e0e0', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
                  <p style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>+ Add competitors</p>
                  <p style={{ fontSize: 11, color: '#9BA1AE', lineHeight: 1.5 }}>I can suggest competitors based on your industry — just ask me.</p>
                </div>
              )}
              {planLoading && (
                <div style={{ background: '#2D3748', borderRadius: 10, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'dotPulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: '#fff', marginBottom: 2 }}>Campaign Builder is running...</p>
                    <p style={{ fontSize: 11, color: '#888' }}>Your 30-day plan will appear here when ready</p>
                  </div>
                </div>
              )}
              <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#9BA1AE' }}>Maya</span>
                </div>
                <p style={{ fontSize: 13, color: '#555', lineHeight: 1.65, fontStyle: 'italic' }}>
                  Social proof is outperforming product posts 3:1 in most niches right now. One real customer story beats ten product photos.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TASK: deliverable canvas */}
        {canvasState === 'task' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ flexShrink: 0, borderBottom: '0.5px solid #F8FAFC', padding: '16px 20px', background: '#fafafa' }}>
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#3B82F6', marginBottom: 6 }}>Task</p>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#2D3748', lineHeight: 1.4 }}>{taskTitle}</p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {isLoading && !taskOutput ? (
                /* Loading */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 48 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#ccc', animation: 'dotPulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <p style={{ fontSize: 13, color: '#aaa' }}>Maya is working on this...</p>
                </div>
              ) : taskOutput ? (
                (() => {
                  const options = parseTaskOptions(taskOutput)
                  if (options && options.length >= 2) {
                    // Multi-option cards — strictly EITHER cards OR single doc, never both
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {options.map((opt, i) => {
                          const optId = `opt-${i}`
                          const isSelected = selectedOptionId === optId
                          return (
                            <div key={i} style={{ background: '#fff', border: isSelected ? '1.5px solid #0a0a0a' : '0.5px solid #ebebeb', borderRadius: 10, padding: '14px 16px', transition: 'border 0.15s' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                {/* Label — uppercase via CSS, content body is NOT uppercased */}
                                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#999', margin: 0 }}>{opt.label}</p>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                  <button
                                    onClick={() => copyToClipboard(opt.content, optId)}
                                    style={{ fontSize: 11, color: copiedId === optId ? '#16a34a' : '#9BA1AE', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontWeight: 500 }}
                                  >
                                    {copiedId === optId ? 'Copied ✓' : 'Copy'}
                                  </button>
                                  <button
                                    onClick={() => selectOption(optId, opt.label, opt.content)}
                                    style={{ fontSize: 11, color: isSelected ? '#fff' : '#555', background: isSelected ? '#2D3748' : 'none', border: '0.5px solid ' + (isSelected ? '#2D3748' : '#ccc'), borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                                  >
                                    {isSelected ? '✓ Selected' : '✓ Select'}
                                  </button>
                                </div>
                              </div>
                              {/* Content — normal casing, whiteSpace preserves line breaks */}
                              <p style={{ fontSize: 13, color: '#333', lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: 0 }}>{opt.content}</p>
                            </div>
                          )
                        })}
                        <p style={{ fontSize: 11, color: '#9BA1AE', textAlign: 'center', paddingTop: 4 }}>
                          Reply in the chat to refine any option
                        </p>
                      </div>
                    )
                  }
                  // Single document view
                  const clean = taskOutput.replace(/^\*+\s*/gm, '').replace(/#{1,3}\s*/g, '').trim()
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 10, padding: '16px 18px' }}>
                        <p style={{ fontSize: 13, color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{clean}</p>
                      </div>
                      <p style={{ fontSize: 11, color: '#9BA1AE', textAlign: 'center' }}>
                        Reply in the chat to refine any option
                      </p>
                    </div>
                  )
                })()
              ) : null}
            </div>
          </div>
        )}

        {/* PLAN: loading + structured plan */}
        {canvasState === 'plan' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {planLoading && (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#aaa', marginBottom: 16 }}>Maya is building your plan...</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#ccc', animation: 'dotPulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}

            {campaignPlan && !planLoading && (
              <div style={{ padding: '28px 28px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <p style={{ fontSize: 17, fontWeight: 600, color: '#2D3748', letterSpacing: '-0.3px', marginBottom: 6 }}>{campaignPlan.title}</p>
                  <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6 }}>{campaignPlan.summary}</p>
                </div>

                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#9BA1AE', marginBottom: 10 }}>Do this today</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {campaignPlan.quick_wins?.map((win, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                          <span style={{ color: '#3B82F6', flexShrink: 0, marginTop: 1, fontSize: 13 }}>→</span>
                          <p style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>{win}</p>
                        </div>
                        <a
                          href={`/maya?task=${encodeURIComponent(win)}${campaignId ? `&campaignId=${campaignId}` : ''}`}
                          style={{ flexShrink: 0, fontSize: 11, color: '#3B82F6', fontWeight: 500, whiteSpace: 'nowrap', textDecoration: 'none', paddingTop: 2, marginLeft: 8 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none' }}
                        >
                          Do this with Maya →
                        </a>
                      </div>
                    ))}
                  </div>
                </div>

                {campaignPlan.weeks?.map(week => (
                  <div key={week.week}>
                    <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#9BA1AE', marginBottom: 10 }}>
                      Week {week.week} — {week.theme}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {week.tasks?.slice(0, 3).map((task, i) => (
                        <div key={i} style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 11, fontWeight: 500, color: '#555' }}>{task.day} · {task.channel}</span>
                            <span style={{ fontSize: 10, color: '#9BA1AE' }}>{task.time_required}</span>
                          </div>
                          <p style={{ fontSize: 12.5, color: '#333', lineHeight: 1.5 }}>{task.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#9BA1AE', marginBottom: 10 }}>Track these</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {campaignPlan.metrics_to_track?.map((metric, i) => (
                      <span key={i} style={{ fontSize: 11, background: '#fff', border: '0.5px solid #e0e0e0', color: '#555', borderRadius: 20, padding: '4px 10px' }}>
                        {metric}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={savePlan}
                  style={{ width: '100%', background: planSaved ? '#16a34a' : '#2D3748', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0', fontSize: 13, fontWeight: 600, cursor: (planSaved || saving) ? 'default' : 'pointer', fontFamily: 'inherit', marginTop: 4, transition: 'background 0.2s', opacity: saving ? 0.7 : 1 }}
                >
                  {planSaved ? 'Plan saved ✓' : saving ? 'Saving...' : 'Save plan'}
                </button>
              </div>
            )}

            {!campaignPlan && !planLoading && planSections.length > 0 && (
              <div style={{ padding: '28px 28px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 17, fontWeight: 600, color: '#2D3748', marginBottom: 8 }}>Your 30-day plan</p>
                {planSections.map((section, i) => (
                  <div key={i} style={{ background: '#fff', border: '0.5px solid #ebebeb', borderRadius: 10, padding: 16 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: '#2D3748', marginBottom: section.body ? 8 : 0 }}>{section.title}</p>
                    {section.body && <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{section.body}</p>}
                  </div>
                ))}
              </div>
            )}
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
