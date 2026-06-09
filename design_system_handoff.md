# Maya Design System — Claude Code Handoff

> Historical handoff. Superseded by `design_system_v2_handoff.md`,
> `CONTEXTV12.md`, and the merged `design-system/color-tokens` branch.
*Full design pass — unified visual language*

Read MAYA_CONTEXT.md and CONTEXTV12.md before starting.
Confirm `git remote -v` shows `agent7even-v2`.

---

## Overview

This is a full design pass across all pages. The goal is one unified visual
language replacing the current mix of production-fork styles, dark UI remnants,
and independently-built components.

Work through each section in order. Do NOT skip sections.

---

## Part 1 — Design Tokens

Create `app/globals.css` additions (or update existing):

```css
:root {
  /* Core palette */
  --color-primary:          #2D3748;
  --color-interactive:      #3B82F6;
  --color-positive:         #10B981;
  --color-negative:         #EF4444;
  --color-warning:          #F59E0B;

  /* Surfaces */
  --color-bg:               #F8F8F8;
  --color-surface:          #F8FAFC;
  --color-surface-hover:    #F1F5F9;
  --color-border:           #E2E8F0;
  --color-border-strong:    #CBD5E1;

  /* Text */
  --color-text-primary:     #2D3748;
  --color-text-secondary:   #9BA1AE;
  --color-text-muted:       #CBD5E1;
  --color-text-inverse:     #FFFFFF;

  /* Logo accent — never used in UI */
  --color-logo:             #c8522a;

  /* Spacing */
  --radius-sm:   8px;
  --radius-md:   12px;
  --radius-lg:   16px;
  --radius-xl:   20px;

  /* Shadows */
  --shadow-sm:   0 1px 3px rgba(0,0,0,0.06);
  --shadow-md:   0 4px 12px rgba(0,0,0,0.08);
}
```

Update `tailwind.config.ts` to include these as custom colors:
```typescript
colors: {
  primary:     '#2D3748',
  interactive: '#3B82F6',
  positive:    '#10B981',
  negative:    '#EF4444',
  surface:     '#F8FAFC',
  'text-secondary': '#9BA1AE',
}
```

---

## Part 2 — Hard Rules (apply everywhere, no exceptions)

1. **No emoji anywhere** — not in UI text, not in Maya chat responses, not in
   agent outputs, not in empty states, not in notifications, not in the morning
   digest. SVG icons only. Remove any existing emoji from static text in the codebase.

2. **Orange `#c8522a` appears only in the AGENT7EVEN logo** — remove from all
   buttons, labels, section headers, progress bars, links, badges, and any other
   UI element. Replace with `#3B82F6` (interactive) or `#2D3748` (primary).

3. **No solid black buttons** — primary buttons use `#2D3748` not `#000000`.

4. **No solid black filled cards for selected state** — selected state uses
   `border-[#3B82F6] bg-blue-50` not `bg-black text-white`.

5. **Page background is always `#F8F8F8`** — not white, not gray-50.

6. **Cards are always `bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0]`**

7. **Maya system prompt** — add to `/api/maya/chat/route.ts` system prompt:
   "Never use emoji in your responses. Use plain text only."

---

## Part 3 — Button System

Replace all button variants across the entire codebase with these four only:

### Primary button
```tsx
// Used for: main CTA per page, form submissions, "Save", "Generate"
<button className="px-4 py-2.5 bg-[#2D3748] text-white text-sm font-medium
                   rounded-xl hover:bg-[#1a2535] transition-colors
                   disabled:opacity-40 disabled:cursor-not-allowed">
```

### Interactive button (blue)
```tsx
// Used for: "Do this with Maya →", links that open Maya, confirm actions
<button className="px-4 py-2.5 bg-[#3B82F6] text-white text-sm font-medium
                   rounded-xl hover:bg-[#2563EB] transition-colors">
```

### Secondary button
```tsx
// Used for: Cancel, back, secondary actions
<button className="px-4 py-2.5 bg-white text-[#2D3748] text-sm font-medium
                   rounded-xl border border-[#E2E8F0]
                   hover:border-[#9BA1AE] transition-colors">
```

### Destructive button
```tsx
// Used for: Delete, suspend, reset — text only, no filled background
<button className="px-4 py-2.5 text-[#EF4444] text-sm font-medium
                   rounded-xl border border-[#EF4444]/20
                   hover:bg-[#EF4444]/5 transition-colors">
```

### Text link (inline)
```tsx
// Used for: "View →", "Open →", secondary nav actions
<button className="text-[#3B82F6] text-sm font-medium hover:underline">
```

---

## Part 4 — Sidebar (DashboardShell)

Update `DashboardShell.tsx`:

