'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import {
  LayoutDashboard,
  Bot,
  ShoppingBag,
  Calendar,
  BookOpen,
  BarChart2,
  FileText,
  Headphones,
  Bell,
  Users,
  CreditCard,
  Settings,
  Menu,
  X,
  Sparkles,
  Layers,
  TrendingUp,
  Inbox,
  Shield,
  Megaphone,
  PenLine,
  Plus,
  HelpCircle,
  MessageCircle,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import NotificationBell from '@/components/NotificationBell'
import MayChatPanel, { type Profile } from '@/components/maya/MayChatPanel'
import NewCampaignModal from '@/components/campaigns/NewCampaignModal'

// ── Types ─────────────────────────────────────────────────────────────────

interface Notification {
  id: string
  title: string
  body: string
  type: string
  link: string | null
  read: boolean
  created_at: string
}

interface Session {
  id: string
  title: string | null
  canvas_context: string | null
  updated_at: string
}

interface Props {
  children: React.ReactNode
  profile?: Profile | null
  profileId: string
  initialNotifications: Notification[]
  initialSessions?: Session[]
  foundationScore?: number | null
  brandKitCompleted?: number
  pendingApprovalsCount?: number
  activeOrdersCount?: number
  role?: string | null
  isAdmin?: boolean
}

// ── Nav ───────────────────────────────────────────────────────────────────

const NAV = [
  {
    section: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Your workspace',
    items: [
      { href: '/dashboard/agents',       label: 'Agents',           icon: Bot       },
      { href: '/dashboard/campaigns',    label: 'Campaigns',        icon: Megaphone },
      { href: '/dashboard/services',     label: 'Services',         icon: ShoppingBag },
      { href: '/dashboard/calendar',     label: 'Content Calendar', icon: Calendar  },
      { href: '/dashboard/posts',        label: 'Posts',            icon: PenLine   },
      { href: '/dashboard/foundation',   label: 'Foundation',       icon: Layers    },
      { href: '/dashboard/brand-kit',    label: 'Brand Kit',        icon: BookOpen  },
      { href: '/dashboard/analytics',    label: 'Analytics',        icon: BarChart2 },
      { href: '/dashboard/inbox',        label: 'Inbox',            icon: MessageCircle },
      { href: '/dashboard/deliverables', label: 'Deliverables',     icon: FileText  },
    ],
  },
  {
    section: 'Account',
    items: [
      { href: '/dashboard/support',       label: 'Support',       icon: Headphones },
      { href: '/dashboard/notifications', label: 'Notifications', icon: Bell       },
      { href: '/dashboard/team',          label: 'Team',          icon: Users      },
      { href: '/dashboard/billing',       label: 'Billing',       icon: CreditCard },
      { href: '/dashboard/settings',      label: 'Settings',      icon: Settings   },
    ],
  },
]

// ── Contextual page actions ────────────────────────────────────────────────

const PAGE_ACTIONS: Record<string, { label: string; action: string }[]> = {
  dashboard:   [
    { label: 'Refresh digest',      action: 'refresh-digest' },
    { label: 'Customize dashboard', action: 'customize' },
  ],
  campaigns:   [
    { label: 'Sort by newest', action: 'sort-newest' },
    { label: 'Sort by oldest', action: 'sort-oldest' },
    { label: 'Archive all',    action: 'archive-all' },
  ],
  'brand-kit': [
    { label: 'Export brand guide', action: 'export' },
    { label: 'Share with team',    action: 'share' },
  ],
  foundation:  [
    { label: 'Export Foundation', action: 'export' },
    { label: 'Reset Foundation',  action: 'reset' },
  ],
  agents:      [
    { label: 'Pause all agents', action: 'pause-all' },
    { label: 'View run history', action: 'history' },
  ],
  analytics:   [
    { label: 'Export report', action: 'export' },
    { label: 'Refresh data',  action: 'refresh' },
  ],
  inbox:       [
    { label: 'Refresh inbox', action: 'refresh' },
  ],
}

