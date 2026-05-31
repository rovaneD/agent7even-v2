# Admin Client 360 — Claude Code Handoff
*Full user management for admin panel*

Read MAYA_CONTEXT.md before starting. Confirm `git remote -v` shows `agent7even-v2`.

---

## Overview

Replace the current `/admin/clients` table with a full client management system.
Two parts: the client list page (search, filter, inline actions) and the client
detail page (360 view, two-panel layout, 6 tabs).

---

## Part 1 — Schema Additions

Run in Supabase SQL Editor:

```sql
-- Admin notes already exists — verify columns match
-- If not: create it
CREATE TABLE IF NOT EXISTS admin_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  body       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Email log — track admin-initiated emails to clients
CREATE TABLE IF NOT EXISTS admin_email_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  subject     text NOT NULL,
  body        text NOT NULL,
  sent_at     timestamptz DEFAULT now()
);

-- Index for client detail lookups
CREATE INDEX IF NOT EXISTS idx_admin_notes_user 
  ON admin_notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_email_log_user
  ON admin_email_log(user_id, sent_at DESC);
```

---

## Part 2 — Updated Client List Page

Update `app/admin/clients/page.tsx`:

### Layout
- Page title: "Client Health" (keep) with client count
- Search bar at top — searches `full_name` and `email`
- Filter row: Plan (All / Starter / Growth / ProAgent) + Status (All / Active / Onboarding / Suspended)
- Tabs: All clients | At risk (with count badge)
- Sortable columns: CLIENT, PLAN, LAST ACTIVE, ENGAGEMENT, FOUNDATION, STATUS, JOINED

### Table columns (updated)
| Column | Content |
|---|---|
| CLIENT | Avatar + full name + email |
| COMPANY | Company name + Instagram handle (if set) |
| PLAN | Badge (Starter/Growth/ProAgent/—) |
| LAST ACTIVE | Relative time |
| ENGAGEMENT | Mini bar + score number |
| FOUNDATION | Mini bar + score number |
| STATUS | Dot + label (Healthy/Drifting/At Risk) |
| JOINED | Date |
| ACTIONS | ••• menu |

### Row actions menu (••• on hover)
```
View profile →
Send Maya nudge
Send email
──────────────
Change plan
Suspend account
```

### Clicking a row → navigates to `/admin/clients/[id]`

### API update: `app/api/admin/clients/route.ts`
Add to SELECT:
```typescript
.select(`
  id, full_name, email, avatar_url,
  company_name, website_url, instagram_handle,
  plan, status, role,
  last_active_at, engagement_score, foundation_score,
  created_at
`)
```

Add search param handling:
```typescript
const search = searchParams.get('search')
const planFilter = searchParams.get('plan')
const statusFilter = searchParams.get('status')

if (search) {
  query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
}
if (planFilter && planFilter !== 'all') {
  query = query.eq('plan', planFilter)
}
```

---

## Part 3 — Client Detail Page

Create `app/admin/clients/[id]/page.tsx` — full 360 view.

### Page layout

```
┌──────────────────────────┬─────────────────────────────────────────┐
│   LEFT PANEL (380px)     │   RIGHT PANEL (flex-1)                  │
│                          │                                          │
│   Identity card          │   Tabs:                                  │
│   Health scores          │   Activity | Billing | Team |            │
│   Quick actions          │   Foundation | Notes | Support           │
│                          │                                          │
└──────────────────────────┴─────────────────────────────────────────┘
```

### Left panel — Identity card

```tsx
<div className="w-[380px] flex-shrink-0 space-y-4">

  {/* Identity */}
  <div className="bg-white rounded-2xl border border-gray-100 p-6">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <Avatar src={client.avatar_url} name={client.full_name} size={48} />
        <div>
          <h2 className="font-semibold text-gray-900">{client.full_name}</h2>
          <p className="text-sm text-gray-400">{client.email}</p>
        </div>
      </div>
      <StatusDot status={derivedStatus} />
    </div>

    {/* Company details */}
    <div className="space-y-2 pt-4 border-t border-gray-100">
      {client.company_name && (
        <DetailRow icon={<BuildingIcon />} label="Company" value={client.company_name} />
      )}
      {client.website_url && (
        <DetailRow icon={<GlobeIcon />} label="Website" value={client.website_url} link />
      )}
      {client.instagram_handle && (
        <DetailRow icon={<HashIcon />} label="Instagram" value={`@${client.instagram_handle}`} />
      )}
      <DetailRow icon={<CalendarIcon />} label="Joined" value={formatDate(client.created_at)} />
      <DetailRow icon={<ClockIcon />} label="Last active" value={formatRelative(client.last_active_at)} />
    </div>

    {/* Plan + Role badges */}
    <div className="flex gap-2 pt-4 border-t border-gray-100 mt-4">
      <PlanBadge plan={client.plan} />
      <RoleBadge role={client.role} />
    </div>
  </div>

  {/* Health scores */}
  <div className="bg-white rounded-2xl border border-gray-100 p-6">
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
      Health
    </h3>
    <div className="space-y-4">
      <ScoreRow label="Engagement" score={client.engagement_score} />
      <ScoreRow label="Foundation" score={client.foundation_score} />
      <ScoreRow label="Credits remaining" score={creditBalance} max={planMax} unit="cr" />
    </div>
  </div>

  {/* Quick actions */}
  <div className="bg-white rounded-2xl border border-gray-100 p-6">
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
      Actions
    </h3>
    <div className="space-y-2">
      <ActionButton icon={<MailIcon />} label="Send email" onClick={() => setShowEmailModal(true)} />
      <ActionButton icon={<BellIcon />} label="Send Maya nudge" onClick={handleSendNudge} />
      <ActionButton icon={<ZapIcon />} label="Change plan" onClick={() => setShowPlanModal(true)} />
      <ActionButton icon={<ShieldIcon />} label="Change role" onClick={() => setShowRoleModal(true)} />
      <ActionButton
        icon={<BanIcon />}
        label={client.status === 'suspended' ? 'Reactivate account' : 'Suspend account'}
        onClick={handleToggleSuspend}
        variant={client.status === 'suspended' ? 'default' : 'danger'}
      />
      <ActionButton
        icon={<RefreshIcon />}
        label="Reset Foundation"
        onClick={handleResetFoundation}
        variant="danger"
      />
    </div>
  </div>

</div>
```