```tsx
// Sidebar shell
<aside className="w-[220px] flex-shrink-0 bg-white border-r border-[#E2E8F0]
                  flex flex-col h-screen sticky top-0">

  {/* Logo */}
  <div className="px-5 py-4 border-b border-[#E2E8F0]">
    <span className="font-bold text-[15px] tracking-tight text-[#2D3748]">
      AGENT<span style={{ color: '#c8522a' }}>7</span>EVEN
    </span>
  </div>

  {/* Nav items */}
  // Section labels:
  <p className="px-4 pt-5 pb-1 text-[10px] font-semibold tracking-widest
                uppercase text-[#9BA1AE]">
    Overview
  </p>

  // Nav item — inactive:
  <NavItem className="flex items-center gap-2.5 px-4 py-2 text-sm
                      text-[#9BA1AE] hover:text-[#2D3748] hover:bg-[#F8F8F8]
                      rounded-lg mx-2 transition-colors" />

  // Nav item — active:
  <NavItem className="flex items-center gap-2.5 px-4 py-2 text-sm
                      font-medium text-[#2D3748] bg-[#F8FAFC]
                      border border-[#E2E8F0] rounded-lg mx-2" />

  // Foundation progress bar — blue not orange:
  <div className="w-12 bg-[#E2E8F0] rounded-full h-1">
    <div className="bg-[#3B82F6] rounded-full h-1"
         style={{ width: `${score}%` }} />
  </div>
```

**Sidebar width is fixed at 220px** — does not change when Maya panel opens.
Maya panel slides in between sidebar and canvas. Canvas shrinks. Sidebar stays.

---

## Part 5 — Page Layout

Every canvas page uses this shell:

```tsx
// Page wrapper
<div className="min-h-screen bg-[#F8F8F8]">

  {/* Page header */}
  <div className="px-8 pt-8 pb-6">
    <p className="text-[10px] font-semibold tracking-widest uppercase
                  text-[#9BA1AE] mb-1">
      {sectionLabel}  {/* e.g. "DASHBOARD", "CAMPAIGNS", "BRAND KIT" */}
    </p>
    <h1 className="text-2xl font-semibold text-[#2D3748]">{pageTitle}</h1>
    {subtitle && (
      <p className="text-sm text-[#9BA1AE] mt-1">{subtitle}</p>
    )}
  </div>

  {/* Page content */}
  <div className="px-8 pb-8">
    {children}
  </div>

</div>
```

**Max widths:**
- Single column pages (Billing, Settings, Support): `max-w-2xl`
- Two column pages (Foundation, Brand Kit): `max-w-5xl`
- Full canvas pages (Dashboard, Agents, Campaigns): no max-width, full available width

---

## Part 6 — Card System

Single card component used everywhere:

```tsx
// Standard card
<div className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-6">

// Card with hover (clickable cards)
<div className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-6
                hover:border-[#9BA1AE] hover:shadow-sm transition-all
                cursor-pointer">

// Selected card (plan picker, package selector, segment cards)
<div className="bg-white rounded-2xl border-2 border-[#3B82F6] p-6
                bg-blue-50/30">

// Inactive/unselected card (plan picker)
<div className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-6
                hover:border-[#9BA1AE] transition-colors cursor-pointer">
```

---

## Part 7 — Badge System

```tsx
// Status badges
const badges = {
  active:    'bg-[#10B981]/10 text-[#10B981]',
  idle:      'bg-[#F8F8F8] text-[#9BA1AE] border border-[#E2E8F0]',
  pending:   'bg-[#F59E0B]/10 text-[#F59E0B]',
  error:     'bg-[#EF4444]/10 text-[#EF4444]',
  auto:      'bg-[#3B82F6]/10 text-[#3B82F6]',
  approval:  'bg-[#2D3748]/10 text-[#2D3748]',
  completed: 'bg-[#10B981]/10 text-[#10B981]',
}

// Badge component
<span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badges[status]}`}>
  {label}
