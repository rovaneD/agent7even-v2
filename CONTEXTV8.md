# CONTEXTV8 — Cost Tracking, Admin Cost Screen, Maya Canvas Context
*Snapshot: May 31, 2026*

## What Changed Since CONTEXTV7

Everything in CONTEXTV7 still applies. This version documents the work completed in this session on top of that baseline.

---

## 1. Maya Chat Cost Tracking — Fixed

**Previous state (CONTEXTV7 known gap):** Maya chat bypassed the runner — tokens weren't logged, credits weren't deducted.

**What was broken:** `waitUntil` from `@vercel/functions` was not being used. The code was using `after()` from `next/server`, which was not keeping the Vercel function alive after the response was sent.

**Root cause chain (as diagnosed via numbered trace logs 1–9):**
1. `after()` → replaced with `waitUntil` from `@vercel/functions` ✅
2. Profile fetch using `.single()` → PGRST116 when duplicate profile rows existed → `profile = null` → skipped entire cost block → fell to no-cost fallback
3. Fix: switched both profile fetches (full + fallback) to `.limit(1).order('created_at', { ascending: false })` + `rows?.[0] ?? null`
4. `credit_balances` row missing for test accounts → seeded via SQL

**Final flow in `/api/maya/chat/route.ts`:**
```
auth → profile fetch (.limit(1)) → balance check → foundation docs fetch →
build system prompt → createTask → streamText →
waitUntil( await result.usage → log tokens/cost → deduct credits → ledger )
```

**Key details:**
- `CHAT_CREDITS = CREDIT_COST.light` (2 credits per turn)
- `MAYA_MODEL = 'anthropic/claude-sonnet-4'`
- `job_type: 'maya_chat'` added to `createTask` call for wedge analysis
- `waitUntil` keeps the function alive server-side after HTTP response — stream always completes even if client disconnects

---

## 2. Session Table: chat_sessions → maya_sessions

**Problem:** `app/api/maya/session/route.ts` was referencing `chat_sessions` which didn't exist. The table was manually created as `maya_sessions`.

**Files fixed:**
- `app/api/maya/session/route.ts` — `chat_sessions` → `maya_sessions` in GET and POST handlers
- `app/dashboard/layout.tsx` — `chat_sessions` → `maya_sessions`
- `app/admin/layout.tsx` — `chat_sessions` → `maya_sessions`

**maya_sessions schema:**
```sql
CREATE TABLE maya_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  messages jsonb,
  mode text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);
```

---

## 3. Profile Fetch Safety (.single() → .limit(1))

Multiple layouts were using `.single()` which throws PGRST116 if a user has duplicate profile rows. Fixed all instances to use safe pattern:

```typescript
const { data: profileRows } = await supabase
  .from('profiles')
  .select('...')
  .eq('clerk_user_id', userId)
  .order('created_at', { ascending: false })
  .limit(1)
const p = profileRows?.[0] ?? null
```

**Files fixed:**
- `app/dashboard/layout.tsx` — profile fetch + session fetch (both)
- `app/admin/layout.tsx` — profile fetch + session fetch (both)
- `app/api/maya/chat/route.ts` — full profile fetch + fallback basic fetch

**Root effect:** When `.single()` failed silently, `profile = null`, which meant:
- `isAdmin = false` → admin nav items disappeared from sidebar
- `foundationScore = null` → foundation bar disappeared
- Cost tracking skipped entirely in maya/chat

---

## 4. Cost Instrumentation SQL Migration

**File:** `01_cost_instrumentation.sql` (project root)

```sql
-- New columns on agent_tasks
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS cached_tokens integer NOT NULL DEFAULT 0;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS job_type text;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill
UPDATE agent_tasks SET job_type = 'maya_chat' WHERE agent = 'maya' AND job_type IS NULL;

-- Performance indexes (6 total)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_tasks_user_id      ON agent_tasks(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_tasks_agent         ON agent_tasks(agent);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_tasks_job_type      ON agent_tasks(job_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_tasks_status        ON agent_tasks(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_tasks_created_at    ON agent_tasks(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_tasks_user_month    ON agent_tasks(user_id, created_at DESC);
```

