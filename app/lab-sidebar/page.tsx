'use client'

import { useState } from 'react'
import {
  LayoutDashboard, Bot, Megaphone, ShoppingBag, Calendar,
  Layers, BookOpen, BarChart2, FileText, Headphones, Bell,
  Users, CreditCard, Settings, Sparkles, Plus, HelpCircle,
  ChevronRight, Trash2, CheckCircle2, MessageSquare, Shield,
  TrendingUp, Inbox,
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'

// ── Nav config ─────────────────────────────────────────────────────────────────

const NAV_WORKSPACE = [
  { href: '/dashboard',             label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/dashboard/agents',      label: 'Agents',           icon: Bot,      badge: 2 },
  { href: '/dashboard/campaigns',   label: 'Campaigns',        icon: Megaphone },
  { href: '/dashboard/services',    label: 'Services',         icon: ShoppingBag },
  { href: '/dashboard/calendar',    label: 'Content Calendar', icon: Calendar  },
  { href: '/dashboard/foundation',  label: 'Foundation',       icon: Layers,   progress: 72 },
  { href: '/dashboard/brand-kit',   label: 'Brand Kit',        icon: BookOpen, progress: 50 },
  { href: '/dashboard/analytics',   label: 'Analytics',        icon: BarChart2 },
  { href: '/dashboard/deliverables',label: 'Deliverables',     icon: FileText  },
]

const NAV_ACCOUNT = [
  { href: '/dashboard/support',       label: 'Support',       icon: Headphones },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell       },
  { href: '/dashboard/team',          label: 'Team',          icon: Users      },
  { href: '/dashboard/billing',       label: 'Billing',       icon: CreditCard },
  { href: '/dashboard/settings',      label: 'Settings',      icon: Settings   },
]

const NAV_ADMIN = [
  { href: '/admin/clients',   label: 'Clients',        icon: Users      },
  { href: '/admin/cost',      label: 'Cost & Usage',   icon: BarChart2  },
  { href: '/admin/revenue',   label: 'Revenue',        icon: TrendingUp },
  { href: '/admin/orders',    label: 'Orders',         icon: ShoppingBag, badge: 3 },
  { href: '/admin/inquiries', label: 'Inquiries',      icon: Inbox      },
  { href: '/admin/settings',  label: 'Admin Settings', icon: Shield     },
]

const MOCK_SESSIONS = [
  { id: '1', label: 'Today',     title: 'Campaign — Summer launch ideas',    context: 'Campaigns' },
  { id: '2', label: 'Today',     title: 'Brand voice feedback on homepage',   context: 'Brand Kit' },
  { id: '3', label: 'Yesterday', title: 'Weekly content plan for June',       context: 'Agents'    },
  { id: '4', label: 'Yesterday', title: 'Analytics summary May 28',           context: 'Analytics' },
  { id: '5', label: 'Jun 3',     title: 'Foundation Q&A',                     context: null        },
]

// ── Small helpers ─────────────────────────────────────────────────────────────

function ProgressDot({ pct, color }: { pct: number; color: string }) {
  return (
    <span className="ml-auto flex items-center gap-1.5">
      <span className="relative inline-block h-1.5 w-7 overflow-hidden rounded-full bg-gray-200">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </span>
      <span className="text-[9px] font-medium" style={{ color }}>{pct}%</span>
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LabSidebarPage() {
  const [activePath, setActivePath]     = useState('/dashboard/agents')
  const [mayaOpen, setMayaOpen]         = useState(true)
  const [hoveredSession, setHoveredSession] = useState<string | null>(null)
  const [showAdmin, setShowAdmin]       = useState(false)
  const [agentsExpanded, setAgentsExpanded] = useState(true)

  const sessionsByGroup = MOCK_SESSIONS.reduce<Record<string, typeof MOCK_SESSIONS>>((acc, s) => {
    if (!acc[s.label]) acc[s.label] = []
    acc[s.label].push(s)
    return acc
  }, {})

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={true}>
        <Sidebar collapsible="icon">

          {/* ── Logo ── */}
          <SidebarHeader className="border-b border-sidebar-border px-4 py-3.5">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold tracking-widest text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                AGENT<span className="text-pink-500">7</span>EVEN
              </span>
              <span className="hidden text-[15px] font-bold text-sidebar-foreground group-data-[collapsible=icon]:block">
                <span className="text-pink-500">7</span>
              </span>
            </div>
          </SidebarHeader>

          {/* ── Quick actions ── */}
          <div className="px-2 py-2 space-y-1 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-1">

            {/* Maya button */}
            <button
              onClick={() => setMayaOpen(o => !o)}
              title="Maya"
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-md ${
                mayaOpen
                  ? 'bg-sidebar-foreground text-sidebar-background'
                  : 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent'
              }`}
            >
              <Sparkles size={13} className="flex-shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">Maya</span>
              {mayaOpen && (
                <span className="ml-auto text-[10px] font-normal opacity-60 group-data-[collapsible=icon]:hidden">new</span>
              )}
            </button>

            {/* Session history when Maya is open */}
            {mayaOpen && (
              <div className="mt-1 space-y-3 px-1 group-data-[collapsible=icon]:hidden">
                {Object.entries(sessionsByGroup).map(([label, sessions]) => (
                  <div key={label}>
                    <p className="mb-1 px-1 text-[9.5px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                      {label}
                    </p>
                    {sessions.map(s => (
                      <div
                        key={s.id}
                        className="group/session flex items-center gap-1 rounded-md"
                        onMouseEnter={() => setHoveredSession(s.id)}
                        onMouseLeave={() => setHoveredSession(null)}
                      >
                        <button className="min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-[11.5px] text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
                          <span className="mr-1 text-sidebar-foreground/30 text-[10px]">›</span>
                          {s.context && (
                            <span className="mr-1 text-[9.5px] font-medium text-blue-500">{s.context} · </span>
                          )}
                          {s.title}
                        </button>
                        {hoveredSession === s.id && (
                          <button aria-label="Delete chat" className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-sidebar-foreground/30 hover:text-red-500 transition-colors">
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* New campaign */}
            <button
              title="New campaign"
              className="w-full flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent px-2.5 py-2 text-sm font-medium text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:border-0"
            >
              <Plus size={13} className="flex-shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">New campaign</span>
            </button>
          </div>

          <SidebarSeparator />

          {/* ── Nav ── */}
          <SidebarContent>

            {/* Workspace */}
            <SidebarGroup>
              <SidebarGroupLabel>Your workspace</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_WORKSPACE.map(item => {
                    const active = activePath === item.href
                    const isAgents = item.href === '/dashboard/agents'
                    const isFoundation = item.href === '/dashboard/foundation'
                    const isBrandKit = item.href === '/dashboard/brand-kit'
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={active}
                          tooltip={item.label}
                          onClick={() => {
                            setActivePath(item.href)
                            if (isAgents) setAgentsExpanded(e => !e)
                          }}
                          className="gap-2"
                        >
                          <item.icon size={14} />
                          <span>{item.label}</span>
                          {item.badge && (
                            <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                          )}
                          {isFoundation && item.progress !== undefined && (
                            <ProgressDot pct={item.progress} color={item.progress >= 80 ? '#10B981' : item.progress >= 60 ? '#F59E0B' : '#EF4444'} />
                          )}
                          {isBrandKit && item.progress !== undefined && (
                            <ProgressDot pct={item.progress} color="#3B82F6" />
                          )}
                        </SidebarMenuButton>

                        {/* Agents sub-nav — approvals */}
                        {isAgents && agentsExpanded && item.badge && (
                          <SidebarMenuSub>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton
                                isActive={activePath === '/dashboard/agents/approvals'}
                                onClick={() => setActivePath('/dashboard/agents/approvals')}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                  Approvals
                                </span>
                                <span className="ml-auto text-[10px] font-semibold text-blue-600">{item.badge}</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          </SidebarMenuSub>
                        )}
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Account */}
            <SidebarGroup>
              <SidebarGroupLabel>Account</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ACCOUNT.map(item => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={activePath === item.href}
                        tooltip={item.label}
                        onClick={() => setActivePath(item.href)}
                      >
                        <item.icon size={14} />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Admin — toggle to show */}
            {showAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel>Admin</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {NAV_ADMIN.map(item => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={activePath === item.href}
                          tooltip={item.label}
                          onClick={() => setActivePath(item.href)}
                        >
                          <item.icon size={14} />
                          <span>{item.label}</span>
                          {item.badge && (
                            <SidebarMenuBadge className="bg-emerald-100 text-emerald-700">{item.badge}</SidebarMenuBadge>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          {/* ── Footer ── */}
          <SidebarFooter className="border-t border-sidebar-border pb-3">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Help">
                  <HelpCircle size={14} />
                  <span>Help</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Toggle admin view (lab only)"
                  onClick={() => setShowAdmin(a => !a)}
                >
                  <Shield size={14} />
                  <span>Toggle admin view</span>
                  <Badge variant="outline" className="ml-auto text-[9px] px-1.5 py-0">Lab</Badge>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            {/* User row */}
            <div className="flex items-center gap-2.5 px-2 py-1 group-data-[collapsible=icon]:justify-center">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-[11px] font-bold text-white">
                R
              </div>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-xs font-medium text-sidebar-foreground">Rovane</p>
                <p className="truncate text-[10px] text-sidebar-foreground/50">rovane@dursodesign.com</p>
              </div>
              <ChevronRight size={12} className="flex-shrink-0 text-sidebar-foreground/40 group-data-[collapsible=icon]:hidden" />
            </div>
          </SidebarFooter>

          <SidebarRail />
        </Sidebar>

        {/* ── Main content ── */}
        <SidebarInset>
          {/* Top bar */}
          <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
            <div className="flex flex-1 items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {NAV_WORKSPACE.find(i => i.href === activePath)?.label
                  ?? NAV_ACCOUNT.find(i => i.href === activePath)?.label
                  ?? NAV_ADMIN.find(i => i.href === activePath)?.label
                  ?? (activePath === '/dashboard/agents/approvals' ? 'Approvals' : 'Dashboard')}
              </span>
            </div>
            <Badge variant="outline" className="text-[11px] text-amber-600 border-amber-200 bg-amber-50">
              shadcn/ui lab
            </Badge>
          </header>

          {/* Demo content */}
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
            <div className="rounded-2xl border border-dashed bg-muted/30 p-10 max-w-sm w-full">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                {(() => {
                  const item = NAV_WORKSPACE.find(i => i.href === activePath)
                    ?? NAV_ACCOUNT.find(i => i.href === activePath)
                    ?? NAV_ADMIN.find(i => i.href === activePath)
                  if (item) return <item.icon size={20} className="text-muted-foreground" />
                  return <LayoutDashboard size={20} className="text-muted-foreground" />
                })()}
              </div>
              <p className="text-sm font-semibold">
                {NAV_WORKSPACE.find(i => i.href === activePath)?.label
                  ?? NAV_ACCOUNT.find(i => i.href === activePath)?.label
                  ?? NAV_ADMIN.find(i => i.href === activePath)?.label
                  ?? (activePath === '/dashboard/agents/approvals' ? 'Approvals' : 'Dashboard')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{activePath}</p>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>Click nav items to switch active state.</p>
              <p>Use the <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-mono bg-muted">⌘B</kbd> or the rail arrow to collapse the sidebar.</p>
              <p>Toggle admin view in the footer to see the Admin section.</p>
            </div>

            {/* Feature checklist */}
            <div className="rounded-xl border bg-card p-5 text-left space-y-2 w-full max-w-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">What's implemented</p>
              {[
                'Collapsible icon mode (rail click or ⌘B)',
                'Logo adapts expanded ↔ icon',
                'Maya button with session history list',
                'New campaign button',
                'Active state per nav item',
                'Foundation + Brand Kit progress bars',
                'Agent approvals badge + sub-nav',
                'Admin section (toggle in footer)',
                'Mobile sheet via SidebarProvider',
                'Tooltip labels in collapsed mode',
                'User row in footer',
              ].map(f => (
                <div key={f} className="flex items-start gap-2">
                  <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                  <span className="text-xs">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