</span>
```

---

## Part 8 — Page-Specific Fixes

### Dashboard
- Remove "Hours Reclaimed", "Content Produced", "Active Services" stat cards
  — they show no real data. Replace with a single "Your workspace" section
  showing: active campaigns count, agents run this week, credits remaining.
- Remove "Talk to Maya" card — Maya is always accessible from sidebar
- Morning digest: filter out `agent = 'maya'` tasks from "What I did" section
- "You're on a free account" nudge: change from gray box to subtle inline text
  below the welcome heading

### Campaigns
- Empty state: full centered page, no card container
  ```tsx
  <div className="flex flex-col items-center justify-center py-32">
    <div className="w-12 h-12 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]
                    flex items-center justify-center mb-4">
      <CampaignsIcon className="w-5 h-5 text-[#9BA1AE]" />
    </div>
    <h3 className="font-semibold text-[#2D3748] mb-1">No campaigns yet</h3>
    <p className="text-sm text-[#9BA1AE] mb-6 text-center max-w-xs">
      Build your first campaign and Maya will create a complete
      week-by-week marketing plan for you.
    </p>
    <button className="px-5 py-2.5 bg-[#2D3748] text-white text-sm
                       font-medium rounded-xl hover:bg-[#1a2535]">
      Build your first campaign
    </button>
  </div>
  ```

### Billing / Credit top-up
- Selected package: `border-2 border-[#3B82F6] bg-blue-50/30` — not `bg-black`
- Buy button: primary button `bg-[#2D3748]` — not orange
- "Popular" badge: `bg-[#3B82F6]/10 text-[#3B82F6]` — not orange/black

### Agent Command Center
- Agent scorecard "Idle" badges: use badge system above
- "Auto" badge: `bg-[#3B82F6]/10 text-[#3B82F6]`
- "Approval" badge: `bg-[#2D3748]/10 text-[#2D3748]`
- Empty state in Live Activity — remove robot emoji, use SVG icon

### Foundation
- Progress bar: already green `#10B981` — keep
- Per-field score percentages: green when >70, amber when 50-70, red when <50
- Section labels: `text-[#9BA1AE]` uppercase tracking-widest

### Brand Kit
- Tab active state: `bg-[#2D3748] text-white` — keep (already correct)
- Tab inactive: `text-[#9BA1AE] hover:text-[#2D3748]`
- Completion score: `text-[#10B981]` for 100%, `text-[#3B82F6]` for partial

### Morning Digest
- Maya avatar: `bg-[#2D3748]` not black
- "Do this with Maya →": `text-[#3B82F6]` not orange
- Agent name labels: `text-[#9BA1AE]` small caps

### Pricing page
- Plan card selected: `border-2 border-[#3B82F6]`
- "Most popular" badge: `bg-[#3B82F6] text-white`
- CTA buttons: `bg-[#2D3748]` primary, `bg-[#3B82F6]` for featured plan
- Annual toggle: `bg-[#3B82F6]` when active

### Admin pages
- Client health status dots:
  - Healthy: `#10B981`
  - Drifting: `#F59E0B`
  - At risk: `#EF4444`
- Plan badges: Starter `bg-[#F8F8F8]`, Growth `bg-[#3B82F6]/10 text-[#3B82F6]`,
  ProAgent `bg-[#2D3748]/10 text-[#2D3748]`

---

## Part 9 — Hamburger Menu (Contextual Page Actions)

The ☰ hamburger in the canvas header is currently non-functional.
Replace with a contextual actions dropdown per page.

```tsx
// In the canvas header, replace hamburger with:
<ContextMenu pageName={currentPage} />
```

```tsx
const PAGE_ACTIONS: Record<string, { label: string; action: string }[]> = {
  dashboard:    [
    { label: 'Refresh digest',      action: 'refresh-digest' },
    { label: 'Customize dashboard', action: 'customize' },
  ],
  campaigns:    [
    { label: 'Sort by newest',  action: 'sort-newest' },
    { label: 'Sort by oldest',  action: 'sort-oldest' },
    { label: 'Archive all',     action: 'archive-all' },
  ],
  'brand-kit':  [
    { label: 'Export brand guide', action: 'export' },
    { label: 'Share with team',    action: 'share' },
  ],
  foundation:   [
    { label: 'Export Foundation', action: 'export' },
    { label: 'Reset Foundation',  action: 'reset' },
  ],
  agents:       [
    { label: 'Pause all agents',    action: 'pause-all' },
    { label: 'View run history',    action: 'history' },
  ],
  analytics:    [
    { label: 'Export report',   action: 'export' },
    { label: 'Refresh data',    action: 'refresh' },
  ],
}

function ContextMenu({ pageName }: { pageName: string }) {
  const actions = PAGE_ACTIONS[pageName] ?? []
  if (!actions.length) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg text-[#9BA1AE] hover:text-[#2D3748]
                   hover:bg-[#F8F8F8] transition-colors"
      >
        <MoreHorizontalIcon className="w-5 h-5" />  {/* use ... not hamburger */}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl
                        border border-[#E2E8F0] shadow-md py-1 min-w-[160px] z-10">
          {actions.map(action => (
            <button
              key={action.action}
              onClick={() => handleAction(action.action)}
              className="w-full text-left px-4 py-2 text-sm text-[#2D3748]
                         hover:bg-[#F8F8F8] transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

Change the icon from ☰ (hamburger) to `...` (MoreHorizontal) — hamburger
implies navigation, dots imply page actions.

---

## Part 10 — Maya Chat Panel

```tsx
// Panel container
<div className="w-[380px] flex-shrink-0 bg-white border-r border-[#E2E8F0]
                flex flex-col h-screen">

// Panel header
<div className="flex items-center justify-between px-4 py-3
                border-b border-[#E2E8F0]">
  <div className="flex items-center gap-2">
    <div className="w-6 h-6 rounded-lg bg-[#2D3748] flex items-center justify-center">
      <span className="text-white text-xs font-bold">M</span>
    </div>
    <span className="text-sm font-semibold text-[#2D3748]">Maya</span>
    <span className="text-xs text-[#10B981]">online</span>
  </div>
  <button onClick={onClose}
          className="text-[#9BA1AE] hover:text-[#2D3748] transition-colors">
    <XIcon className="w-4 h-4" />
  </button>
</div>

// Message — Maya
<div className="flex gap-3 px-4 py-3">
  <div className="w-6 h-6 rounded-lg bg-[#2D3748] flex items-center
                  justify-center flex-shrink-0 mt-0.5">
    <span className="text-white text-xs font-bold">M</span>
  </div>
  <p className="text-sm text-[#2D3748] leading-relaxed">{message}</p>
</div>

// Message — User
<div className="flex gap-3 px-4 py-3 justify-end">
  <div className="bg-[#2D3748] rounded-2xl rounded-tr-sm px-4 py-2.5
                  max-w-[80%]">
    <p className="text-sm text-white leading-relaxed">{message}</p>
  </div>
</div>

// Input bar
<div className="px-4 py-3 border-t border-[#E2E8F0]">
  <div className="flex items-end gap-2 bg-[#F8F8F8] rounded-xl px-4 py-3
                  border border-[#E2E8F0] focus-within:border-[#9BA1AE]">
    <textarea
      placeholder="Ask Maya anything..."
      className="flex-1 bg-transparent text-sm text-[#2D3748]
                 placeholder:text-[#9BA1AE] resize-none outline-none
                 max-h-32 leading-relaxed"
      rows={1}
    />
    <button className="w-7 h-7 bg-[#2D3748] rounded-lg flex items-center
                       justify-center flex-shrink-0 hover:bg-[#1a2535]
                       transition-colors disabled:opacity-40">
      <ArrowUpIcon className="w-3.5 h-3.5 text-white" />
    </button>
  </div>
  <p className="text-[10px] text-[#9BA1AE] text-center mt-2">
    Maya makes mistakes. Verify important decisions.
  </p>
</div>
```

---

## Part 11 — Typography

All text uses Geist (already the default font in Next.js).

```
Page section label:  10px, font-semibold, tracking-widest, uppercase, #9BA1AE
Page title (h1):     24px, font-semibold, #2D3748
Page subtitle:       14px, font-normal, #9BA1AE
Card title:          15px, font-semibold, #2D3748
Card body:           14px, font-normal, #2D3748
Small label:         12px, font-medium, #9BA1AE
Caption:             11px, font-normal, #CBD5E1
Nav item active:     14px, font-medium, #2D3748
Nav item inactive:   14px, font-normal, #9BA1AE
Nav section label:   10px, font-semibold, tracking-widest, uppercase, #9BA1AE
```

---

## Part 12 — Remove from Codebase

Find and remove or replace:

1. All `text-[#c8522a]` except in logo component
2. All `bg-[#c8522a]` — replace with `bg-[#2D3748]` or `bg-[#3B82F6]`
3. All `border-[#c8522a]` — replace with `border-[#3B82F6]`
4. All `bg-black` on buttons — replace with `bg-[#2D3748]`
5. All emoji characters in JSX string literals and template strings
6. "AI Toolkit" references in any remaining UI
7. The non-functional hamburger ☰ icon — replace with `...` MoreHorizontal

---

## Definition of Done

- [ ] Design tokens in globals.css and tailwind.config
- [ ] Maya system prompt updated — no emoji rule added
- [ ] All orange `#c8522a` removed from UI (logo only exception)
- [ ] All `bg-black` buttons replaced with `bg-[#2D3748]`
- [ ] All selected/active card states use blue border not black fill
- [ ] Page background `#F8F8F8` consistent across all pages
- [ ] Card surface `#F8FAFC` consistent across all pages
- [ ] Button system — 4 variants only, used consistently
- [ ] Badge system — status badges consistent across agents, admin, campaigns
- [ ] Sidebar nav items use correct active/inactive colors
- [ ] Foundation progress bar stays green, sidebar bar turns blue
- [ ] Dashboard stat cards replaced with real data summary
- [ ] Morning digest filters out Maya chat tasks from "What I did"
- [ ] Campaigns empty state — full centered, no card container
- [ ] Billing credit top-up uses blue selected state, navy buy button
- [ ] Agent badges (Auto/Approval/Idle) use new badge system
- [ ] Hamburger replaced with `...` contextual page actions menu
- [ ] Maya chat panel uses new color system
- [ ] Pricing page uses new color system
- [ ] Admin pages use new status dot colors
- [ ] No emoji anywhere in the codebase
- [ ] Visual check: open every page and confirm consistent look