### Right panel — Tabs

#### Tab 1: Activity
```typescript
// Fetch from client_activity_log
// Show: event type icon, description, timestamp
// Group by day
// Show last 50 events, paginate

const activityDescriptions: Record<string, string> = {
  page_view:          'Viewed {metadata.page}',
  maya_message:       'Sent a message to Maya',
  agent_run:          'Ran {metadata.agentId} agent',
  agent_approved:     'Approved agent output',
  campaign_created:   'Created a campaign',
  foundation_updated: 'Updated Foundation answers',
  brand_kit_updated:  'Edited Brand Kit',
  analytics_viewed:   'Viewed Analytics',
}
```

Table columns: EVENT, DESCRIPTION, TIME

#### Tab 2: Billing
```typescript
// Fetch from Stripe via existing billing logic
// Show:
// - Current plan card (name, price, next billing date)
// - Credit balance card (balance, lifetime used)
// - Invoice table (date, amount, status, download link)
// - Stripe customer ID (copyable, for support)
// - Manual plan override button → updates profiles.plan in DB only
```

Manual plan override modal:
```tsx
<select value={overridePlan} onChange={e => setOverridePlan(e.target.value)}>
  <option value="starter">Starter</option>
  <option value="growth">Growth</option>
  <option value="proagent">ProAgent</option>
</select>
<p className="text-xs text-gray-400 mt-2">
  This updates the DB only — does not affect Stripe billing.
</p>
```

#### Tab 3: Team
```typescript
// Fetch from team_members table joined with profiles
// Show: avatar, name, email, role, permissions, joined date
// No edit from here — view only for admin
```

Table columns: MEMBER, EMAIL, ROLE, PERMISSIONS, JOINED

#### Tab 4: Foundation
```typescript
// Show foundation_answers from profiles (jsonb)
// Grouped by step — same layout as /dashboard/foundation
// Read-only view for admin
// Show foundation_score + per-field scores from foundation_field_scores
// Show last scored date

// Also show the 5 generated documents if they exist
// (from brand_kit_documents or wherever foundation docs are stored)
```

#### Tab 5: Notes
```typescript
// Fetch from admin_notes where user_id = client.id
// Show: admin avatar, note body, timestamp
// Add note form at top — textarea + submit
// Notes are admin-only, never visible to client
```

```tsx
{/* Add note */}
<div className="bg-gray-50 rounded-xl p-4 mb-6">
  <textarea
    value={newNote}
    onChange={e => setNewNote(e.target.value)}
    placeholder="Add an internal note..."
    rows={3}
    className="w-full bg-transparent text-sm resize-none outline-none"
  />
  <div className="flex justify-end mt-2">
    <button
      onClick={handleAddNote}
      disabled={!newNote.trim()}
      className="text-sm font-medium bg-black text-white px-4 py-2 rounded-xl disabled:opacity-40"
    >
      Add note
    </button>
  </div>
</div>

{/* Notes list */}
{notes.map(note => (
  <div key={note.id} className="flex gap-3 py-4 border-b border-gray-100 last:border-0">
    <Avatar src={note.admin?.avatar_url} size={32} />
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium">{note.admin?.full_name}</span>
        <span className="text-xs text-gray-400">{formatRelative(note.created_at)}</span>
      </div>
      <p className="text-sm text-gray-700">{note.body}</p>
    </div>
  </div>
))}
```

#### Tab 6: Support
```typescript
// Fetch from support_tickets where user_id = client.id
// Show open and closed tickets
// Click ticket → opens thread view inline (same pattern as /dashboard/support)
// Admin can reply, change status, change priority from here
```

---

## Part 4 — Action Modals

