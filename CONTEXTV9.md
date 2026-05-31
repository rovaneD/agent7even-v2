# CONTEXTV9 — Approval Queue, Public Pricing Page, Billing Features
*Snapshot: May 31, 2026 (session 3)*

## What Changed Since CONTEXTV8

Everything in CONTEXTV8 still applies. This version documents the work completed in this continued session on top of that baseline.

---

## 1. Approval Queue — Full Build

### SQL migration: `02_approval_queue.sql`

Run in Supabase SQL editor before deploying:

```sql
ALTER TABLE agent_tasks
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by      uuid REFERENCES profiles(id);

ALTER TABLE agent_outputs
  ADD COLUMN IF NOT EXISTS feedback        text,
  ADD COLUMN IF NOT EXISTS feedback_note   text,
  ADD COLUMN IF NOT EXISTS feedback_at     timestamptz;
```

**What these are for:**
- `rejection_reason` — structured rejection label (from the quick-chip selection, e.g. "Off-brand tone")
- `reviewed_at` / `reviewed_by` — audit trail: who reviewed and when (both approve and reject)
- `feedback` — the structured reason label on the output side (same as rejection_reason, kept symmetrically)
- `feedback_note` — the freetext note sent to the agent for re-run context
- `feedback_at` — when feedback was recorded on the output

### New page: `/dashboard/agents/approvals`

**Files:**
- `app/dashboard/agents/approvals/page.tsx` — server component, Suspense wrapper
- `app/dashboard/agents/approvals/ApprovalsClient.tsx` — full client component

**Features:**
- `hasReviewedOne` mechanic — checkboxes are locked until at least one item has been expanded. Prevents rubber-stamping. State is set by `onMarkReviewed` callback fired on first expand.
- `?task={id}` query param — auto-expands and scrolls to that specific item on load. Used by morning digest deep-links.
- Per-item: expand/collapse, 6 quick rejection chips, Approve / Edit & approve / Reject & redo buttons
- When "Reject & redo" clicked: rejection note textarea appears inline. Chip selection pre-fills it.
- Edit mode: textarea replaces read-only view, "Save edits & approve" sends `editedContent` to approve route
- Agent filter dropdown (only shown when >1 agent in queue)
- Sort: newest first / oldest first
- Select all / deselect all (only active after `hasReviewedOne`)
- Bulk action bar appears when ≥1 item checked: "Approve all" (direct) + "Reject all" (shows rejection note input)
- Maya canvas context dispatched on mount with pending count

**Quick rejection chips (6):**
| Label | Note sent to agent |
|---|---|
| Off-brand tone | "The tone doesn't match our brand voice. Please rewrite to feel more on-brand." |
| Inaccurate info | "This contains inaccurate or outdated information. Please fact-check and rewrite." |
| Too long | "This is too long. Please condense to the key points." |
| Too aggressive | "The tone is too salesy/aggressive. Make it more conversational and helpful." |
| Wrong format | "The format is incorrect for this use case. Please follow the standard format." |
| Needs more detail | "This needs more depth and specificity. Please expand with relevant details." |

### New API routes

**`GET /api/agents/approvals`**
Returns `{ tasks: AgentTask[] }` — pending approval tasks for the authenticated user with `agent_outputs` joined. Equivalent query to what agents/page.tsx uses: `requires_approval=true`, `status='complete'`, `approved_at IS NULL`, `rejected_at IS NULL`.

**`POST /api/agents/approvals/bulk`**
Body: `{ action: 'approve' | 'reject', taskIds: string[], feedback?: string, feedbackNote?: string }`

- **Approve:** updates `agent_tasks` (approved_at, reviewed_at, reviewed_by) + `agent_outputs` (status=approved, approved_at) for all matching task IDs
- **Reject:** updates both tables with rejection fields, then re-queues each task with `rejection_feedback` in input

### Updated: approve route (`/api/agents/tasks/[id]/approve`)

Changes:
- Fixed `.single()` → `.limit(1)` on content fetch for editedContent path
- Added `reviewed_at: now, reviewed_by: profile.id` to `agent_tasks` update

### Updated: reject route (`/api/agents/tasks/[id]/reject`)

