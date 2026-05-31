# Admin Sidebar Integration — Claude Code Handoff
*Admin experience inside MayaShell*

Read MAYA_CONTEXT.md before starting. Confirm `git remote -v` shows `agent7even-v2`.

---

## Overview

Admins (role = 'admin' or 'owner') get the full Maya client experience PLUS an
additional ADMIN section at the bottom of the sidebar. No separate redirect, no
separate layout — everything lives inside MayaShell.

Three parts: remove old admin redirect, add conditional admin nav section,
wire existing admin pages into MayaShell.

---

## Part 1 — Remove Old Admin Redirect

In `app/dashboard/page.tsx`, remove the admin redirect:

```typescript
// DELETE this block entirely:
if (profile.role === 'admin' || profile.role === 'owner') redirect('/admin')
```

Admins now land in Maya like every other user. The Foundation redirect stays:
```typescript
if (!profile?.foundation_complete) redirect('/foundation')
```

---

## Part 2 — Add Admin Section to DashboardShell Sidebar

In `DashboardShell` (sidebar component), fetch the user's role and conditionally
render an ADMIN section below the ACCOUNT section.

### Fetch role in DashboardShell

```typescript
// DashboardShell is a server component or fetches profile on load
// Add role to the profile select:
const { data: profile } = await supabase
  .from('profiles')
  .select('id, full_name, avatar_url, foundation_score, role')
  .eq('clerk_user_id', userId)
  .single()

const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'
```

### Admin nav section (render only when isAdmin = true)

Add below the ACCOUNT section in the sidebar:

```tsx
{isAdmin && (
  <>
    <div className="px-3 pt-6 pb-1">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
        Admin
      </p>
    </div>
    <nav className="px-2 space-y-0.5">
      <NavItem
        href="/admin/clients"
        icon={<UsersIcon className="w-4 h-4" />}
        label="Clients"
      />
      <NavItem
        href="/admin/revenue"
        icon={<BarChartIcon className="w-4 h-4" />}
        label="Revenue"
      />
      <NavItem
        href="/admin/orders"
        icon={<ClipboardIcon className="w-4 h-4" />}
        label="Orders"
      />
      <NavItem
        href="/admin/inquiries"
        icon={<InboxIcon className="w-4 h-4" />}
        label="Inquiries"
      />
      <NavItem
        href="/admin/settings"
        icon={<SlidersIcon className="w-4 h-4" />}
        label="Admin Settings"
      />
    </nav>
  </>
)}
```

Use the same icon style (thin stroke, w-4 h-4) and NavItem component used
by the rest of the sidebar. Section label "ADMIN" uses same styling as
"OVERVIEW", "YOUR WORKSPACE", "ACCOUNT" labels.

---

## Part 3 — Wire Admin Pages into MayaShell

The existing admin pages at `app/admin/*` currently use their own dark sidebar
layout (`app/admin/layout.tsx`). They need to render inside MayaShell instead.

### Update app/admin/layout.tsx

Replace the existing admin layout with one that simply renders children —
MayaShell is already the root layout and handles the sidebar:

```typescript
// app/admin/layout.tsx
import { requireAdmin } from '@/lib/requireAdmin'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdmin() // still protect all admin routes
  return <>{children}</>
}
```

The old dark sidebar in the admin layout gets removed. MayaShell provides
the navigation for everyone including admins.

### Admin page content styling

Admin pages should match Maya's canvas style — white background, consistent
card styling. Update any pages that use the old dark admin sidebar styles:

- Remove any `bg-[#0d0d0d]` or dark background classes from admin page content
- Use `bg-gray-50` for page background (matches rest of Maya canvas)
- Cards: `bg-white rounded-2xl border border-gray-100 p-6`
- Page title: `text-2xl font-semibold text-gray-900`
- Section labels: `text-xs font-semibold text-gray-400 uppercase tracking-widest`

---

## Part 4 — Admin Command Center (Dashboard)

The existing `/admin` route shows a command center. Update it to be a proper
admin overview page that fits Maya's canvas style.

Route: `/admin` (keep existing, just restyle)

Content to keep:
- Total clients count
- Active plans breakdown (Starter / Growth / ProAgent)
- Recent signups
- Recent orders

Add from this session's work:
- At-risk clients count (from `profiles` where `engagement_score < 30` or
  `last_active_at < 48hrs ago`) — link to `/admin/clients?filter=at_risk`
- Total agent runs this month (from `agent_tasks` count)
- Total API cost this month (from `agent_tasks` sum of `cost_usd`)

Page header:
```tsx
<div className="mb-8">
  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
    Admin
  </p>
  <h1 className="text-2xl font-semibold text-gray-900">Command Center</h1>
  <p className="text-sm text-gray-400 mt-1">
    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
  </p>
</div>
```

---

## Part 5 — Active Page Highlighting

The sidebar NavItem component needs to highlight the active route for admin
pages the same way it does for client pages.

Ensure `usePathname()` matching works for `/admin/*` routes in the NavItem
component — if there's a prefix match check (e.g. `pathname.startsWith(href)`),
admin routes should already work. Verify and fix if not.

---

## Definition of Done

- [ ] Admin redirect removed from `dashboard/page.tsx` — admins land in Maya
- [ ] Admin@agent7even.com logs in → Foundation (if incomplete) → Maya dashboard
- [ ] ADMIN section visible in sidebar when role = admin or owner
- [ ] ADMIN section not visible for role = client
- [ ] All 5 admin nav items link to correct routes
- [ ] `/admin/layout.tsx` stripped of old dark sidebar — uses MayaShell
- [ ] Admin pages styled consistently with Maya canvas (gray-50 bg, white cards)
- [ ] `/admin` command center shows client health + agent cost summary cards
- [ ] Active state highlights correctly for `/admin/*` routes in sidebar
- [ ] Safari test: admin@agent7even.com sees full Maya experience + admin section
- [ ] Chrome test: regular client account does NOT see admin section