**`v_account_month_cost` view — built this session:**
- LEFT JOINs `profiles` + `agent_tasks` (completed, current month) + `credit_balances`
- CASE on `plan` for MRR ($49 starter / $89 growth / $149 proagent)
- Includes `maya_cost_usd` breakdown (WHERE agent = 'maya')
- Columns: `user_id, company_name, plan, mrr_usd, tasks_this_month, input_tokens, output_tokens, cached_tokens, cost_usd, maya_cost_usd, credits_remaining`

**`createTask()` in `lib/agents/runner.ts` — updated:**
- Added `jobType?: string` to opts interface
- Inserts `job_type: opts.jobType ?? null` into `agent_tasks`

---

## 5. Admin Cost & Usage Screen — /admin/cost

**Files created:**
- `app/api/admin/cost/route.ts` — GET, requires admin, parallel queries
- `app/admin/cost/page.tsx` — server component, requireAdmin, renders CostActivityView
- `app/admin/cost/CostActivityView.tsx` — full client component

**API response shape:**
```typescript
{ accounts: v_account_month_cost[], runs: agent_tasks[], summary: {
  total_mrr, total_cost, total_tasks, active_accounts
}}
```

**CostActivityView — two tabs:**

*Account Overview tab:*
- Summary cards: Monthly MRR, AI Cost, Gross Margin (with % calculated), Active Accounts
- Sortable table: Account, Plan (badge), MRR, Tasks, AI Cost, Margin ($ + %), Credits
- Credits column turns red when balance < 20
- `fmt$()` helper: shows `<$0.01` for tiny values, 4 decimal places under $1

*Run Log tab:*
- Filter: All / Completed / Failed
- Columns: Time, Account, Job (monospace badge for job_type), Model (provider prefix stripped), Tokens in/out (abbreviated to k), Cost, Status badge
- Last 100 runs

**Nav:** `{ href: '/admin/cost', label: 'Cost & Usage', icon: BarChart2 }` added to admin sidebar in DashboardShell.

---

## 6. Foundation Documents Lost + Recovery

**What happened:** Profile deduplication SQL from a prior session deleted the profile row that held `foundation_answers` (JSONB) and kept a row that had `foundation_score = null`. The `foundation_documents` table had no rows — documents were either under the deleted profile ID or never linked to surviving IDs.

**Diagnosis SQL used:**
```sql
SELECT p.email, p.id as profile_id, fd.type, length(fd.markdown) as doc_length
FROM profiles p LEFT JOIN foundation_documents fd ON fd.user_id = p.id
WHERE p.email IN ('admin@agent7even.com', 'rovane@dursodesign.com');
-- All rows returned NULL for type/doc_length
```

**Recovery path taken:**
1. Manually set `foundation_score` via SQL (to restore sidebar display)
2. Set `foundation_complete = true` + `foundation_answers = '{}'::jsonb` (to unlock editor)
3. Built the auto-regenerate feature (see §7) so rescoring creates fresh documents

**Remaining:** Both accounts need to re-fill Foundation answers via `/dashboard/foundation` and rescore to fully rebuild Maya's context.

---

## 7. Foundation Rescore Now Regenerates Documents

**Previous state:** `/dashboard/foundation` FoundationEditor only called `POST /api/foundation/score` on rescore. Documents were only generated during the initial onboarding flow at `/foundation`.

**Fix:** `handleRescore()` in `FoundationEditor.tsx` now fires `POST /api/foundation/generate` in the background after scoring completes.

**Implementation:**
```typescript
// After score API returns:
const splitToArray = (s: string) => s ? s.split(',').map(x => x.trim()).filter(Boolean) : []
const adaptedAnswers = {
  ...answers,
  competitors: splitToArray(answers.competitors),  // string → array
  toneTraits:  splitToArray(answers.toneTraits),
  channels:    splitToArray(answers.channels),
}
setGenerating(true)
fetch('/api/foundation/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ answers: adaptedAnswers, companyName }),
})
  .catch(err => console.error('[foundation] doc generation failed:', err))
  .finally(() => setGenerating(false))
```