Changes (complete rewrite):
- Fixed `.single()` → `.limit(1)` on profile fetch
- Accepts `{ outputId, note, feedback, feedbackNote }` — `feedback` is the structured reason, `feedbackNote` is the freetext
- Updates `agent_outputs` with `feedback`, `feedback_note`, `feedback_at`
- Updates `agent_tasks` with `rejection_note` (compat), `rejection_reason` (new), `reviewed_at`, `reviewed_by`
- Re-queues only when `rejectionText` is present (same behavior as before)

### DashboardShell — sidebar badge and sub-item

Props added: `pendingApprovalsCount?: number`

When `pendingApprovalsCount > 0`:
- `#c8522a` badge with count number renders on the Agents nav item (right side)
- "Approvals" sub-item renders below Agents with brand orange dot + count label
- Sub-item is active when `pathname.startsWith('/dashboard/agents/approvals')`

### layout.tsx — approval count fetch

Added to the parallel `Promise.all` in `app/dashboard/layout.tsx`:

```typescript
supabase
  .from('agent_tasks')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', p.id)
  .eq('requires_approval', true)
  .eq('status', 'complete')
  .is('approved_at', null)
  .is('rejected_at', null)
```

Count passed as `pendingApprovalsCount` prop to `DashboardShell`.

### AgentCommandCenter — Zone 1 banner

Old inline approval queue removed entirely. Replaced with:

- **If pending > 0:** Amber-tinted banner card linking to `/dashboard/agents/approvals`. Shows count circle, agent names preview (up to 3), "Review →" CTA.
- **If queue clear:** Minimal grey card with "Queue is clear — nothing waiting for review".

Removed state: `approving`, `rejecting`, `rejectNote`, `rejectTarget`, `expanded`, `editingId`, `editContent` — all review logic now lives in ApprovalsClient.

### Morning digest — deep-link

`approvalItems` in `app/api/digest/generate/route.ts` now include:
```typescript
reviewUrl: `/dashboard/agents/approvals?task=${task.id}`
```

This allows any morning digest UI to render a direct "Review →" link that auto-expands the specific item on the approval queue page.

---

## 2. Public Pricing Page — `/pricing`

**File:** `app/pricing/page.tsx`

**What it is:** Public, unauthenticated marketing page for plan selection. Dark theme (`#0d0d0d` background). Three-column plan cards, monthly/annual toggle, 16-row compare table, 8-item FAQ accordion.

### CTA behavior
- **Unauthenticated:** Direct navigation to `/sign-up?plan=X` — no API call, no loading state
- **Authenticated:** Stripe checkout via `POST /api/stripe/checkout` then redirect to session URL
- **isLoaded check:** Uses `useAuth()` from Clerk with an `isLoaded` guard before rendering nav auth state — avoids hydration flash

### Plans on page
| Plan | Monthly | Annual | Trial |
|---|---|---|---|
| Starter | $49/mo | $490/yr | 3-day free trial |
| Growth | $89/mo | $890/yr | — |
| ProAgent | $149/mo | $1,490/yr | — |

### Compare table (16 rows)
Maya chat, Foundation, Brand Kit, Campaigns, Credits/month, All 9 agents, Morning digest, Analytics, Service requests, Team seats, Support, Add-on discount, Quarterly strategy review, White-glove onboarding, 3-day free trial, Annual billing

### FAQ (8 items)
Credits, 3-day trial mechanics, cancellation policy, service requests, credit rollover, annual billing, team seats ($15/mo/extra), contracts

### Design
- `#0d0d0d` background, white cards, `#c8522a` accent
- Monthly/annual toggle with "−2mo" badge
- "Most popular" banner on Growth
- FAQ accordion: one open at a time, Plus/Minus icons

---

## 3. Billing Page — Plan Features Added

**File:** `app/dashboard/billing/BillingClient.tsx`

`PLANS` constant updated with full Maya feature lists:

**Starter features:** 3 active campaigns, 100 credits/month, All 9 agents, Morning digest, Basic analytics, 1 service request, 1 team seat, Email support

**Growth features:** Unlimited campaigns, 350 credits/month, Full analytics, 3 service requests, 3 team seats, Priority support, 10% add-on discount, Early access to new features

**ProAgent features:** 1,000 credits/month, Unlimited service requests, 5 team seats (+$15/mo extra), Dedicated support, 15% add-on discount, Quarterly strategy review, White-glove onboarding, First access to beta features