### Send email modal
```tsx
<Modal title="Send email to {client.full_name}">
  <input
    placeholder="Subject"
    value={subject}
    onChange={e => setSubject(e.target.value)}
    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3"
  />
  <textarea
    placeholder="Message"
    value={body}
    onChange={e => setBody(e.target.value)}
    rows={6}
    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none"
  />
  <div className="flex gap-3 mt-4">
    <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm">
      Cancel
    </button>
    <button onClick={handleSendEmail} className="flex-1 py-3 bg-black text-white rounded-xl text-sm font-medium">
      Send email
    </button>
  </div>
</Modal>
```

API route: `POST /api/admin/clients/[id]/email`
```typescript
// Uses Resend to send email to client
// Logs to admin_email_log table
// Returns { ok: true }
```

### Change plan modal
```tsx
<Modal title="Change plan">
  <p className="text-sm text-gray-500 mb-4">
    Current plan: <strong>{client.plan}</strong>
  </p>
  {['starter', 'growth', 'proagent'].map(plan => (
    <button
      key={plan}
      onClick={() => setSelectedPlan(plan)}
      className={`w-full text-left px-4 py-3 rounded-xl border mb-2 text-sm font-medium capitalize
        ${selectedPlan === plan ? 'border-black bg-black text-white' : 'border-gray-200'}`}
    >
      {plan}
    </button>
  ))}
  <p className="text-xs text-gray-400 mt-2">Updates DB only — does not affect Stripe.</p>
  <button onClick={handleChangePlan} className="w-full mt-4 py-3 bg-black text-white rounded-xl text-sm font-medium">
    Confirm change
  </button>
</Modal>
```

API route: `POST /api/admin/clients/[id]/update`
```typescript
// Accepts: { plan?, role?, status? }
// Updates profiles table
// Returns updated profile
```

### Reset Foundation confirmation
```tsx
<Modal title="Reset Foundation?" variant="danger">
  <p className="text-sm text-gray-600 mb-6">
    This will set foundation_complete to false and foundation_score to 0.
    The client will be redirected through Foundation on next login.
    Their existing answers will be preserved.
  </p>
  <div className="flex gap-3">
    <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm">
      Cancel
    </button>
    <button onClick={handleResetFoundation}
      className="flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-medium">
      Reset Foundation
    </button>
  </div>
</Modal>
```

---

## Part 5 — API Routes

### `GET /api/admin/clients/[id]`
Returns full client data for detail page:
```typescript
// profiles row (all columns)
// credit_balances row
// team_members count
// support_tickets (open count)
// recent activity (last 10 from client_activity_log)
// foundation_field_scores
// admin_notes (last 5)
```

### `POST /api/admin/clients/[id]/update`
Updates plan, role, or status on profiles table.

### `POST /api/admin/clients/[id]/nudge`
Inserts notification row for client (same as manual nudge from list page).

### `POST /api/admin/clients/[id]/email`
Sends email via Resend, logs to admin_email_log.

### `POST /api/admin/clients/[id]/notes`
Inserts new admin note.

### `POST /api/admin/clients/[id]/reset-foundation`
Sets `foundation_complete = false`, `foundation_score = 0` on profile.

---

## Part 6 — Duplicate Account Handling

Rovane Durso appears twice in the client list (two profile rows, same email).
Add a "Duplicates detected" banner at the top of the client list when the same
email appears more than once:

```tsx
{duplicates.length > 0 && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <AlertIcon className="w-4 h-4 text-yellow-600" />
      <p className="text-sm text-yellow-800">
        {duplicates.length} duplicate email{duplicates.length > 1 ? 's' : ''} detected
      </p>
    </div>
    <button
      onClick={() => setShowDuplicates(true)}
      className="text-sm font-medium text-yellow-800 underline"
    >
      Review
    </button>
  </div>
)}
```

Duplicate resolution — on client detail page, if duplicate exists:
- Show "Duplicate account detected" warning card in left panel
- "Deactivate this account" button → sets status = 'suspended'
- No merge (too complex for now — deactivation is sufficient)

---

## Definition of Done

- [ ] Client list has search bar (name/email)
- [ ] Client list has plan + status filter dropdowns
- [ ] Client list table shows company name + Instagram handle column
- [ ] Row hover shows ••• actions menu (view, nudge, email, change plan, suspend)
- [ ] Clicking row navigates to `/admin/clients/[id]`
- [ ] Client detail page loads with two-panel layout
- [ ] Left panel: identity card with all company details
- [ ] Left panel: health scores (engagement, foundation, credits)
- [ ] Left panel: all 6 quick action buttons functional
- [ ] Right panel: Activity tab shows paginated activity log
- [ ] Right panel: Billing tab shows plan + invoices + manual override
- [ ] Right panel: Team tab shows team members
- [ ] Right panel: Foundation tab shows answers + scores read-only
- [ ] Right panel: Notes tab — add note + list notes working
- [ ] Right panel: Support tab shows tickets with reply capability
- [ ] Send email modal sends via Resend + logs to admin_email_log
- [ ] Change plan modal updates DB
- [ ] Suspend/reactivate toggles status
- [ ] Reset Foundation sets foundation_complete = false
- [ ] Duplicate banner shows when same email appears twice
- [ ] All API routes protected by requireAdmin()
- [ ] SQL migration run for admin_email_log table

