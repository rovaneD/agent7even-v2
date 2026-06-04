# Maya Design System V2 — Claude Code Handoff
*Full design pass — revised spec*

> Implementation status: active on `design-system/color-tokens`.
> Read `MAYA_CONTEXT_V02.md` and `CONTEXTV11.md` before continuing.
> This handoff is retained as the original specification; current implementation
> decisions and intentional deviations are documented below.

Read MAYA_CONTEXT_V02.md and CONTEXTV11.md before starting.
Confirm `git remote -v` shows `agent7even-v2`.

---

## Overview

Complete design pass replacing the current mixed visual language with one
unified system. Work through each part in order. Do not skip sections.

This is a large commit — take it section by section and commit when each
part is done rather than trying to do everything at once.

### Implemented through June 3, 2026

- Global tokens in `app/globals.css`
- Dashboard shell and Maya panel token pass
- Blue primary CTAs
- Dashboard and Agents Command Center redesigns
- Campaigns, Calendar, Services, Brand Kit, and utility-page polish
- Dashboard page alignment normalization
- Standard dashboard card normalization
- Preview deployment hardening for Resend, Stripe, and missing environment vars

### Current implementation decisions

- App background is `#FCFCFC`, not the earlier proposed `#F1F5F9`.
- Danger is `#EE533B`, warning is `#FCA509`, and logo accent is `#F5349B`.
- Standard dashboard cards use `bg-white border border-gray-100 rounded-2xl`
  with no default shadow.
- Dashboard Command Center and Agents Command Center heroes are intentional
  soft-shadow exceptions.
- Dashboard pages use centered constrained containers with left-aligned content,
  rather than page content visually jumping between centered and left layouts.

---

## Part 1 — Design Tokens

Update `tailwind.config.ts` and `app/globals.css`:

```css
:root {
  /* Core palette */
  --color-primary:          #2D3748;
  --color-interactive:      #3B82F6;
  --color-positive:         #10B981;
  --color-negative:         #EF4444;
  --color-warning:          #F59E0B;

  /* Surfaces — Stripe-pattern contrast */
  --color-bg:               #F1F5F9;  /* page background — blue-gray */
  --color-surface:          #FFFFFF;  /* cards — pure white */
  --color-surface-2:        #F8FAFC;  /* nested surfaces inside cards */
  --color-border:           #E2E8F0;  /* card borders */
  --color-border-strong:    #CBD5E1;  /* focused/active borders */

  /* Text */
  --color-text-primary:     #2D3748;
  --color-text-secondary:   #64748B;
  --color-text-muted:       #94A3B8;
  --color-text-inverse:     #FFFFFF;

  /* Logo accent — never used in UI elements */
  --color-logo:             #c8522a;
}
```

```typescript
// tailwind.config.ts additions
extend: {
  colors: {
    primary:      '#2D3748',
    interactive:  '#3B82F6',
    positive:     '#10B981',
    negative:     '#EF4444',
    'page-bg':    '#F1F5F9',
    surface:      '#FFFFFF',
    'surface-2':  '#F8FAFC',
    border:       '#E2E8F0',
    'text-sec':   '#64748B',
    'text-muted': '#94A3B8',
  },
  fontSize: {
    'nav':    ['14px', { lineHeight: '1.4', fontWeight: '400' }],
    'nav-sm': ['11px', { lineHeight: '1.2', fontWeight: '600',
                         letterSpacing: '0.08em' }],
    'body':   ['15px', { lineHeight: '1.6' }],
    'body-sm':['13px', { lineHeight: '1.5' }],
    'label':  ['12px', { lineHeight: '1.4', fontWeight: '500' }],
  }
}
```

---

## Part 2 — Hard Rules

Apply everywhere with no exceptions:

1. **No emoji** — not in UI, not in Maya responses, not in agent outputs,
   not in notifications, not in empty states. Remove all existing emoji.
   Add to Maya system prompt: "Never use emoji in your responses."

2. **Orange `#c8522a` only in AGENT7EVEN logo** — remove from all buttons,
   labels, badges, progress bars. Replace with `#3B82F6` or `#2D3748`.

3. **Page background always `#F1F5F9`** — every page, no exceptions.

4. **Cards always `bg-white border border-[#E2E8F0] rounded-2xl`**
   — pure white on blue-gray background creates clear contrast.

5. **Body text 15px minimum** — no 13px or 14px body text anywhere.

6. **Single notification bell** — remove the one in the sidebar,
   keep only the one in the top header bar.