**UX:** Shows "Updating Maya's context…" with spinner while generation runs (~20–30s). Score button stays fast — generation is fire-and-forget.

**Why conversion needed:** FoundationEditor stores all fields as strings (comma-separated). The generate API expects `competitors`, `toneTraits`, `channels` as arrays.

---

## 8. Maya Canvas Context System

**The problem:** Maya knew she was "on the Foundation page" but couldn't see the actual content of any page. She couldn't see form answers, scores, campaigns, tickets, team members, etc.

**Architecture:** Custom event system — pages broadcast their content, Maya reads it per-request.

### Event
```typescript
window.dispatchEvent(new CustomEvent('maya:canvas-context', {
  detail: { context: string }  // formatted plain-text description of page state
}))
```

### Flow
```
Page component dispatches event on mount (and on state changes)
  → DashboardShell listens, stores in canvasData state
  → clears on pathname change (navigate away)
  → passes canvasData prop to MayChatPanel
    → stored in canvasDataRef (useRef)
    → useEffect keeps ref current when prop changes
    → custom fetch interceptor on DefaultChatTransport reads ref.current per-request
    → injects canvasData into every POST body sent to /api/maya/chat
      → maya/chat route uses canvasData in system prompt (full PAGE CONTEXT section)
```

### Key implementation detail — stable transport
`DefaultChatTransport` is memoized with `[]` deps — never recreated, chat history never resets. `canvasData` is injected via a custom `fetch` function that reads from a ref, not from closure:

```typescript
const canvasDataRef = useRef(canvasData)
useEffect(() => { canvasDataRef.current = canvasData }, [canvasData])

const transport = useMemo(() => new DefaultChatTransport({
  api: '/api/maya/chat',
  body: { canvasContext },
  fetch: async (url, init) => {
    const body = JSON.parse((init?.body as string) ?? '{}')
    if (canvasDataRef.current) body.canvasData = canvasDataRef.current
    return fetch(url, { ...init, body: JSON.stringify(body) })
  },
}), [])
```

### System prompt in maya/chat route
```typescript
const canvasSection = canvasData
  ? `\nPAGE CONTEXT — what the user is currently looking at:\n${canvasData}`
  : canvasContext
    ? `\nCANVAS CONTEXT:\nThe user is currently on the ${canvasContext} page.`
    : ''
```

### Shared component for server pages
`components/maya/CanvasContextDispatcher.tsx` — client component that takes a `context` string as prop and dispatches the event on mount. Used by server-only pages that can't use `useEffect` directly.

```tsx
'use client'
import { useEffect } from 'react'
export default function CanvasContextDispatcher({ context }: { context: string }) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context } }))
  }, [context])
  return null
}
```

### Pages wired (dashboard)
| Page | Method | What Maya sees |
|---|---|---|
| Dashboard | CanvasContextDispatcher | Company name, plan status |
| Agents | useEffect in AgentCommandCenter | Active/pending task counts, agent scorecard |
| Campaigns | CanvasContextDispatcher | Full campaign list with mode/status |
| Services | useEffect in ServicesClient | Active orders, available services |
| Calendar | CanvasContextDispatcher | "Coming soon" notice |
| Brand Kit | useEffect in BrandKitClient | Documents list, questionnaire state |
| Analytics | useEffect in AnalyticsClient | GA/Meta connection status |
| Deliverables | useEffect in DeliverablesClient | Projects with file counts |
| Support | useEffect in SupportClient | Ticket list with status/priority |
| Notifications | useEffect in NotificationsClient | Unread count, recent item titles |
| Team | useEffect in TeamClient | Seats used/included, member list |
| Billing | useEffect in BillingClient | Plan, status, recent invoices |
| Settings | useEffect in SettingsClient | All profile field values |
| Foundation | useEffect in FoundationEditor | Score, every answer field value, weak areas |

Foundation also re-dispatches after every rescore (new score + updated weak fields).