Upgrade cards in the billing page now show the feature list with check icons + the highlight label ("Everything in Starter, plus:" etc.) before the CTA button. Starter shows "3-day trial" badge.

---

## 4. Typography Generate-Fonts UI

**File:** `app/dashboard/brand-kit/BrandKitView.tsx` — TypographySection

The `POST /api/brand-kit/generate-fonts` route was already built. This session added the frontend:

- `generating`, `pairings`, `genError` state in TypographySection
- `generateFonts()` calls the API, sets `pairings` state
- Empty state: "Suggest font pairings" button when no fonts set yet
- Two selectable pairing cards: name, rationale, heading font + weight, body font + weight
- `applyPairing(pairing)` pre-fills `localFonts` heading/body fields without saving — user still clicks "Save fonts"
- "Suggest pairings" button also available when fonts already set (appears below existing fonts)
- Error state shows generation failure message

---

## 5. Files Created / Modified This Session

### New files
| File | Purpose |
|---|---|
| `02_approval_queue.sql` | SQL migration — new columns on agent_tasks + agent_outputs |
| `app/api/agents/approvals/route.ts` | GET — pending approval tasks with outputs |
| `app/api/agents/approvals/bulk/route.ts` | POST — bulk approve or reject |
| `app/dashboard/agents/approvals/page.tsx` | Approval queue page (server component + Suspense) |
| `app/dashboard/agents/approvals/ApprovalsClient.tsx` | Full client — ApprovalItem, bulk mechanic, filter/sort |
| `app/pricing/page.tsx` | Public pricing page (replaces or creates) |

### Modified files
| File | What changed |
|---|---|
| `app/api/agents/tasks/[id]/approve/route.ts` | Fixed .single() on content fetch; added reviewed_at, reviewed_by |
| `app/api/agents/tasks/[id]/reject/route.ts` | Rewrote: .limit(1), new feedback/reviewed columns, rejection_reason |
| `app/api/digest/generate/route.ts` | approvalItems now include reviewUrl deep-link |
| `app/dashboard/DashboardShell.tsx` | pendingApprovalsCount prop, badge on Agents nav, Approvals sub-item |
| `app/dashboard/layout.tsx` | Fetch pending approvals count server-side; pass to DashboardShell |
| `app/dashboard/agents/AgentCommandCenter.tsx` | Zone 1 → banner card; removed inline review state/functions |
| `app/dashboard/billing/BillingClient.tsx` | PLANS updated with full Maya feature lists |
| `app/dashboard/brand-kit/BrandKitView.tsx` | TypographySection generate-fonts UI |

---

## 6. Work Queue — Updated Status

| # | Item | Status |
|---|---|---|
| 1 | canvasContext in Maya system prompt | ✅ DONE (V7) |
| 2 | Agent Constraints | ✅ DONE (V7) |
| 3 | Foundation validation | ✅ DONE (V7) |
| 4 | Stealth churn tracking | ✅ DONE (V7) |
| 5 | Admin sidebar + client 360 | ✅ DONE (V7) |
| 6 | Segment-first campaign creation | ✅ DONE (V7/V8) |
| 7 | Maya cost tracking (waitUntil + tokens) | ✅ DONE (V8) |
| 8 | Admin Cost & Usage screen | ✅ DONE (V8) |
| 9 | Maya full page context (all pages) | ✅ DONE (V8) |
| 10 | Morning digest on Dashboard | ✅ DONE (V8) |
| 11 | Agent names audit | ✅ DONE (V8) |
| 12 | Brand Kit 6-section system | ✅ DONE (V8) |
| 13 | Maya conversation history in sidebar | ✅ DONE (V8) |
| 14 | Public pricing page | ✅ DONE (V9) |
| 15 | Billing page feature descriptions | ✅ DONE (V9) |
| 16 | Approval queue UI | ✅ DONE (V9) |
| 17 | Credit top-up (Stripe checkout mid-month) | 🟡 |
| 18 | Orchestration progress UI | 🟡 |
| 19 | Rebuild Foundation content (both accounts) | ⚠️ Data recovery — fill form + rescore |
| 20 | Profile dedup (still 2 rows/account) | ⚠️ Run dedup SQL |
| 21 | Merge to production | 🔴 After validation |