7. **No hamburger ☰** — replace with `...` (MoreHorizontal) contextual menu.

8. **Consistent left-aligned content** — all pages use the same
   container approach. No pages float content in the center.

---

## Part 3 — Button System

Four variants only. Replace all existing button styles:

```tsx
// Primary — main CTA, save, generate
<button className="px-4 py-2.5 bg-[#2D3748] text-white text-[15px]
                   font-medium rounded-xl hover:bg-[#1E293B]
                   transition-colors disabled:opacity-40">

// Interactive — "Do this with Maya →", confirm, open
<button className="px-4 py-2.5 bg-[#3B82F6] text-white text-[15px]
                   font-medium rounded-xl hover:bg-[#2563EB]
                   transition-colors">

// Secondary — cancel, back, secondary
<button className="px-4 py-2.5 bg-white text-[#2D3748] text-[15px]
                   font-medium rounded-xl border border-[#E2E8F0]
                   hover:border-[#94A3B8] transition-colors">

// Destructive — delete, suspend, reset
<button className="px-4 py-2.5 text-[#EF4444] text-[15px] font-medium
                   rounded-xl border border-[#EF4444]/20
                   hover:bg-[#EF4444]/5 transition-colors">
```

---

## Part 4 — Sidebar (DashboardShell)

This is the most impactful structural change. The sidebar gets a
collapse/expand mechanism like Stripe.

### Two states

**Expanded (default): 220px**
**Collapsed: 56px — icons only**

### Collapse toggle

```tsx
// At the bottom of the sidebar, above My account:
<button
  onClick={() => setSidebarCollapsed(!collapsed)}
  className="flex items-center gap-2 px-3 py-2 text-[#94A3B8]
             hover:text-[#2D3748] hover:bg-[#F1F5F9] rounded-lg
             mx-2 transition-colors text-sm w-full"
>
  {collapsed
    ? <ChevronRightIcon className="w-4 h-4" />
    : <ChevronLeftIcon className="w-4 h-4" />
  }
  {!collapsed && <span>Collapse</span>}
</button>
```

Persist collapsed state in localStorage:
```typescript
const [collapsed, setCollapsed] = useState(() => {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('sidebar-collapsed') === 'true'
})

const toggle = () => {
  const next = !collapsed
  setCollapsed(next)
  localStorage.setItem('sidebar-collapsed', String(next))
}
```

### Expanded sidebar styles