### Pages wired (admin)
| Page | Method | What Maya sees |
|---|---|---|
| Admin home | CanvasContextDispatcher | Command center totals, pending orders |
| Clients list | useEffect in ClientHealthView | All clients: name, plan, scores, last active |
| Client detail | useEffect in ClientDetail | Client profile, orders, tickets |
| Cost & Usage | useEffect in CostActivityView | Summary totals, top accounts by cost |
| Inquiries | CanvasContextDispatcher | Active/closed counts, project names |
| Inquiry detail | useEffect in AdminInquiryDetail | Project, client, status, timeline, budget |
| Orders | CanvasContextDispatcher | Active/completed breakdown |
| Revenue | CanvasContextDispatcher | MRR, ARR, plan breakdown |
| Admin Agent Costs | useEffect in AdminAgentCosts | Cost by model, recent orchestrations |
| Admin Settings | useEffect in AdminSettingsClient | All settings state |
| Support list | CanvasContextDispatcher | Ticket list with open/closed |
| Support thread | useEffect in AdminSupportThread | Subject, client, status, latest message |

---

## 9. Files Created / Modified This Session

### New files
| File | Purpose |
|---|---|
| `app/api/admin/cost/route.ts` | Admin cost API — queries v_account_month_cost + recent agent_tasks |
| `app/admin/cost/page.tsx` | Admin cost page — server component |
| `app/admin/cost/CostActivityView.tsx` | Full client component — account overview + run log tabs |
| `components/maya/CanvasContextDispatcher.tsx` | Shared client component for server pages to dispatch canvas context |
| `01_cost_instrumentation.sql` | SQL migration — new columns, indexes, v_account_month_cost view |

### Modified files
| File | What changed |
|---|---|
| `app/api/maya/chat/route.ts` | waitUntil, limit(1) profile fetch, job_type, canvasData in system prompt |
| `app/api/maya/session/route.ts` | chat_sessions → maya_sessions |
| `app/dashboard/layout.tsx` | limit(1) profile fetch, maya_sessions |
| `app/admin/layout.tsx` | limit(1) profile fetch, maya_sessions |
| `app/dashboard/DashboardShell.tsx` | canvasData state, maya:canvas-context listener, Cost & Usage admin nav item |
| `components/maya/MayChatPanel.tsx` | canvasData prop, canvasDataRef, custom fetch interceptor |
| `app/dashboard/foundation/FoundationEditor.tsx` | Post-rescore document generation, canvas context dispatch |
| `lib/agents/runner.ts` | jobType field in createTask |
| All 13 dashboard page components | canvas context dispatch |
| All 12 admin page components | canvas context dispatch |

---

## 10. Work Queue — Updated Status

| # | Item | Status |
|---|---|---|
| 1 | canvasContext in Maya system prompt | ✅ DONE (V7) |
| 2 | Agent Constraints | ✅ DONE (V7) |
| 3 | Foundation validation | ✅ DONE (V7) |
| 4 | Stealth churn tracking | ✅ DONE (V7) |
| 5 | Admin sidebar + client 360 | ✅ DONE (V7) |
| 6 | Segment-first campaign creation | ✅ DONE (V7) |
| 7 | Maya cost tracking (waitUntil + tokens) | ✅ DONE (V8) |
| 8 | Admin Cost & Usage screen | ✅ DONE (V8) |
| 9 | Maya full page context (all pages) | ✅ DONE (V8) |
| 10 | Foundation rescore regenerates docs | ✅ DONE (V8) |
| 11 | Morning digest on Dashboard | 🟡 NEXT |
| 12 | Segment-first campaign creation improvements | 🟡 |
| 13 | Agent names audit | 🟢 Quick win |
| 14 | Credit top-up (Stripe checkout mid-month) | 🟡 |
| 15 | Orchestration progress UI | 🟡 |
| 16 | Approval queue UI | 🟡 |
| 17 | Rebuild Foundation content (both accounts) | ⚠️ Data recovery — fill form + rescore |
| 18 | Profile dedup (still 2 rows/account) | ⚠️ Run dedup SQL |
| 19 | Merge to production | 🔴 After validation |