function ContextMenu({ pageName }: { pageName: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const actions = PAGE_ACTIONS[pageName] ?? []

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (!actions.length) return null

  function handleAction(action: string) {
    setOpen(false)
    window.dispatchEvent(new CustomEvent('page-action', { detail: { action } }))
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '6px', borderRadius: 8, background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center',
          transition: 'color 0.12s, background 0.12s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-hover)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)'; (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 4,
          background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: '4px 0',
          minWidth: 160, zIndex: 50,
        }}>
          {actions.map(a => (
            <button
              key={a.action}
              onClick={() => handleAction(a.action)}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 16px',
                fontSize: 13.5, color: 'var(--color-text-primary)', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.1s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function groupSessionsByDate(sessions: Session[]): { label: string; sessions: Session[] }[] {
  const todayStart     = new Date(); todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000)

  const buckets: Record<string, Session[]> = {}

  sessions.forEach(s => {
    const d = new Date(s.updated_at); d.setHours(0, 0, 0, 0)
    let label: string
    if (d.getTime() === todayStart.getTime())          label = 'Today'
    else if (d.getTime() === yesterdayStart.getTime()) label = 'Yesterday'
    else label = new Date(s.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (!buckets[label]) buckets[label] = []
    buckets[label].push(s)
  })

  const order = ['Today', 'Yesterday', ...Object.keys(buckets).filter(k => k !== 'Today' && k !== 'Yesterday')]
  return order.filter(l => buckets[l]).map(label => ({ label, sessions: buckets[label] }))
}

// ── Component ─────────────────────────────────────────────────────────────

export default function DashboardShell({
  children,
  profile,
  profileId,
  initialNotifications,
  initialSessions = [],
  foundationScore: initialFoundationScore = null,
  brandKitCompleted: initialBrandKitCompleted = 0,
  pendingApprovalsCount: initialPendingApprovalsCount = 0,
  activeOrdersCount: initialActiveOrdersCount = 0,
  role = null,
  isAdmin: isAdminProp = false,
}: Props) {
  const pathname     = usePathname()
  const [mayaOpen, setMayaOpen]       = useState(false)
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })
  const [foundationScore, setFoundationScore] = useState<number | null>(initialFoundationScore ?? null)
  const [brandKitCompleted, setBrandKitCompleted] = useState(initialBrandKitCompleted)
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(initialPendingApprovalsCount)
  const [activeOrdersCount, setActiveOrdersCount] = useState(initialActiveOrdersCount)
  const [showNewCampaign, setShowNewCampaign] = useState(false)
  const [helpMode, setHelpMode] = useState(false)
  const [mayaPendingTask, setMayaPendingTask] = useState<string | null>(null)
  const [panelKey, setPanelKey]       = useState(0)
  const [canvasData, setCanvasData]   = useState<string>('')
  const [sessions, setSessions]       = useState<Session[]>(initialSessions)
  const [activeSessionId, setActiveSessionId]   = useState<string | null>(null)
  const [activeMessages, setActiveMessages]     = useState<unknown[]>([])
  const [activeMode, setActiveMode]             = useState<string | null>(null)
  const [loadingSession, setLoadingSession]     = useState<string | null>(null)
  const [deletingSession, setDeletingSession]   = useState<string | null>(null)
  const [hoveredSession, setHoveredSession]     = useState<string | null>(null)

  function toggleSidebar() {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  const isAdmin = isAdminProp || role === 'admin' || role === 'owner'

  useEffect(() => {
    function onRescored(e: Event) {
      setFoundationScore((e as CustomEvent<{ score: number }>).detail.score)
    }
    window.addEventListener('foundation:rescored', onRescored)
    return () => window.removeEventListener('foundation:rescored', onRescored)
  }, [])

  useEffect(() => {
    function onBrandKitProgress(e: Event) {
      setBrandKitCompleted((e as CustomEvent<{ completed: number }>).detail.completed)
    }
    window.addEventListener('brandkit:progress', onBrandKitProgress)
    return () => window.removeEventListener('brandkit:progress', onBrandKitProgress)
  }, [])

  useEffect(() => {
    function onCanvasContext(e: Event) {
      setCanvasData((e as CustomEvent<{ context: string }>).detail.context)
    }
    window.addEventListener('maya:canvas-context', onCanvasContext)
    return () => window.removeEventListener('maya:canvas-context', onCanvasContext)
  }, [])

  useEffect(() => { setCanvasData('') }, [pathname])

  useEffect(() => {
    if (!profileId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`profile_foundation:${profileId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${profileId}`,
      }, (payload) => {
        const updated = payload.new as { foundation_score?: number | null }
        if (updated.foundation_score !== undefined) {
          setFoundationScore(updated.foundation_score ?? null)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profileId])

  useEffect(() => {
    if (!isAdmin || !profileId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`admin-orders:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const order = payload.new as { status?: string }
          if (!['approved', 'cancelled', 'completed'].includes(order.status ?? 'submitted')) {
            setActiveOrdersCount(prev => prev + 1)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isAdmin, profileId])

  useEffect(() => {
    function onOpenTask(e: Event) {
      const { task } = (e as CustomEvent<{ task: string }>).detail
      setMayaOpen(true)
      setMayaPendingTask(task)
      setActiveSessionId(null)
      setActiveMessages([])
      setActiveMode(null)
      setPanelKey(k => k + 1)
    }
    window.addEventListener('maya:open-task', onOpenTask)
    return () => window.removeEventListener('maya:open-task', onOpenTask)
  }, [])

  const canvasContext = NAV.flatMap(g => g.items).find(i => pathname.startsWith(i.href) && i.href !== '/dashboard')?.label
    ?? (pathname === '/dashboard' ? 'Dashboard' : undefined)

  // Derive current page key for context menu
  const currentPageKey = pathname.startsWith('/dashboard/brand-kit') ? 'brand-kit'
    : pathname.startsWith('/dashboard/agents') ? 'agents'
    : pathname.startsWith('/dashboard/campaigns') ? 'campaigns'
    : pathname.startsWith('/dashboard/analytics') ? 'analytics'
    : pathname.startsWith('/dashboard/inbox') ? 'inbox'
    : pathname.startsWith('/dashboard/foundation') ? 'foundation'
    : pathname === '/dashboard' ? 'dashboard'
    : ''

  function openHelpMode() {
    setHelpMode(true)
    setMayaOpen(true)
    setMobileOpen(false)
    setActiveSessionId(null)
    setActiveMessages([])
    setActiveMode(null)
    setMayaPendingTask(null)
    setPanelKey(k => k + 1)
  }

  async function openNewConversation() {
    if (mayaOpen && activeSessionId === null && activeMessages.length === 0 && !helpMode) {
      setMayaOpen(false)
      setHelpMode(false)
      return
    }
    setHelpMode(false)
    setMayaOpen(true)
    setMobileOpen(false)
    setActiveSessionId(null)
    setActiveMessages([])
    setActiveMode(null)
    setMayaPendingTask(null)
    setPanelKey(k => k + 1)
  }

  async function loadSession(sessionId: string) {
    setLoadingSession(sessionId)
    try {
      const res = await fetch(`/api/maya/session?id=${sessionId}`)
      const { session } = await res.json()
      setActiveMessages(session?.messages ?? [])
      setActiveMode(session?.mode ?? null)
      setActiveSessionId(sessionId)
      setMayaOpen(true)
      setMobileOpen(false)
      setMayaPendingTask(null)
      setPanelKey(k => k + 1)
    } finally {
      setLoadingSession(null)
    }
  }

  async function deleteSession(session: Session) {
    const title = session.title ?? 'Untitled'
    if (!window.confirm(`Delete "${title}"? This removes the chat from your history.`)) return

    setDeletingSession(session.id)
    try {
      const res = await fetch(`/api/maya/session?id=${session.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete session')
      setSessions(prev => prev.filter(s => s.id !== session.id))

      if (session.id === activeSessionId) {
        setActiveSessionId(null)
        setActiveMessages([])
        setActiveMode(null)
        setMayaPendingTask(null)
        setPanelKey(k => k + 1)
      }
    } catch {
      window.alert('Could not delete that chat. Try again.')
    } finally {
      setDeletingSession(null)
    }
  }

  function handleSessionCreated(id: string, title: string) {
    setActiveSessionId(id)
    setSessions(prev => {
      const exists = prev.some(s => s.id === id)
      if (exists) return prev
      return [{ id, title, canvas_context: canvasContext ?? null, updated_at: new Date().toISOString() }, ...prev]
    })
  }

  const sessionGroups = groupSessionsByDate(sessions)

  // ── Foundation bar color ──────────────────────────────────────────────────
  function foundationBarColor(score: number): string {
    if (score >= 71) return 'var(--color-status-success)'
    if (score >= 50) return 'var(--color-status-warning)'
    return 'var(--color-status-danger)'
  }

  // ── Nav item ──────────────────────────────────────────────────────────────
  function NavLink({ item }: { item: typeof NAV[0]['items'][0] }) {
    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
    const Icon = item.icon
    const isFoundation = item.href === '/dashboard/foundation'
    const isBrandKit   = item.href === '/dashboard/brand-kit'
    const isAgents     = item.href === '/dashboard/agents'
    const isAdminOrders = item.href === '/admin/orders'
    const brandKitPct  = Math.round((brandKitCompleted / 6) * 100)
    const approvalsActive = pathname.startsWith('/dashboard/agents/approvals')

    if (sidebarCollapsed) {
      return (
        <>
          <Link
            href={item.href}
            onClick={() => setMobileOpen(false)}
            title={item.label}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '10px 0', margin: '1px 4px', borderRadius: 8,
              textDecoration: 'none', color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              background: active ? 'var(--color-surface-2)' : 'transparent',
              transition: 'background 0.12s, color 0.12s', position: 'relative',
            }}
            onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--color-surface-2)'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-primary)' } }}
            onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-secondary)' } }}
          >
            <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={16} strokeWidth={active ? 2 : 1.75} color={active ? 'var(--color-text-primary)' : 'currentColor'} />
              {isAdminOrders && activeOrdersCount > 0 && (
                <span style={{ position: 'absolute', top: -2, right: -5, width: 7, height: 7, borderRadius: '50%', background: 'var(--color-status-success)', border: '1px solid var(--color-surface)' }} />
              )}
            </span>
            {isAgents && pendingApprovalsCount > 0 && (
              <span style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: '50%', background: 'var(--color-brand-primary)' }} />
            )}
            {isFoundation && foundationScore !== null && (
              <span style={{
                position: 'absolute', bottom: 5, right: 6, width: 6, height: 6, borderRadius: '50%',
                background: foundationBarColor(foundationScore),
              }} />
            )}
          </Link>
        </>
      )
    }

    return (
      <>
        <Link
          href={item.href}
          onClick={() => setMobileOpen(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
            borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: active ? 500 : 400,
            color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            background: active ? 'var(--color-surface-2)' : 'transparent',
            border: active ? '1px solid var(--color-border)' : '1px solid transparent',
            transition: 'background 0.12s, color 0.12s, border-color 0.12s',
            marginBottom: 1,
          }}
          onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--color-surface-hover)'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-primary)' } }}
          onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-secondary)' } }}
        >
          <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {isAdminOrders && activeOrdersCount > 0 && (
              <span style={{ position: 'absolute', left: -8, width: 6, height: 6, borderRadius: '50%', background: 'var(--color-status-success)' }} />
            )}
            <Icon size={14} strokeWidth={active ? 2 : 1.75} color={active ? 'var(--color-text-primary)' : 'var(--color-menu-muted)'} />
          </span>
          {item.label}
          {isFoundation && foundationScore !== null && (
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 28, height: 3, background: 'var(--color-border)', borderRadius: 2, display: 'block', overflow: 'hidden' }}>
                <span style={{ display: 'block', width: `${foundationScore}%`, height: '100%', background: foundationBarColor(foundationScore), borderRadius: 2, transition: 'width 0.4s' }} />
              </span>
              <span style={{ fontSize: 9.5, color: foundationBarColor(foundationScore) }}>{foundationScore}%</span>
            </span>
          )}
          {isBrandKit && brandKitCompleted > 0 && (
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 28, height: 3, background: 'var(--color-border)', borderRadius: 2, display: 'block', overflow: 'hidden' }}>
                <span style={{ display: 'block', width: `${brandKitPct}%`, height: '100%', background: brandKitCompleted === 6 ? 'var(--color-status-success)' : 'var(--color-brand-primary)', borderRadius: 2, transition: 'width 0.4s' }} />
              </span>
              <span style={{ fontSize: 9.5, color: brandKitCompleted === 6 ? 'var(--color-status-success)' : 'var(--color-brand-primary)' }}>{brandKitPct}%</span>
            </span>
          )}
          {isAgents && pendingApprovalsCount > 0 && (
            <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9, background: 'var(--color-brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
              <span style={{ color: 'var(--color-text-inverse)', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>{pendingApprovalsCount}</span>
            </span>
          )}
          {isAdminOrders && activeOrdersCount > 0 && (
            <span style={{ marginLeft: 'auto', minWidth: 34, height: 24, borderRadius: 8, border: '1px solid var(--color-border)', background: active ? 'var(--color-surface-2)' : 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px' }}>
              <span style={{ color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 500, lineHeight: 1 }}>{activeOrdersCount}</span>
            </span>
          )}
        </Link>
        {isAgents && pendingApprovalsCount > 0 && (
          <Link
            href="/dashboard/agents/approvals"
            onClick={() => setMobileOpen(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px 5px 32px',
              borderRadius: 7, textDecoration: 'none', fontSize: 13, fontWeight: approvalsActive ? 500 : 400,
              color: approvalsActive ? 'var(--color-brand-primary)' : 'var(--color-menu-muted)',
              background: approvalsActive ? 'color-mix(in srgb, var(--color-brand-primary) 8%, var(--color-surface))' : 'transparent',
              transition: 'background 0.12s, color 0.12s', marginBottom: 1,
            }}
            onMouseEnter={e => { if (!approvalsActive) { (e.currentTarget as HTMLAnchorElement).style.background = 'color-mix(in srgb, var(--color-brand-primary) 8%, var(--color-surface))'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-brand-primary)' } }}
            onMouseLeave={e => { if (!approvalsActive) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-menu-muted)' } }}
          >
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-brand-primary)', flexShrink: 0 }} />
            Approvals
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-brand-primary)', fontWeight: 600 }}>{pendingApprovalsCount}</span>
          </Link>
        )}
      </>
    )
  }

  // ── Sidebar ───────────────────────────────────────────────────────────────

  const sidebar = (
    <aside style={{
      width: sidebarCollapsed ? 56 : 220,
      flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)',
      height: '100%', overflow: 'hidden',
      transition: 'width 0.2s ease',
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: sidebarCollapsed ? 'center' : 'space-between',
        padding: sidebarCollapsed ? '16px 0' : '16px 14px 12px',
        borderBottom: '1px solid var(--color-border)',
      }}>
        {sidebarCollapsed ? (
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            <span style={{ color: 'var(--color-brand-accent)' }}>7</span>
          </span>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--color-text-primary)' }}>
            AGENT<span style={{ color: 'var(--color-brand-accent)' }}>7</span>EVEN
          </span>
        )}
        {!sidebarCollapsed && (
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 2, display: 'flex' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Maya + New campaign buttons — expanded only */}
      {!sidebarCollapsed && (
      <div style={{ padding: '10px 10px 6px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <button
          onClick={openNewConversation}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px',
            borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
            fontWeight: 500, color: mayaOpen ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
            background: mayaOpen ? 'var(--color-brand-secondary)' : 'var(--color-surface-2)',
            border: mayaOpen ? 'none' : '1px solid var(--color-border)',
            transition: 'background 0.12s, color 0.12s',
          } as React.CSSProperties}
          onMouseEnter={e => { if (!mayaOpen) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-2)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border-strong)' } }}
          onMouseLeave={e => { if (!mayaOpen) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-2)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)' } }}
        >
          <Sparkles size={13} strokeWidth={1.75} color={mayaOpen ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)'} />
          Maya
          {mayaOpen && activeSessionId === null && (
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 400 }}>new</span>
          )}
        </button>

        {/* Session history — visible while Maya panel is open */}
        {mayaOpen && sessionGroups.length > 0 && (
          <div style={{ marginTop: 2, marginLeft: 2, marginBottom: 2 }}>
            {sessionGroups.map(group => (
              <div key={group.label} style={{ marginBottom: 6 }}>
                <p style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-menu-muted)', padding: '0 4px', marginBottom: 2 }}>
                  {group.label}
                </p>
                {group.sessions.map(session => {
                  const isActive  = session.id === activeSessionId
                  const isLoading = session.id === loadingSession
                  const isDeleting = session.id === deletingSession
                  const showDelete = hoveredSession === session.id || isDeleting
                  return (
                    <div
                      key={session.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 3, borderRadius: 6,
                        background: isActive ? 'var(--color-surface-2)' : 'transparent',
                        opacity: isLoading || isDeleting ? 0.5 : 1,
                        marginBottom: 1,
                      }}
                      onMouseEnter={e => {
                        setHoveredSession(session.id)
                        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-2)'
                      }}
                      onMouseLeave={e => {
                        setHoveredSession(prev => prev === session.id ? null : prev)
                        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                      }}
                    >
                      <button
                        onClick={() => loadSession(session.id)}
                        disabled={isDeleting}
                        style={{
                          minWidth: 0, flex: 1, display: 'block', textAlign: 'left', padding: '4px 2px 4px 10px',
                          borderRadius: 6, border: 'none', cursor: isDeleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                          fontSize: 11.5, color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                          background: 'transparent',
                          transition: 'color 0.1s',
                          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                        }}
                        title={session.title ?? 'Untitled'}
                      >
                        <span style={{ color: 'var(--color-border-strong)', marginRight: 5, fontSize: 10 }}>›</span>
                        {session.canvas_context && (
                          <span style={{ fontSize: 9.5, color: 'var(--color-brand-primary)', marginRight: 4, fontWeight: 500 }}>
                            {session.canvas_context} ·{' '}
                          </span>
                        )}
                        {session.title ?? 'Untitled'}
                      </button>
                      <button
                        onClick={() => deleteSession(session)}
                        disabled={isDeleting}
                        title="Delete chat"
                        style={{
                          width: 22, height: 22, borderRadius: 6, border: 'none',
                          background: 'transparent', color: 'var(--color-border-strong)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: isDeleting ? 'not-allowed' : 'pointer', flexShrink: 0,
                          opacity: showDelete ? 1 : 0,
                          pointerEvents: showDelete ? 'auto' : 'none',
                          transition: 'opacity 0.12s, color 0.12s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-status-danger)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-border-strong)' }}
                      >
                        <Trash2 size={11} strokeWidth={1.8} />
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowNewCampaign(true)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px',
            borderRadius: 9, border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', background: 'var(--color-surface-2)',
            transition: 'background 0.12s, border-color 0.12s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-2)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border-strong)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-2)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)' }}
        >
          <Plus size={13} strokeWidth={1.75} color="var(--color-text-secondary)" />
          New campaign
        </button>
      </div>
      )}

      {/* Collapsed: icon-only Maya + New Campaign */}
      {sidebarCollapsed && (
        <div style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button
            onClick={openNewConversation}
            title="Maya"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '10px 0', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              background: mayaOpen ? 'var(--color-brand-secondary)' : 'transparent', border: 'none',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => { if (!mayaOpen) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-2)' }}
            onMouseLeave={e => { if (!mayaOpen) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <Sparkles size={16} strokeWidth={1.75} color={mayaOpen ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)'} />
          </button>
          <button
            onClick={() => setShowNewCampaign(true)}
            title="New campaign"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '10px 0', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              background: 'transparent', border: 'none', transition: 'background 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
          >
            <Plus size={16} strokeWidth={1.75} color="var(--color-text-secondary)" />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: sidebarCollapsed ? '4px 0' : '4px 10px' }}>
        {NAV.map((group) => (
          <div key={group.section} style={{ marginBottom: sidebarCollapsed ? 8 : 18 }}>
            {!sidebarCollapsed && (
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-menu-muted)', padding: '0 3px', marginBottom: 4 }}>
                {group.section}
              </p>
            )}
            {group.items.map(item => <NavLink key={item.href} item={item} />)}
          </div>
        ))}
        {isAdmin && (
          <div style={{ marginBottom: sidebarCollapsed ? 8 : 18 }}>
            {!sidebarCollapsed && (
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-menu-muted)', padding: '0 3px', marginBottom: 4 }}>
                Admin
              </p>
            )}
            {[
              { href: '/admin/clients',   label: 'Clients',       icon: Users       },
              { href: '/admin/cost',      label: 'Cost & Usage',  icon: BarChart2   },
              { href: '/admin/revenue',   label: 'Revenue',       icon: TrendingUp  },
              { href: '/admin/orders',    label: 'Orders',        icon: ShoppingBag },
              { href: '/admin/inquiries', label: 'Inquiries',     icon: Inbox       },
              { href: '/admin/settings',  label: 'Admin Settings', icon: Shield     },
            ].map(item => <NavLink key={item.href} item={item} />)}
          </div>
        )}
      </nav>

      {/* Collapse toggle + Help + User */}
      <div style={{ borderTop: '1px solid var(--color-border)' }}>
        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            gap: 8, padding: sidebarCollapsed ? '9px 0' : '9px 14px',
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 14, color: 'var(--color-menu-muted)', transition: 'color 0.12s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-menu-muted)' }}
        >
          {sidebarCollapsed ? <ChevronRight size={14} strokeWidth={1.75} /> : <ChevronLeft size={14} strokeWidth={1.75} />}
          {!sidebarCollapsed && <span>Collapse</span>}
        </button>

        {/* Help */}
        <button
          onClick={openHelpMode}
          title={sidebarCollapsed ? 'Help' : undefined}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            gap: 8, padding: sidebarCollapsed ? '9px 0' : '9px 14px',
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 14, color: 'var(--color-text-secondary)', transition: 'color 0.12s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)' }}
        >
          <HelpCircle size={sidebarCollapsed ? 16 : 14} strokeWidth={1.75} />
          {!sidebarCollapsed && 'Help'}
        </button>

        {/* User */}
        <div style={{
          padding: sidebarCollapsed ? '6px 0 12px' : '6px 14px 12px',
          display: 'flex', alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
          gap: 9,
        }}>
          <UserButton />
          {!sidebarCollapsed && (
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>My account</span>
          )}
        </div>
      </div>
    </aside>
  )

  // ── Canvas header ──────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'system-ui, sans-serif', background: 'var(--color-bg)' }}>
      <NewCampaignModal open={showNewCampaign} onClose={() => setShowNewCampaign(false)} />

      {/* Sidebar — desktop always visible */}
      <div className="hidden lg:flex" style={{ height: '100%' }}>
        {sidebar}
      </div>

      {/* Sidebar — mobile drawer */}
      {mobileOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.18)', zIndex: 39 }}
            onClick={() => setMobileOpen(false)}
          />
          <div style={{ position: 'fixed', inset: '0 auto 0 0', zIndex: 40, height: '100%' }}>
            {sidebar}
          </div>
        </>
      )}

      {/* Maya panel — inline on desktop, full-height drawer on mobile */}
      {mayaOpen && (
        <div
          className="lg:hidden"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.18)', zIndex: 49 }}
          onClick={() => { setMayaOpen(false); setHelpMode(false) }}
        />
      )}
      {mayaOpen && (
        <div
          className="fixed inset-y-0 left-0 z-50 lg:static lg:z-auto"
          style={{ flexShrink: 0, overflow: 'hidden', height: '100%' }}
        >
          <MayChatPanel
            key={`panel-${panelKey}`}
            profile={profile}
            initialMessages={activeMessages}
            initialMode={activeMode}
            canvasContext={canvasContext}
            canvasData={canvasData}
            pendingTask={mayaPendingTask}
            onTaskConsumed={() => setMayaPendingTask(null)}
            onClose={() => { setMayaOpen(false); setHelpMode(false) }}
            sessionId={activeSessionId}
            onSessionCreated={handleSessionCreated}
            isHelpMode={helpMode}
          />
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Mobile top bar */}
        <header
          className="flex items-center justify-between lg:hidden"
          style={{ flexShrink: 0, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '12px 16px' }}
        >
          <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-primary)', display: 'flex' }}>
            <Menu size={18} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--color-text-primary)' }}>
            AGENT<span style={{ color: 'var(--color-brand-accent)' }}>7</span>EVEN
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NotificationBell profileId={profileId} initialNotifications={initialNotifications} />
            <UserButton />
          </div>
        </header>

        {/* Desktop canvas header */}
        <div
          className="hidden lg:flex"
          style={{ flexShrink: 0, height: 56, borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', paddingRight: 20, alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}
        >
          <NotificationBell profileId={profileId} initialNotifications={initialNotifications} />
          <ContextMenu pageName={currentPageKey} />
          <UserButton />
        </div>

        <main style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