```tsx
<aside className={`${collapsed ? 'w-14' : 'w-[220px]'} flex-shrink-0
                   bg-white border-r border-[#E2E8F0] flex flex-col
                   h-screen sticky top-0 transition-all duration-200`}>

  {/* Logo */}
  <div className="px-4 py-4 border-b border-[#E2E8F0] flex items-center
                  justify-between">
    {!collapsed && (
      <span className="font-bold text-[15px] tracking-tight text-[#2D3748]">
        AGENT<span style={{ color: '#c8522a' }}>7</span>EVEN
      </span>
    )}
    {collapsed && (
      <span className="font-bold text-[15px] text-[#2D3748] mx-auto">
        <span style={{ color: '#c8522a' }}>7</span>
      </span>
    )}
  </div>

  {/* Section label — hidden when collapsed */}
  {!collapsed && (
    <p className="px-4 pt-5 pb-1 text-[11px] font-semibold tracking-widest
                  uppercase text-[#94A3B8]">
      Overview
    </p>
  )}

  {/* Nav item — expanded */}
  <NavItem className="flex items-center gap-3 px-3 py-2 text-[14px]
                      text-[#64748B] hover:text-[#2D3748] hover:bg-[#F1F5F9]
                      rounded-lg mx-2 transition-colors" />

  {/* Nav item — active */}
  <NavItem className="flex items-center gap-3 px-3 py-2 text-[14px]
                      font-medium text-[#2D3748] bg-[#F1F5F9]
                      rounded-lg mx-2" />

  {/* Nav item — collapsed (icon only, with tooltip) */}
  {collapsed && (
    <Tooltip content={label}>
      <NavItem className="flex items-center justify-center p-3
                          text-[#64748B] hover:text-[#2D3748]
                          hover:bg-[#F1F5F9] rounded-lg mx-1
                          transition-colors" />
    </Tooltip>
  )}

  {/* Foundation progress — expanded */}
  {!collapsed && (
    <div className="flex items-center gap-2 ml-auto">
      <div className="w-10 bg-[#E2E8F0] rounded-full h-1">
        <div className="bg-[#3B82F6] rounded-full h-1"
             style={{ width: `${score}%` }} />
      </div>
      <span className="text-[11px] text-[#94A3B8]">{score}%</span>
    </div>
  )}

  {/* Foundation progress — collapsed (just dot) */}
  {collapsed && (
    <div className={`w-2 h-2 rounded-full ml-auto mr-1
      ${score >= 80 ? 'bg-[#10B981]'
      : score >= 50 ? 'bg-[#3B82F6]'
      : 'bg-[#F59E0B]'}`} />
  )}
</aside>
```

### Remove from sidebar
- Notification bell (keep only in top header)
- Hamburger icon

---

## Part 5 — Top Header Bar

```tsx
<header className="h-14 bg-white border-b border-[#E2E8F0] flex items-center
                   justify-between px-6 sticky top-0 z-10">

  {/* Left — page title or breadcrumb (optional) */}
  <div />

  {/* Center — AGENT7EVEN wordmark */}
  <span className="font-bold text-[15px] tracking-tight text-[#2D3748]
                   absolute left-1/2 -translate-x-1/2">
    AGENT<span style={{ color: '#c8522a' }}>7</span>EVEN
  </span>

  {/* Right — actions */}
  <div className="flex items-center gap-3">
    {/* Single notification bell */}
    <button className="relative p-2 text-[#64748B] hover:text-[#2D3748]
                       hover:bg-[#F1F5F9] rounded-lg transition-colors">
      <BellIcon className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-[#EF4444]
                         rounded-full" />
      )}
    </button>

    {/* Contextual page actions — replaces hamburger */}
    <ContextMenu pageName={currentPage} />

    {/* Avatar */}
    <UserButton />
  </div>
</header>
```

---

## Part 6 — Page Layout

Every canvas page:

```tsx
<div className="min-h-screen bg-[#F1F5F9]">
  <div className="px-8 pt-8 pb-6 max-w-[1200px]">

    {/* Page header — always left-aligned */}
    <p className="text-[11px] font-semibold tracking-widest uppercase
                  text-[#94A3B8] mb-1">
      {sectionLabel}
    </p>
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-[26px] font-semibold text-[#2D3748]">
        {pageTitle}
      </h1>
      {/* Primary CTA for this page */}
      {pageCTA}
    </div>

    {/* Page content */}
    {children}
  </div>
</div>
```

**Max widths:**
- All pages: `max-w-[1200px]` — consistent across every page
- No page floats content in center. Everything left-aligned within the container.
- Two-column layouts (Foundation, Brand Kit): CSS grid inside the container

---

## Part 7 — Card System

```tsx
// Standard card
<div className="bg-white rounded-2xl border border-[#E2E8F0] p-6
                shadow-[0_1px_3px_rgba(0,0,0,0.04)]">

// Clickable card
<div className="bg-white rounded-2xl border border-[#E2E8F0] p-6
                shadow-[0_1px_3px_rgba(0,0,0,0.04)]
                hover:border-[#94A3B8] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]
                transition-all cursor-pointer">

// Selected card
<div className="bg-white rounded-2xl border-2 border-[#3B82F6] p-6
                bg-blue-50/20">

// Nested surface (inside a card)
<div className="bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] p-4">
```

---

## Part 8 — Maya Chat Panel (Resizable)

The Maya panel must be freely resizable via drag. Width persists in localStorage.

```tsx
'use client'

const MIN_WIDTH = 320
const MAX_WIDTH = 640
const DEFAULT_WIDTH = 380

export function MayChatPanel({ onClose, ...props }) {
  const [width, setWidth] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_WIDTH
    return parseInt(localStorage.getItem('maya-panel-width') ?? String(DEFAULT_WIDTH))
  })
  const [isDragging, setIsDragging] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Drag handle on RIGHT edge of panel
  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    setIsDragging(true)

    const startX = e.clientX
    const startWidth = width

    function onMouseMove(e: MouseEvent) {
      const delta = e.clientX - startX
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta))
      setWidth(newWidth)
    }

    function onMouseUp() {
      setIsDragging(false)
      localStorage.setItem('maya-panel-width', String(width))
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div
      ref={panelRef}
      style={{ width }}
      className="flex-shrink-0 bg-white border-r border-[#E2E8F0]
                 flex flex-col h-screen relative"
    >
      {/* Drag handle — right edge */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize
                    hover:bg-[#3B82F6]/30 transition-colors
                    ${isDragging ? 'bg-[#3B82F6]/50' : ''}`}
      />

      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3
                      border-b border-[#E2E8F0] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#2D3748] flex items-center
                          justify-center">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <div>
            <span className="text-[14px] font-semibold text-[#2D3748]">
              Maya
            </span>
            <span className="text-[11px] text-[#10B981] ml-1.5">online</span>
          </div>
        </div>
        <button onClick={onClose}
                className="p-1.5 text-[#94A3B8] hover:text-[#2D3748]
                           hover:bg-[#F1F5F9] rounded-lg transition-colors">
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Conversation history list (when no active chat) */}
      {showHistory && (
        <div className="px-3 py-2 border-b border-[#E2E8F0] flex-shrink-0">
          {recentConversations.map(conv => (
            <button key={conv.id}
                    onClick={() => loadConversation(conv.id)}
                    className="w-full text-left px-3 py-1.5 rounded-lg
                               hover:bg-[#F1F5F9] transition-colors">
              <p className="text-[13px] text-[#2D3748] truncate">{conv.title}</p>
              <p className="text-[11px] text-[#94A3B8]">{conv.page}</p>
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Maya message */}
        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#2D3748] flex items-center
                          justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <div className="flex-1">
            <p className="text-[15px] text-[#2D3748] leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* User message */}
        <div className="flex justify-end">
          <div className="bg-[#2D3748] rounded-2xl rounded-tr-sm
                          px-4 py-3 max-w-[85%]">
            <p className="text-[15px] text-white leading-relaxed">{message}</p>
          </div>
        </div>

      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[#E2E8F0] flex-shrink-0">
        <div className="flex items-end gap-2 bg-[#F8FAFC] rounded-xl
                        px-4 py-3 border border-[#E2E8F0]
                        focus-within:border-[#94A3B8] transition-colors">
          <textarea
            placeholder="Ask Maya anything..."
            className="flex-1 bg-transparent text-[15px] text-[#2D3748]
                       placeholder:text-[#94A3B8] resize-none outline-none
                       max-h-32 leading-relaxed"
            rows={1}
          />
          <button className="w-8 h-8 bg-[#2D3748] rounded-xl flex items-center
                             justify-center flex-shrink-0 hover:bg-[#1E293B]
                             transition-colors disabled:opacity-40">
            <ArrowUpIcon className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-[11px] text-[#94A3B8] text-center mt-2">
          Maya makes mistakes. Verify important decisions.
        </p>
      </div>
    </div>
  )
}
```

---

## Part 9 — Badge System

```tsx
const BADGE_STYLES = {
  idle:      'bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0]',
  active:    'bg-[#10B981]/10 text-[#10B981]',
  running:   'bg-[#3B82F6]/10 text-[#3B82F6]',
  pending:   'bg-[#F59E0B]/10 text-[#F59E0B]',
  completed: 'bg-[#10B981]/10 text-[#10B981]',
  failed:    'bg-[#EF4444]/10 text-[#EF4444]',
  auto:      'bg-[#3B82F6]/10 text-[#3B82F6]',
  approval:  'bg-[#2D3748]/10 text-[#2D3748]',
  inactive:  'bg-[#F1F5F9] text-[#94A3B8]',
}

<span className={`text-[12px] font-medium px-2.5 py-1
                  rounded-full ${BADGE_STYLES[status]}`}>
  {label}
</span>
```

---

## Part 10 — Contextual Page Menu

Replace hamburger with `...` MoreHorizontal icon + dropdown:

```tsx
const PAGE_ACTIONS: Record<string, { label: string; action: string }[]> = {
  dashboard:     [
    { label: 'Refresh digest',      action: 'refresh-digest' },
  ],
  campaigns:     [
    { label: 'Sort by newest',      action: 'sort-newest' },
    { label: 'Sort by oldest',      action: 'sort-oldest' },
  ],
  'brand-kit':   [
    { label: 'Export brand guide',  action: 'export' },
  ],
  foundation:    [
    { label: 'Export Foundation',   action: 'export' },
    { label: 'Reset Foundation',    action: 'reset' },
  ],
  agents:        [
    { label: 'View run history',    action: 'history' },
  ],
  analytics:     [
    { label: 'Refresh data',        action: 'refresh' },
  ],
}
```

---

## Part 11 — Agent Command Center Layout Fix

The page currently requires scrolling to see agents. Fix by making
the top section more compact:

```tsx
// Compact the Live Activity + Agent Scorecard sections
// Use a 2-column grid at a fixed height, not stacked full-height sections

<div className="grid grid-cols-2 gap-4 mb-6" style={{ height: '280px' }}>

  {/* Live Activity — left */}
  <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5
                  overflow-hidden">
    <p className="text-[11px] font-semibold tracking-widest uppercase
                  text-[#94A3B8] mb-3">Live Activity</p>
    {/* Compact activity content */}
  </div>

  {/* Agent Scorecard — right, scrollable */}
  <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5
                  overflow-y-auto">
    <p className="text-[11px] font-semibold tracking-widest uppercase
                  text-[#94A3B8] mb-3">Agent Scorecard</p>
    {/* Agent rows — compact, 36px height each */}
    {agents.map(agent => (
      <div key={agent.id}
           className="flex items-center justify-between py-2
                      border-b border-[#F1F5F9] last:border-0">
        <div className="flex items-center gap-2">
          <AgentIcon className="w-3.5 h-3.5 text-[#94A3B8]" />
          <span className="text-[14px] text-[#2D3748]">{agent.name}</span>
        </div>
        <div className="flex items-center gap-3 text-[13px] text-[#94A3B8]">
          <span>{agent.lastRun}</span>
          <span>{agent.outputs}</span>
          <BadgeComponent status={agent.status} />
        </div>
      </div>
    ))}
  </div>
</div>

{/* Run an agent — visible on first load without scrolling */}
<div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
  <h2 className="text-[17px] font-semibold text-[#2D3748] mb-1">
    Run an agent
  </h2>
  <p className="text-[14px] text-[#64748B] mb-5">
    Choose an agent and tell it what you need.
  </p>
  {/* Agent cards grid */}
  <div className="grid grid-cols-3 gap-3">
    {agents.map(agent => (
      <AgentCard key={agent.id} agent={agent} />
    ))}
  </div>
</div>
```

---

## Part 12 — Page-Specific Fixes

### Dashboard
Remove:
- "Hours Reclaimed / Content Produced / Active Services" empty stat cards
- "Talk to Maya" card (Maya is always in sidebar)

Replace stat cards with a compact 3-column summary using real data:
```tsx
<div className="grid grid-cols-3 gap-4 mb-6">
  <StatCard
    label="Active campaigns"
    value={campaignCount}
    sub="in progress"
  />
  <StatCard
    label="Agent runs this week"
    value={agentRunCount}
    sub="completed"
  />
  <StatCard
    label="Credits remaining"
    value={creditBalance}
    sub={`of ${planMax} this month`}
    showBar
  />
</div>
```

Morning digest filter — exclude `agent = 'maya'` tasks from "What I did":
```typescript
// In /api/digest/generate/route.ts
const { data: agentTasks } = await supabase
  .from('agent_tasks')
  .select(...)
  .eq('user_id', profileId)
  .neq('agent', 'maya')  // ADD THIS
  .gte('created_at', since)
```

Free account nudge — replace black box with subtle inline:
```tsx
{!profile.plan && (
  <p className="text-[14px] text-[#64748B] mb-6">
    You're on a free account —{' '}
    <Link href="/dashboard/billing"
          className="text-[#3B82F6] font-medium hover:underline">
      choose a plan
    </Link>
    {' '}to unlock agents and campaigns.
  </p>
)}
```

### Campaigns empty state
```tsx
<div className="flex flex-col items-center justify-center py-32 text-center">
  <div className="w-14 h-14 rounded-2xl bg-white border border-[#E2E8F0]
                  flex items-center justify-center mb-4
                  shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
    <CampaignsIcon className="w-6 h-6 text-[#94A3B8]" />
  </div>
  <h3 className="text-[17px] font-semibold text-[#2D3748] mb-2">
    No campaigns yet
  </h3>
  <p className="text-[15px] text-[#64748B] max-w-xs mb-6 leading-relaxed">
    Build your first campaign and Maya will create a complete
    week-by-week plan tailored to your business.
  </p>
  <button className="px-5 py-2.5 bg-[#2D3748] text-white text-[15px]
                     font-medium rounded-xl hover:bg-[#1E293B]
                     transition-colors">
    Build your first campaign
  </button>
</div>
```

### Billing — Credit top-up
- Selected package: `border-2 border-[#3B82F6] bg-blue-50/20`
- Unselected package: `border border-[#E2E8F0] hover:border-[#94A3B8]`
- Buy button: `bg-[#2D3748]` primary
- "Popular" badge: `bg-[#3B82F6]/10 text-[#3B82F6]`

### Foundation
- Section labels: `text-[#94A3B8]` uppercase tracking-widest
- Per-field score: green >70%, amber 50-70%, red <50%
- Right panel score card: white card, `#10B981` progress bar

### Morning Digest
- "Do this with Maya →": `text-[#3B82F6]`
- Agent name labels: `text-[#94A3B8]` text-[12px]
- Maya avatar: `bg-[#2D3748]`

### Pricing page
- Page background: `#F1F5F9`
- Plan cards: `bg-white border border-[#E2E8F0]`
- Selected/featured plan: `border-2 border-[#3B82F6]`
- "Most popular" badge: `bg-[#3B82F6] text-white`
- CTAs: `bg-[#2D3748]`, featured plan: `bg-[#3B82F6]`
- Annual toggle active: `bg-[#3B82F6]`

### Admin — Client Health
- Healthy dot: `#10B981`
- Drifting dot: `#F59E0B`
- At risk dot: `#EF4444`
- Plan badges: Growth `text-[#3B82F6]`, ProAgent `text-[#2D3748]`

---

## Part 13 — Typography Scale

Apply consistently across all pages:

```
Page section label:  11px, font-semibold, tracking-widest, uppercase, #94A3B8
Page title (h1):     26px, font-semibold, #2D3748
Page subtitle:       15px, font-normal, #64748B
Section heading:     17px, font-semibold, #2D3748
Card title:          15px, font-semibold, #2D3748
Card body:           15px, font-normal, #2D3748
Small label:         12px, font-medium, #94A3B8
Caption:             11px, font-normal, #94A3B8
Nav item active:     14px, font-medium, #2D3748
Nav item inactive:   14px, font-normal, #64748B
Nav section label:   11px, font-semibold, tracking-widest, uppercase, #94A3B8
Button text:         15px, font-medium
```

---

## Part 14 — Remove from Codebase

Search and replace/remove:

```bash
# Find all orange usage (except logo)
grep -r "c8522a" --include="*.tsx" --include="*.ts" --include="*.css"

# Find emoji in JSX
grep -rn "[^\x00-\x7F]" --include="*.tsx" app/

# Find bg-black buttons
grep -rn "bg-black" --include="*.tsx" app/

# Find old orange Tailwind classes
grep -rn "orange-" --include="*.tsx" app/
```

Remove:
1. All `text-[#c8522a]` except logo component
2. All `bg-[#c8522a]`
3. All `border-[#c8522a]`
4. All `bg-black` on buttons — replace `bg-[#2D3748]`
5. All emoji in JSX string literals
6. Duplicate notification bell in sidebar
7. Hamburger ☰ — replace with `...` MoreHorizontal
8. "AI Toolkit" text anywhere in UI

---

## Definition of Done

**Tokens & Rules**
- [ ] Design tokens in globals.css + tailwind.config
- [ ] No emoji anywhere in codebase
- [ ] No orange in UI (logo only)
- [ ] Maya system prompt updated — no emoji rule

**Layout**
- [ ] Page background `#F1F5F9` on every page
- [ ] White cards with border on every page — visible contrast
- [ ] All pages use `max-w-[1200px]` left-aligned container
- [ ] No pages floating content in center

**Sidebar**
- [ ] Sidebar collapses to 56px icon-only
- [ ] Collapse state persists in localStorage
- [ ] Collapsed state shows tooltips on hover
- [ ] Single notification bell (header only)
- [ ] No hamburger icon

**Maya Panel**
- [ ] Free drag resize from 320px to 640px
- [ ] Width persists in localStorage
- [ ] Drag handle visible on right edge
- [ ] New color system applied to panel

**Buttons & Badges**
- [ ] 4 button variants only, used consistently
- [ ] Badge system consistent across all pages
- [ ] No black fill on selected cards

**Page fixes**
- [ ] Dashboard: real stat cards, no empty placeholders
- [ ] Dashboard: morning digest excludes Maya chat
- [ ] Dashboard: subtle free account nudge
- [ ] Campaigns: full-page empty state
- [ ] Agent Command Center: compact top, agents visible without scrolling
- [ ] Billing: blue selected state, navy buy button
- [ ] Pricing: new color system throughout
- [ ] Admin: correct status dot colors

**Typography**
- [ ] Body text 15px minimum throughout
- [ ] Consistent type scale across all pages

**Visual check**
- [ ] Open every page and confirm consistent look
- [ ] Sidebar collapse works and looks clean
- [ ] Maya panel drag works smoothly
- [ ] Cards clearly visible against page background
