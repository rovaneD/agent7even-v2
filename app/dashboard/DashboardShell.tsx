'use client'

import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import NotificationBell from '@/components/NotificationBell'
import MayChatPanel, { type Profile } from '@/components/maya/MayChatPanel'

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

interface Props {
  children: React.ReactNode
  profile?: Profile | null
  profileId: string
  initialNotifications: Notification[]
  initialMessages?: unknown[]
  initialMode?: string | null
  foundationScore?: number | null
  role?: string | null
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
      { href: '/dashboard/services',     label: 'Services',         icon: ShoppingBag },
      { href: '/dashboard/calendar',     label: 'Content Calendar', icon: Calendar  },
      { href: '/dashboard/foundation',   label: 'Foundation',       icon: Layers    },
      { href: '/dashboard/brand-kit',    label: 'Brand Kit',        icon: BookOpen  },
      { href: '/dashboard/analytics',    label: 'Analytics',        icon: BarChart2 },
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

// ── Component ─────────────────────────────────────────────────────────────

export default function DashboardShell({
  children,
  profile,
  profileId,
  initialNotifications,
  initialMessages = [],
  initialMode = null,
  foundationScore: initialFoundationScore = null,
  role = null,
}: Props) {
  const pathname     = usePathname()
  const [mayaOpen, setMayaOpen]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [foundationScore, setFoundationScore] = useState<number | null>(initialFoundationScore ?? null)

  const isAdmin = role === 'admin' || role === 'owner'

  // Listen for score updates dispatched by FoundationEditor after a successful rescore
  useEffect(() => {
    function onRescored(e: Event) {
      const score = (e as CustomEvent<{ score: number }>).detail.score
      setFoundationScore(score)
    }
    window.addEventListener('foundation:rescored', onRescored)
    return () => window.removeEventListener('foundation:rescored', onRescored)
  }, [])

  // Realtime: cross-tab fallback — update score when profiles row changes
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

  // Pass the current page as context to Maya so she knows what you're looking at
  const canvasContext = NAV.flatMap(g => g.items).find(i => pathname.startsWith(i.href) && i.href !== '/dashboard')?.label
    ?? (pathname === '/dashboard' ? 'Dashboard' : undefined)

  const sidebarStyle: React.CSSProperties = {
    width: 200,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    borderRight: '0.5px solid #ebebeb',
    height: '100%',
    overflow: 'hidden',
  }

  function foundationBarColor(score: number): string {
    if (score >= 80) return '#16a34a'
    if (score >= 60) return '#ca8a04'
    return '#c8522a'
  }

  function NavLink({ item }: { item: typeof NAV[0]['items'][0] }) {
    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
    const Icon = item.icon
    const isFoundation = item.href === '/dashboard/foundation'
    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px',
          borderRadius: 7, textDecoration: 'none', fontSize: 12.5, fontWeight: active ? 500 : 400,
          color: active ? '#0a0a0a' : '#999', background: active ? '#f2f2f2' : 'transparent',
          transition: 'background 0.12s, color 0.12s', marginBottom: 1,
        }}
        onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = '#f7f7f7'; (e.currentTarget as HTMLAnchorElement).style.color = '#555' } }}
        onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#999' } }}
      >
        <Icon size={14} strokeWidth={active ? 2 : 1.75} color={active ? '#0a0a0a' : '#bbb'} />
        {item.label}
        {isFoundation && foundationScore !== null && (
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 28, height: 3, background: '#f0f0f0', borderRadius: 2, display: 'block', overflow: 'hidden' }}>
              <span style={{ display: 'block', width: `${foundationScore}%`, height: '100%', background: foundationBarColor(foundationScore), borderRadius: 2, transition: 'width 0.4s' }} />
            </span>
            <span style={{ fontSize: 9.5, color: foundationBarColor(foundationScore) }}>{foundationScore}%</span>
          </span>
        )}
      </Link>
    )
  }

  const sidebar = (
    <aside style={sidebarStyle}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 14px 12px', borderBottom: '0.5px solid #f5f5f5' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.02em', color: '#0a0a0a' }}>
          AGENT<span style={{ color: '#c8522a' }}>7</span>EVEN
        </span>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 2, display: 'flex' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Maya button */}
      <div style={{ padding: '10px 10px 6px' }}>
        <button
          onClick={() => setMayaOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px',
            borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5,
            fontWeight: 500, color: mayaOpen ? '#fff' : '#0a0a0a',
            background: mayaOpen ? '#0a0a0a' : '#f2f2f2',
            transition: 'background 0.12s, color 0.12s',
          }}
          onMouseEnter={e => { if (!mayaOpen) (e.currentTarget as HTMLButtonElement).style.background = '#e8e8e8' }}
          onMouseLeave={e => { if (!mayaOpen) (e.currentTarget as HTMLButtonElement).style.background = '#f2f2f2' }}
        >
          <Sparkles size={13} strokeWidth={1.75} color={mayaOpen ? '#fff' : '#555'} />
          Maya
          {mayaOpen && (
            <span style={{ marginLeft: 'auto', fontSize: 10, color: '#888', fontWeight: 400 }}>open</span>
          )}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 10px' }}>
        {NAV.map((group) => (
          <div key={group.section} style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ccc', padding: '0 3px', marginBottom: 4 }}>
              {group.section}
            </p>
            {group.items.map(item => <NavLink key={item.href} item={item} />)}
          </div>
        ))}
        {isAdmin && (
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ccc', padding: '0 3px', marginBottom: 4 }}>
              Admin
            </p>
            {[
              { href: '/admin/clients',  label: 'Clients',         icon: Users       },
              { href: '/admin/revenue',  label: 'Revenue',         icon: TrendingUp  },
              { href: '/admin/orders',   label: 'Orders',          icon: ShoppingBag },
              { href: '/admin/inquiries', label: 'Inquiries',      icon: Inbox       },
              { href: '/admin/settings', label: 'Admin Settings',  icon: Shield      },
            ].map(item => <NavLink key={item.href} item={item} />)}
          </div>
        )}
      </nav>

      {/* User */}
      <div style={{ borderTop: '0.5px solid #f0f0f0', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 9 }}>
        <UserButton />
        <span style={{ fontSize: 11.5, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>My account</span>
      </div>
    </aside>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-geist), system-ui, sans-serif', background: '#f8f8f8' }}>

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

      {/* Maya panel */}
      {mayaOpen && (
        <div
          className="hidden lg:flex"
          style={{ width: 380, flexShrink: 0, borderRight: '0.5px solid #ebebeb', overflow: 'hidden', height: '100%' }}
        >
          <MayChatPanel
            profile={profile}
            initialMessages={initialMessages}
            initialMode={initialMode}
            canvasContext={canvasContext}
            onClose={() => setMayaOpen(false)}
          />
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Mobile top bar */}
        <header
          className="lg:hidden"
          style={{ flexShrink: 0, background: '#fff', borderBottom: '0.5px solid #ebebeb', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', display: 'flex' }}>
            <Menu size={18} />
          </button>
          <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.02em', color: '#0a0a0a' }}>
            AGENT<span style={{ color: '#c8522a' }}>7</span>EVEN
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NotificationBell profileId={profileId} initialNotifications={initialNotifications} />
            <UserButton />
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
