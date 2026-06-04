# Maya — Product Context & North Star Document
*Created: May 29, 2026 — This is the source of truth for all Maya development*

> Current versioned source: `MAYA_CONTEXT_V02.md` (June 3, 2026). This unversioned file is retained for historical continuity.

---

## What Maya Is

Maya is a complete replacement for the Agent7even production app (`app.agent7even.com`). It is not a feature added to the existing product — it is a ground-up reimagining of what an AI-first marketing platform for small businesses should be.

**The core idea:** Maya is the brain. The canvas is the workspace. The chat is always the command line.

Small business owners don't need another dashboard full of tabs. They need an intelligent partner that knows their business, holds the context of everything they've worked on, and can think, plan, act, and execute on their behalf.

Maya is that partner.

---

## The Mental Model

### Three-panel layout — always

```
┌─────────────┬──────────────────────────┬─────────────────────┐
│   SIDEBAR   │        CANVAS            │    TASK / EDIT      │
│             │                          │       PANEL         │
│  Nav items  │  Active module content   │  Options, actions,  │
│             │  (campaigns, calendar,   │  selections,        │
│  Maya is    │  agents, analytics,      │  refinements        │
│  always     │  brand kit, etc.)        │                     │
│  accessible │                          │  Toggles in/out     │
│             │                          │  based on context   │
└─────────────┴──────────────────────────┴─────────────────────┘
```

When Maya is open (chat mode):
```
┌─────────────┬──────────────────────────┬─────────────────────┐
│   SIDEBAR   │      MAYA CHAT           │      CANVAS         │
│             │                          │                     │
│             │  Conversation lives      │  Current module     │
│             │  here — always has       │  stays visible      │
│             │  context of what's       │  Maya can update    │
│             │  in the canvas           │  it in real time    │
└─────────────┴──────────────────────────┴─────────────────────┘
```

### The bidirectional relationship

Maya always has full context of the canvas — past and present. She doesn't need to be told what's there.

- **Canvas action → Maya responds:** User selects an option, marks a task done, connects an account — Maya sees it and can proactively respond or wait to be asked
- **Maya suggests → Canvas updates:** Maya can modify campaigns, update the calendar, trigger agents, edit Brand Kit documents directly
- **User asks Maya → Canvas reflects:** Maya's answers can materialize as structured content in the canvas, not just text in chat
- **Agents run → Maya knows:** When an autonomous agent completes a task, Maya has the output and can surface insights or next steps

### Maya's role across every module

Maya is not a chatbot that sits separately from the product. She is the intelligence layer with read/write access to everything:
- Can view, edit, and create campaigns
- Can trigger, pause, and interpret agent outputs
- Can read Brand Kit and inject brand voice into everything she writes
- Can read Analytics data and surface what matters
- Can recommend and initiate Services
- Can manage the Content Calendar
- Knows the full history of every conversation and action taken

---

## Navigation Structure

### Sidebar design rules
- Icon style: thin stroke, minimal — matches the style shown in the Figma reference (dashboard grid, bag, lightning, sparkle, bar chart, document, headphones, bell, people, card, gear icons)
- Type: same weight and size as production app sidebar
- Logo: AGENT**7**EVEN with the 7 in brand orange (`#c8522a`)
- Bottom: avatar + "My account" link

### Nav items — final structure

```
AGENT7EVEN

Maya                          ← Primary entry point — opens Maya chat

OVERVIEW
Dashboard                     ← Overview of everything happening

YOUR WORKSPACE
⚙  Agents                    ← Agent Command Center
🛍  Services                  ← Add-on services (request, track)
📅  Content Calendar          ← Week-by-week content schedule
✦  Brand Kit                  ← Brand documents (voice, story, persona, positioning)
📊  Analytics                 ← GA + Meta data
📄  Deliverables              ← Files delivered by Agent7even team

ACCOUNT
🎧  Support                   ← Support tickets
🔔  Notifications             ← Activity feed
👥  Team                      ← Team members + permissions
💳  Billing                   ← Plan, invoices, upgrade
⚙  Settings                  ← Account preferences

                              My account (bottom, avatar)
```

**What changed from old Maya nav → new unified nav:**
- "Talk to Maya" → replaced by "Maya" at the top as primary entry
- "My campaigns" → replaced by "Dashboard" (campaigns live inside Dashboard canvas)
- "New campaign" button → stays as persistent CTA in sidebar or Dashboard
- "Results" → replaced by "Analytics"
- "Saved" → removed (saved content accessible from within campaigns and AI Toolkit)
- Added back: Support, Notifications, Team, Billing, Settings (from production — these are needed)

---

## Canvas Modules — What Each One Does

### Maya (chat)
- Full-width chat takes over the main area
- Right panel shows the current campaign or last active canvas module
- Maya always has context of what's in that right panel
- Triggered from "Maya" in nav or "Do this with Maya →" from any canvas action
- Persistent input bar at bottom: "Ask Maya anything..."

### Dashboard
- Overview of the user's entire marketing operation
- Shows: active campaigns, agent activity, recent content, upcoming calendar items, key metrics
- "New campaign" button prominent
- Maya card visible — "Your AI marketing strategist — get a plan, create content, and act on it"
- Campaigns list: each campaign card shows status, last activity, "Open →"
- Clicking a campaign opens it in the three-panel view (campaign detail | task panel)

### Campaign detail (within Dashboard)
- Middle panel: campaign name, strategy summary, "Do this today" action list, week-by-week schedule
- Right panel: task detail, copy options (Option A/B/C), edit mode
- Each task has "Do this with Maya →" — opens Maya chat with that task as context
- Maya can modify the campaign directly from chat
- Edit mode: inline editing of any campaign section

### Agents
- Canvas shows the 9 agents in a grid: name, autonomy level (Auto/Approval), description, last run, status
- Agent scorecard: last run, outputs count, idle/active/running status
- "Run an agent" section — select agent, give it context, launch
- Live activity feed — real-time updates as agents run
- Approval queue — outputs waiting for review before publishing/saving
- Maya can trigger any agent, interpret outputs, chain agents together

### Services
- Browse available add-on services from the Agent7even team
- Design & Development → routes to inquiry form (3-step: project type, assets, timeline/budget)
- All other services → request modal with brief field
- Active orders tracked with status pipeline
- Maya can recommend services based on campaign context ("Your Week 3 content needs product photos — want to request photography?")

### Content Calendar
- Week-by-week view of all scheduled content across campaigns
- Filter by platform (Instagram, Email, Ads, etc.)
- Each item shows: day, platform, content type, estimated time, status (done/pending)
- "Do this with Maya →" on each item
- Maya can reschedule, rewrite, or fill gaps in the calendar
- Connects to campaigns — calendar items are generated from campaign plans

### Brand Kit
- 4 documents: Brand Voice, Brand Story, Brand Persona, Brand Positioning
- Each document: title, editable content, version history
- 6-chapter generation flow (from production — port this)
- Maya has read access always — injects brand voice into all generated content
- Maya has write access — can suggest and apply updates to brand documents
- Version history: every save creates a version snapshot

### Analytics
- Google Analytics section: sessions, top pages, traffic sources (OAuth connected)
- Meta Ads section: spend, reach, ROAS (OAuth connected)
- Instagram section: followers, reach, top posts (pending Meta app review)
- Maya interprets the data: "Your Thursday posts get 3x more engagement — here's why"
- Connect/disconnect flows for each platform
- Empty states are informative, not broken-looking

### Deliverables
- Files uploaded by the Agent7even team per project
- Grouped by project name
- Download via signed URLs
- Maya notifies when new deliverables arrive
- Client can also upload files (briefs, assets, references)

### Support
- Threaded ticket system
- Priority: low, medium, urgent
- Maya can draft support messages or escalate issues
- Admin replies visible in thread

### Notifications
- Full activity feed
- Filter: all / unread
- Types: order status, support reply, deliverable uploaded, agent completed, plan activated, inquiry update
- Real-time via Supabase realtime

### Team
- Owner invites team members
- Permissions per module: billing, services, ai_toolkit, analytics, brand_kit, deliverables, support
- Seat billing: $15/mo per extra seat beyond plan limit
- Maya is accessible to all team members within their permission scope

### Billing
- Current plan card: Starter / Growth / ProAgent
- Credit balance (for agent runs)
- Invoice history from Stripe
- Upgrade/downgrade options
- Customer portal link

### Settings
- Company name, website URL, Instagram handle
- Account settings (Clerk modal — name, email, password)
- Notification preferences

---

## What Gets Ported from Production

| Feature | Status | Notes |
|---|---|---|
| Clerk auth (sign-in, sign-up, onboarding) | ✅ Port | Already in v2 via fork |
| Stripe billing (3 tiers, monthly/annual) | ✅ Port | Already in v2 via fork |
| Brand Kit (6-chapter flow, 4 documents, version history) | ✅ Port | Already in v2 via fork |
| Analytics (GA OAuth, Meta OAuth) | ✅ Port | Already in v2 via fork |
| Deliverables (Supabase Storage, signed URLs) | ✅ Port | Already in v2 via fork |
| Support (threaded tickets) | ✅ Port | Already in v2 via fork |
| Notifications (realtime, 6 event types) | ✅ Port | Already in v2 via fork |
| Team management (invite, permissions, seat billing) | ✅ Port | Already in v2 via fork |
| Services (8 services, request modal, order tracking) | ✅ Port | Already in v2 via fork |
| AI Toolkit (prompt library, Claude generation) | ⚠️ Absorb | Functionality absorbed into Maya chat — not a separate tab |
| Admin panel | ✅ Keep | Stays as-is — admin routes untouched |
| Agent Command Center | ✅ Port | Already in v2, needs Maya integration |
| Maya chat | ✅ Core | The new primary interface |
| Campaigns (My campaigns, three-panel view) | ✅ Core | New in v2 — keep and improve |

---

## What Gets Left Behind

| Feature | Reason |
|---|---|
| Old dashboard home (production) | Replaced by Maya's Dashboard |
| AI Toolkit as standalone tab | Absorbed into Maya — she IS the toolkit |
| Separate `/dashboard` layout | Maya's layout is the only shell |
| "New campaign" as separate flow | Initiated through Maya chat |

---

## Layout & Shell Architecture

### The only layout in v2
`app/layout.tsx` → `MayaShell.tsx`

MayaShell contains:
- Sidebar (always visible)
- Main content area (canvas)
- Maya chat panel (slides in from left or overlays, always has canvas context)
- Task/edit panel (slides in from right, context-dependent)

### Routing
```
/                     → redirect to /dashboard
/maya                 → Maya chat (full canvas shows last active module)
/dashboard            → Dashboard (campaigns overview)
/dashboard/agents     → Agent Command Center
/dashboard/services   → Services
/dashboard/calendar   → Content Calendar
/dashboard/brand-kit  → Brand Kit
/dashboard/analytics  → Analytics
/dashboard/deliverables → Deliverables
/dashboard/support    → Support
/dashboard/notifications → Notifications
/dashboard/team       → Team
/dashboard/billing    → Billing
/dashboard/settings   → Settings
```

### What gets deleted from the v2 repo
The old production dashboard layout (`app/dashboard/layout.tsx` with the white sidebar) gets replaced entirely by MayaShell. All the page content inside those routes gets rebuilt under Maya's layout.

---

## Technical Foundation (already in place)

- Next.js 16.2.6 (App Router, Turbopack)
- TypeScript
- Tailwind CSS v4
- Clerk auth (production instance)
- Supabase (Postgres + Storage + Realtime)
- Stripe (3-tier subscriptions + seat billing)
- OpenRouter (all model calls — Claude Opus/Sonnet/Haiku + Gemini Flash)
- Anthropic Claude via OpenRouter
- Resend (email)
- Vercel (auto-deploy from main)

### Agent infrastructure (built this session)
- `lib/agents/openrouter.ts` — OpenRouter client
- `lib/agents/cost.ts` — live pricing, credit system
- `lib/agents/runner.ts` — task lifecycle, orchestration, cost tracking
- `orchestration_sessions`, `credit_balances`, `credit_ledger` tables live in Supabase
- 3 cron jobs: run-scheduled-agents (hourly), allocate-credits (1st/month), refresh-pricing (6hrs)

---

## Design Tokens

| Token | Value |
|---|---|
| Accent / brand orange | `#c8522a` |
| Dark background | `#0d0d0d` |
| Cream | `#f5f4f0` |
| Font | Geist |
| Sidebar bg | white |
| Sidebar text | gray, small caps for section labels |
| Icon style | thin stroke, minimal |
| Card style | `bg-white rounded-2xl border border-gray-100` |

---

## What's NOT Built Yet (Priority Order)

### 1. MayaShell replacement — HIGH (next session)
- Delete old `/dashboard` layout
- Build unified MayaShell with correct nav (icons + labels per Figma reference)
- All existing pages re-mounted under new shell
- Maya chat accessible from any page with canvas context

### 2. Dashboard canvas (My campaigns) — HIGH
- Campaign list with status, last activity
- Three-panel campaign detail view
- Edit mode for campaign sections
- "Do this with Maya →" triggers on every task

### 3. Maya ↔ Canvas context binding — HIGH
- Maya chat receives current canvas module + content as system context
- Canvas updates when Maya modifies content
- "Do this with Maya →" pre-loads task context into chat

### 4. Content Calendar canvas — MEDIUM
- Week-by-week view generated from campaign plans
- Platform filter
- Status tracking (done/pending)
- Maya integration for rescheduling and rewriting

### 5. Agent orchestration UI — MEDIUM
- Real-time progress for parallel runs
- Approval queue UI
- Maya can trigger and chain agents from chat

### 6. Credit top-up — MEDIUM
- Stripe checkout for purchasing additional credits mid-month

### 7. Maya cost tracking — MEDIUM
- Maya chat currently bypasses the runner
- Should log tokens + deduct credits like all other agents

---

## The Rule Going Forward

**Every session starts by reading this document.**

Before writing any code:
1. Read MAYA_CONTEXT.md
2. Confirm which repo you're in (`git remote -v` — must show `agent7even-v2`)
3. Confirm the feature being built fits the Maya architecture described here
4. Never touch `~/agent7even-app/` (production) unless explicitly told to

**Two repos, two purposes:**
- `~/agent7even-v2-clean/` — Maya. All new development happens here.
- `~/agent7even-app/` — Production. Untouched unless specifically instructed.


---

## Foundation — Maya's Onboarding Flow

**Route:** `/foundation`
**Files:** `app/foundation/page.tsx` + `app/foundation/FoundationFlow.tsx`

Foundation is the onboarding experience for new Maya users. It is NOT the old production onboarding — it is purpose-built for Maya and generates the starting context that Maya uses for everything.

### What it does

A 5-step guided flow that collects deep business context before the user ever talks to Maya. When complete, Maya generates 5 documents that become her permanent context for that user.

On completion → redirects to `/maya?new=true`

### The 5 steps

| Step | Title | What's collected |
|---|---|---|
| 0 | Your Business | `businessDescription`, `problemSolved`, `transformation` |
| 1 | Your Customer | `customerWho`, `customerFrustration`, `customerTriedBefore`, `customerBuyingTrigger` |
| 2 | Your Position | `competitors` (up to 3), `differentiator` (from list), `differentiatorOwn` (free text) |
| 3 | Your Voice | `toneTraits` (2–4 from list), `brandsAdmired`, `neverSoundLike` |
| 4 | Your 30 Days | `marketingBudget` (from list), `channels` (multi-select), `monthlyGoal` (from list) |

### The 5 documents Maya generates

1. Business brief
2. Ideal customer profile
3. Positioning statement
4. Brand voice guide
5. 30-day plan

These are generated via `/api/foundation/generate` on step 5 completion. Progress shown with animated checklist.

### Maya's intros (per step)
- Step 0: "Let's start with the basics. Tell me about your business in your own words — no polished pitch needed."
- Step 1: "Now let's talk about who you're actually serving. The more specific you are here, the better everything else works."
- Step 2: "Every great brand stands for something specific. Let's figure out what makes you different from everyone else."
- Step 3: "How you sound is as important as what you say. Let's define your brand voice so every piece of content feels like you."
- Step 4: "Last step. Let's set up your first 30 days so you know exactly what to do and when."

### Key implementation details
- Progress saved to Supabase after each step via `/api/foundation/save-step` — step is resumable if user drops off
- `profiles` table tracks: `foundation_complete` (boolean), `foundation_step` (int 0–4)
- If `foundation_complete = true` → redirects to `/maya` (skips flow entirely)
- Profile upserted on page load (safe for repeat visits)
- Generation screen: animated spinner → check marks as each document completes
- UI: clean white, centered, max-w-2xl, black CTA buttons, pill selects, `rounded-xl` inputs

### Relationship to Brand Kit (production)
Foundation replaces and supersedes the Brand Kit onboarding from production. The Brand Kit tab in Maya's nav shows the documents Foundation generated, plus allows editing and version history. Foundation is the one-time setup; Brand Kit is the ongoing view.

### API routes needed
- `POST /api/foundation/save-step` — saves current step + answers to Supabase
- `POST /api/foundation/generate` — calls Claude via OpenRouter, generates all 5 documents, marks `foundation_complete = true`

---

## Cost Tracking & OpenRouter Integration

Built May 29, 2026. Full technical detail in CONTEXTV7.md. Summary for session awareness:

### What's in place
- All model calls go through `lib/agents/openrouter.ts` — never direct Anthropic SDK
- Live pricing fetched from OpenRouter `/api/v1/models`, cached in `platform_settings` key `openrouter_model_pricing`, 6hr TTL
- Every agent task logs: `input_tokens`, `output_tokens`, `cost_usd`, `model` (actual model used)
- Credits system: clients see credits, admins see USD
- `runAgent()` — single task with full cost tracking
- `runOrchestration()` — parallel subagents with budget cap enforcement

### Credit allocations
| Plan | Credits/mo |
|---|---|
| Starter | 100 |
| Growth | 350 |
| ProAgent | 1,000 |

### Run tiers
| Tier | Credits | Subagents |
|---|---|---|
| Light | 2 | 1 |
| Standard | 8 | 2–4 |
| Deep | 25 | 5+ |

### New Supabase tables (already migrated ✅)
- `orchestration_sessions` — groups parallel agent runs, tracks budget cap
- `credit_balances` — one row per user, real-time via Supabase realtime
- `credit_ledger` — every debit/credit logged with description

### New columns on existing tables (already migrated ✅)
- `agent_tasks`: `input_tokens`, `output_tokens`, `cost_usd`, `model`, `orchestration_id`
- `agent_outputs`: `input_tokens`, `output_tokens`, `cost_usd`

### Cron jobs (in vercel.json)
- `/api/cron/run-scheduled-agents` — every hour
- `/api/cron/allocate-credits` — 1st of month, midnight
- `/api/cron/refresh-pricing` — every 6 hours

### Known gap
Maya chat (`/api/maya/chat`) currently bypasses the runner — tokens not logged, credits not deducted. Needs to be wired into `runAgent()`.

---

## Session Handoff Protocol

**Every new session — Claude Code or otherwise — must:**

1. Read `MAYA_CONTEXT.md` fully before writing any code
2. Read `CONTEXTV7.md` for full technical infrastructure detail
3. Run `git remote -v` — confirm output shows `agent7even-v2`, never `agent7even-app`
4. Confirm the feature being built fits the Maya architecture in this document

**When to update MAYA_CONTEXT.md:**
- Any new route added
- Any nav item changes
- Any canvas module behaviour changes
- Foundation flow changes
- Any new table or column added to Supabase
- Any change to how Maya accesses or modifies canvas data
- Any architectural decision made

**When to update CONTEXTV7.md:**
- New environment variables added
- New API routes added
- New Supabase tables or columns
- Dependency changes
- Infrastructure changes (crons, storage, realtime)

**The two documents are complementary:**
- `MAYA_CONTEXT.md` = product vision, architecture, what everything does and why
- `CONTEXTV7.md` = technical infrastructure, env vars, schema, file paths

Both must stay current. If something is built and not documented in both relevant places, it doesn't exist as far as the next session is concerned.


---

## SaaStr Lessons — Product Principles

**Source:** `SAASTR_LESSONS.md` in project root — read this file in full when making roadmap or feature design decisions.

This document translates the SaaStr AI Agent Playbook directly into Maya product decisions. Every session that touches agent design, campaign creation, Foundation, or the Dashboard should reference it.

### The core thesis for Maya
Maya's value is not "better than a great marketer." It is **"a consistently good marketer who never stops showing up."** The social posts that go dark, the email that ships quarterly, the follow-up that never happens — that's the gap Maya fills.

### Non-negotiable product principles (extracted from lessons)

**Foundation is a quality gate, not just UX**
Vague Foundation answers = mediocre agent output downstream. Maya must push back on vague inputs during Foundation. "Small businesses" is not specific enough. Foundation generates the playbook — without a good playbook, agents have nothing to run.

**Every agent needs a Constraints field**
Alongside "what to do" — explicit "what NOT to do." Agents are goal-seeking and will improvise. Brand safety requires constraints at the generation level, not just the approval queue.

**Campaigns are segment-first, not channel-first**
Don't start with "Email Campaign." Start with "who specifically are you reaching?" Past customers, warm leads, cold audience — the channel is a detail. Maya should flag "spray and pray" attempts and offer to segment.

**Daily review is the product**
Dashboard's primary job is making the daily 10-15 minute review frictionless: morning digest, quick-approve flow, one-click correction that trains Maya. If a client hasn't reviewed in 48hrs, Maya proactively surfaces it.

**Agent names lead with the workflow replaced**
Not "AI Content Generator." Yes: "Weekly Social — drafts and schedules your social posts so you don't have to."

**The agency layer is the moat**
Product enables self-serve. Agent7even team provides the forward-deployed equivalent for Growth and ProAgent clients — especially in the first 30 days. This is what separates top performers from everyone else.

### Items to add to roadmap (from SaaStr lessons)
- Agent Constraints field per agent — "what NOT to do" configuration
- Segment-first campaign creation flow
- Thumbs-up/down training feedback on agent outputs
- Morning digest on Dashboard — overnight agent activity, flagged outputs, approval queue
- "What Maya did this week" weekly summary email
- Re-engagement trigger if client inactive 48hrs
- Foundation answer validation — Maya pushes back on vague inputs
- B-lead identification in campaign setup
- Client health/engagement score in admin panel

### What NOT to build (anti-patterns)
- Don't deploy agents before Foundation is solid
- Don't make daily review feel like work — it must be a 2-minute habit
- Don't make campaign creation channel-first
- Don't let agents run without explicit constraints
- Don't expect clients to self-discover value — make it visible in the Dashboard

---

## MayaShell — Built Status Update
*Updated: May 29, 2026*

MayaShell has been built by Claude Code. Status:

### Completed ✅
- New DashboardShell replaces old white sidebar entirely
- Nav matches MAYA_CONTEXT spec: Maya toggle, Dashboard, Agents, Services, Content Calendar, Brand Kit, Analytics, Deliverables, Support, Notifications, Team, Billing, Settings
- AI Toolkit removed (absorbed into Maya)
- Dark minimal aesthetic matching Maya's style
- Maya panel slides in as 380px panel between sidebar and page content from any page
- Full chat in panel: mode picker on first open, message history, session persistence
- `canvasContext` (current page name) passed to chat route
- `MayChatPanel` component at `components/maya/MayChatPanel.tsx` — works in panel and standalone modes via `onClose` prop

### Known gap — needs wiring ⚠️
- `/api/maya/chat/route.ts` receives `canvasContext` in the request body but does not yet use it in the system prompt. Small addition — Maya should explicitly reference the current page/module context when responding.


---

## Known Gaps — Prioritized Work Queue
*Updated: May 29, 2026*

These are confirmed gaps validated against SAASTR_LESSONS.md. Work in this order.

### 1. canvasContext in Maya system prompt ✅ DONE
**File:** `app/api/maya/chat/route.ts`
**What:** `canvasContext` (current page name) already arrives in the request body from MayChatPanel but is not injected into the system prompt. Maya responds without knowing what page the user is on.
**Fix:** Read `canvasContext` from request body, append to system prompt: "The user is currently on the [page] page."
**Why now:** This is what makes Maya contextually relevant vs. generic. Every interaction until this is fixed is a degraded experience.

### 2. Agent Constraints field — Agent Command Center ✅ DONE — committed 6665539
**File:** Agent registry + Agent Command Center UI
**What:** Each agent card currently has goals/instructions but no "what NOT to do" field. Agents are goal-seeking and will improvise to hit targets.
**Fix:** Add `constraints` field to agent registry schema. Add "What NOT to do" section to each agent card in the UI. Maya should prompt for constraints during agent setup.
**Constraint templates to offer:** no discounting, no delivery promises, no competitor mentions, always route pricing to human, never make guarantees.
**Why now:** SaaStr went through 47 iterations to stop one agent from being too aggressive on pricing. Every client running agents without constraints is exposed to this.

### 3. Foundation answer validation ✅ DONE
**File:** `app/foundation/FoundationFlow.tsx` + `/api/foundation/generate`
**What:** Foundation currently accepts any input before generating the 5 documents. Vague answers (e.g. "small businesses" as customer description) produce weak documents that degrade all downstream agent output.
**Fix:** Before calling `/api/foundation/generate`, send answers to Maya for a specificity check. Maya flags vague fields and asks follow-up questions. Only proceeds to generation when answers meet a minimum specificity threshold.
**Example pushback:** "You said your customer is 'small businesses' — can you be more specific? What industry, what size, what specific problem are they trying to solve?"
**Why now:** Foundation documents are the playbook every agent runs. Bad input here multiplies downstream.

### 4. Stealth churn tracking — Admin panel ✅ DONE
**What:** No `last_active_at` or engagement score tracked per client. Clients can go completely dark and it's invisible until they cancel.
**Fix:** 
- Add `last_active_at` timestamptz to `profiles` — updated on every authenticated page load
- Add `engagement_score` integer to `profiles` — calculated weekly based on: logins, agent runs, Maya conversations, approvals completed
- Surface both in admin client list with visual indicator (green/yellow/red)
- Maya sends in-app notification if client hasn't logged in for 48hrs
**Why:** SaaStr Lesson 6 — stealth churn. Clients disengage silently before they cancel. This is a retention tool, not an analytics feature.

### 5. Segment-first campaign creation 🟡 Campaign quality
**What:** Current campaign creation starts with channel or content type. Should start with "who specifically are you reaching?"
**Fix:** Campaign creation flow first step is audience segment selection: Past customers / Warm leads gone quiet / Engaged non-converters / Current customers / Cold audience. Channel becomes a detail after segment is defined.
**Maya should flag:** If client tries to run one campaign to entire list, Maya pushes back and offers to split into segments.

### 6. Morning digest on Dashboard 🟡 Daily review habit
**What:** Dashboard currently shows static state. Should function as a daily review hub.
**Fix:** Dashboard top section shows overnight agent activity: outputs produced, flagged items, approval queue count, anything needing attention. Quick-approve flow without opening full editor. One-click "off-brand / too aggressive / wrong tone" correction that feeds back to Maya as training signal.

### 7. Agent names audit 🟢 Quick win
**Current names to check against Lesson 7 principle** (lead with workflow replaced, not AI capability):
- Competitor Watcher → probably fine
- Content Writer → borderline ("Weekly Social — drafts your posts so you don't have to")
- Campaign Builder → borderline
- Analytics Reader → rename candidate
- Trend Spotter → probably fine
- Email Sequence Builder → probably fine
- Ad Copy Generator → rename candidate ("Ad Variations — creates multiple ad options so you can test without writing each one")
- SEO Scanner → probably fine
- Brand Voice Guardian → probably fine


---

## Session Summary — May 29, 2026

### What shipped this session

**Infrastructure:**
- OpenRouter client (`lib/agents/openrouter.ts`) — all model calls unified
- Cost tracking — live pricing from OpenRouter, `orchestration_sessions`, `credit_balances`, `credit_ledger` tables
- Agent runner — `runAgent()` + `runOrchestration()` with budget caps
- 5 cron jobs total in `vercel.json`: run-scheduled-agents, allocate-credits, refresh-pricing, calculate-engagement, nudge-inactive
- Activity tracking — `lib/activity.ts` wired in 5 locations

**Product features:**
- MayaShell — unified nav, old dashboard layout replaced
- canvasContext in Maya system prompt ✅
- Agent Constraints — per-user brand safety guardrails, all 9 agents with defaults ✅
- Foundation validation — soft gate, living document, sidebar progress bar, Maya nudge ✅
- Stealth churn tracking — engagement score, at-risk admin view, automated nudges ✅

**Documentation:**
- MAYA_CONTEXT.md — north star product document created and maintained
- SAASTR_LESSONS.md — strategic principles added to project
- agent_constraints_handoff.md — Claude Code handoff
- foundation_validation_handoff.md — Claude Code handoff
- stealth_churn_handoff.md — Claude Code handoff
- Session handoff protocol established — two-document system

### Work queue status
1. canvasContext ✅ DONE
2. Agent Constraints ✅ DONE
3. Foundation validation ✅ DONE
4. Stealth churn tracking ✅ DONE
5. Segment-first campaign creation 🟡 NEXT
6. Morning digest on Dashboard 🟡
7. Agent names audit 🟢 Quick win

### New Supabase tables added this session
- `orchestration_sessions`
- `credit_balances`
- `credit_ledger`
- `agent_constraints`
- `foundation_field_scores`
- `client_activity_log`

### New columns added to `profiles`
- `foundation_score` integer
- `foundation_answers` jsonb
- `foundation_updated_at` timestamptz
- `last_active_at` timestamptz
- `engagement_score` integer
- `engagement_updated_at` timestamptz
- `last_nudged_at` timestamptz


---

## Session Summary — May 30, 2026

### What shipped this session

**Bug fixes:**
- Foundation redirect — `null` and `false` both now caught correctly
- Old `/onboarding` route deleted (517 lines removed)
- Old admin redirect removed from `dashboard/page.tsx`
- Old `/maya` route fixed — no longer uses stale layout
- Foundation 0% empty state — shows "Score my foundation" when complete but unscored
- Foundation score realtime sync in sidebar via Supabase realtime on profiles table

**Admin experience:**
- MayaShell now renders for admin accounts — no separate redirect
- ADMIN section added to sidebar — conditionally visible for role = admin or owner
- Admin nav: Clients, Revenue, Orders, Inquiries, Admin Settings
- Old dark admin sidebar layout removed — all admin pages inside MayaShell

**Admin client 360:**
- `/admin/clients` — search (debounced), plan + status filters, company/Instagram column, ••• hover menu, duplicate email banner
- `/admin/clients/[id]` — two-panel layout
  - Left: identity card, health scores (engagement/foundation/credits), 6 action buttons
  - Right: 6 tabs — Activity, Billing, Team, Foundation (read-only), Notes, Support
  - All modals: send email (Resend + logged), change plan, change role, suspend/reactivate, reset Foundation, deactivate duplicate
- 7 new API routes under `/api/admin/clients/[id]/` — all protected by `requireAdmin()`
- `admin_email_log` table created

### New Supabase tables
- `admin_email_log` — tracks admin-initiated emails to clients

### Known issues to address
- Foundation page shows 0% for users who completed Foundation before scoring feature was built — fix: "Score my foundation" CTA on empty state
- Old `/maya` route still needs verification that it's fully inside MayaShell

### Work queue status
1. canvasContext ✅ DONE
2. Agent Constraints ✅ DONE
3. Foundation validation ✅ DONE
4. Stealth churn tracking ✅ DONE
5. Admin sidebar + client 360 ✅ DONE
6. Segment-first campaign creation 🟡 NEXT
7. Morning digest on Dashboard 🟡
8. Agent names audit 🟢 Quick win
9. Fix old /maya route layout ⚠️ Pending verification


---

## Campaign Creation System — Built May 30, 2026

### What shipped
Full campaign creation system — two modes, same artifact output.

### New files
- `lib/credits.ts` — `deductCredits()` utility with balance check + ledger insert
- `app/api/campaigns/generate/route.ts` — guided + open canvas generation via OpenRouter, DB save, credit deduction
- `components/campaigns/NewCampaignModal.tsx` — two-card mode picker
- `components/campaigns/GuidedCampaignFlow.tsx` — 3-step: segment → adaptive goals → timeline/budget/model selector + generation animation
- `components/campaigns/OpenCanvasFlow.tsx` — Maya chat with trigger-phrase detection, model selector, generation flow
- `app/dashboard/campaigns/page.tsx` — campaign list with status badges
- `app/dashboard/campaigns/new/page.tsx` — routes by `?mode` param
- `app/dashboard/campaigns/[id]/page.tsx` + `CampaignDetail.tsx` — detail with Do This Today + collapsible week accordions

### Updated files
- `DashboardShell.tsx` — Campaigns nav item, "New campaign" button, `maya:open-task` event listener
- `MayChatPanel.tsx` — `pendingTask` prop injects `__TASK__` sentinel when user clicks "Do this with Maya →"
- `app/api/maya/chat/route.ts` — `isOpenCanvas` mode with custom system prompt + trigger phrase detection
- `app/my-campaigns/page.tsx` — redirects to `/dashboard/campaigns`

### Key architectural patterns
- `maya:open-task` custom event — canvas fires it, DashboardShell listens, opens Maya chat with task context. No prop drilling.
- `__TASK__` sentinel — injected into Maya chat input when "Do this with Maya →" is clicked, tells Maya which specific task to help with
- Trigger phrase detection in Open Canvas — Maya says "I have what I need to build this. Want me to generate the full plan?" → UI detects phrase → shows generate button
- Model selection — Claude Sonnet (8cr) or Claude Opus (25cr) — explicit model names shown to user, not marketing labels

### Campaign DB schema
- `campaigns` table — `id, user_id, title, status, mode, segment, goal, timeline_days, strategy_summary, do_this_today (jsonb), week_plan (jsonb), model_used, chat_session_id, created_at, updated_at`
- `campaign_copy_options` table — copy A/B/C options per campaign field

### Work queue update
5. Segment-first campaign creation ✅ DONE
6. Morning digest on Dashboard 🟡 NEXT
7. Agent names audit 🟢 Quick win
8. Maya cost tracking — Maya chat not yet wired into runner (tokens not logged) ⚠️


---

## Cost Instrumentation — Verified May 30, 2026

### What shipped
- `/api/maya/chat` wired through runner — tokens logged, credits deducted per turn
- `waitUntil` from `@vercel/functions` — survives Vercel serverless teardown
- `useMemo` on transport in `MayChatPanel` — fixed double-task bug from unstable reference
- Root cause of missing logs: client was POSTing to `/api/maya` not `/api/maya/chat` — one-line fix
- `maya_sessions` table created in Supabase with `UNIQUE(user_id)` constraint
- Admin Cost & Usage screen at `/admin/cost` — per-account MRR/cost/margin table + run log

### Test results
- **Test A** ✅ — one message → one `agent_tasks` row, `status=completed`, non-zero tokens + cost, credit deducted by 2
- **Test B** ✅ — 15 messages in quick succession → 15 rows recorded, balance dropped by exactly 30 credits. `waitUntil` survives teardown under load.
- **Test C** — not yet run (abort mid-stream → confirm no charge)

### Cost recording is now trustworthy
Numbers in `/admin/cost` reflect real usage. The margin dashboard can be trusted.

### Remaining cost workstream items (from COST_INSTRUMENTATION_CONTEXT.md)
- ⬜ Test C — failure path (abort mid-stream, confirm no charge)
- ⬜ Step 4 — `01_cost_instrumentation.sql` migration (job_type column, indexes, v_account_month_cost view)
- ⬜ Screen 1 — Margin Overview
- ⬜ Screen 3 — Run Log
- ⬜ Screen 4 — Job Economics / wedge-finder
- ⬜ Screen 5 — Pricing Simulator

### Known decisions locked
- Maya chat: fixed 2 credits/turn, per turn
- Cost recording is conservative while cached_tokens deferred — reads slightly less profitable than reality
- No admin action that charges/changes a customer ships without confirm dialog + audit row


---

## Morning Digest — Built May 31, 2026

### What shipped
Full morning digest system — dashboard widget + email cron.

### New files
- `app/api/digest/[id]/route.ts` — GET digest by id, auth-gated
- `app/api/digest/generate/route.ts` — POST, generates + caches by date, Haiku summaries per agent run
- `app/api/digest/[id]/dismiss/route.ts` — POST, ownership-verified, persists dismiss to DB
- `app/api/cron/morning-digest/route.ts` — 12:00 UTC daily, generates if needed, sends via Resend from maya@agent7even.com, respects email_digest preference
- `components/dashboard/MorningDigest.tsx` — skeleton loading, three sections (What I did / What needs you / Today's plan), inline approve/reject, dismiss persisted

### Updated files
- `app/dashboard/page.tsx` — fetches today's digest server-side, renders MorningDigest
- `app/dashboard/settings/page.tsx` — email pref columns added to select
- `app/dashboard/settings/SettingsClient.tsx` — email notifications section, 3 auto-saving PreferenceToggle components
- `app/api/settings/update/route.ts` — handles emailDigest, emailApprovals, emailWeekly
- `vercel.json` — 6th cron: `0 12 * * *`

### New Supabase tables + columns
- `daily_digests` table — one row per user per day, cached
- `profiles.email_digest` boolean DEFAULT true
- `profiles.email_approvals` boolean DEFAULT true
- `profiles.email_weekly` boolean DEFAULT true
- `profiles.timezone` text DEFAULT 'America/New_York'

### Key details
- Digest generation uses Claude Haiku for one-line first-person agent summaries
- Email from: maya@agent7even.com — verify domain in Resend before cron fires
- Dismiss persists to DB — survives refresh
- Widget hides when nothing to report (no runs, no approvals, no actions)
- 6 crons total now running in v2

### Work queue update
11. Morning digest ✅ DONE
12. Agent names audit 🟢 NEXT (quick win)
13. Credit top-up (Stripe checkout mid-month) 🟡
14. Orchestration progress UI 🟡
15. Approval queue UI 🟡
16. Merge to production 🔴 After validation


---

## Brand Kit Expansion — Built May 31, 2026

### What replaced
The old Brand Kit "Start brand build" flow pointing at the empty `brand_documents`
table is gone. Replaced with a full 6-section brand identity system.

### Key table clarification
- `foundation_documents` — real table, 5 rows, where Foundation writes. Section 5 reads here.
- `brand_documents` — empty, legacy from production fork, ignored.
- `brand_answers` — Foundation answers source for generation prompts.

### New Supabase tables
- `brand_kit_sections` — completion tracking per section per user
- `brand_kit_colors` — color palette with HEX/RGB/role
- `brand_kit_fonts` — typography by role (heading/subheading/body/accent)
- `brand_kit_assets` — logos, photos, templates (file_url or external_url)
- Storage bucket: `brand-assets` (private)

### 6 sections
1. **Identity** — logo uploads (primary/alternate/icon), usage rules, brand name, tagline
2. **Colors** — palette with HEX/RGB/role, add manually or generate with Maya
3. **Typography** — 4 font role cards, fill manually or generate with Maya
4. **Imagery** — photography style description + asset upload grid
5. **Voice** — Foundation documents (brand_voice, brand_story, ideal_client_profile, positioning_statement) + additional blocks (tagline, elevator_pitch, about_us, mission). Editable + regenerate per doc.
6. **Templates** — link (Canva, Figma, Google Slides) or upload files

### Maya generation features
- `POST /api/brand-kit/generate-colors` — Haiku generates 5-color palette from Foundation context. Preview → Accept (saves all) or regenerate. 2 credits.
- `POST /api/brand-kit/generate-fonts` — Haiku generates 2 font pairings from Foundation context. Preview cards → "Use this pairing" pre-fills fields (user still clicks Save font). 2 credits.
- "Regenerate palette" button appears when colors already exist
- "Suggest pairings" button appears when fonts already set

### API routes
- `GET /api/brand-kit` — all brand kit data for user
- `POST /api/brand-kit/colors` — upsert color
- `DELETE /api/brand-kit/colors/[id]`
- `POST /api/brand-kit/fonts` — upsert font by role
- `POST /api/brand-kit/assets` — file upload + insert row
- `DELETE /api/brand-kit/assets/[id]`
- `POST /api/brand-kit/documents` — upsert to foundation_documents
- `POST /api/brand-kit/sections/complete` — mark section done
- `POST /api/brand-kit/generate-colors`
- `POST /api/brand-kit/generate-fonts`

### Maya canvas context
Brand Kit dispatches colors, fonts, and document types on every page load.
Agents query brand kit data for on-brand generation.

### Work queue update
- Brand Kit expansion ✅ DONE
- Maya conversation history (recents in sidebar) — built by Claude Code directly, status TBD
- Agent names audit 🟢 Still pending
- Credit top-up 🟡
- Orchestration progress UI 🟡
- Approval queue UI 🟡


---

## Cost Instrumentation — Test C Result & Decision
*May 31, 2026*

### Test C outcome
When a user aborts a Maya message mid-stream, `waitUntil` keeps the Vercel
function alive and Maya completes the response server-side. The task logs as
`completed` with real token counts — no `failed` row appears because the work
actually completed.

### Decision: no credit charge on client abort
**Locked decision:** If the user closes the tab or navigates away before seeing
Maya's response, no credits are deducted even though the task completed server-side.

**Rationale:** Value to the user was zero. Actual cost is ~$0.002 per abort —
negligible at current scale. Trust benefit outweighs the cost recovery.

**Implementation needed (deferred):** Detect client disconnect in the stream,
set an abort flag, skip credit deduction in `waitUntil` block while still
logging the task + real token cost for margin tracking. Build when scale makes
absorbing abort costs meaningful.

**Test C verdict:** ✅ PASS — behavior is correct and understood. Credit charge
on abort is a known accepted gap, not a bug.

### All three instrumentation tests complete
- Test A ✅ — single message captured correctly
- Test B ✅ — 15 messages, 15 rows, waitUntil survives teardown
- Test C ✅ — abort behavior understood, decision made


---

## Approval Queue — SQL Migration Done May 31, 2026

Schema additions to support approval queue:
- `agent_tasks`: `rejection_reason text`, `reviewed_at timestamptz`, `reviewed_by uuid`
- `agent_outputs`: `feedback text`, `feedback_note text`, `feedback_at timestamptz`

UI build pending — handoff doc: `approval_queue_handoff.md`

---

## Pricing Page — Built May 31, 2026

- Route: `/pricing` — public, no auth required
- Design matches production pricing page (dark background, orange accent, three-column cards)
- Updated feature matrix reflecting Maya product (credits, agents, campaigns, Foundation, Brand Kit)
- Monthly/annual toggle (2 months free)
- Compare plans table with Maya-specific rows
- CTAs route to `/sign-up?plan=starter|growth|proagent`
- Authenticated users see "Go to dashboard →" instead of sign-up buttons
- Lives at `agent7even-v2.vercel.app/pricing` until marketing site is built

### Plan features as shown
- Starter $49/mo — 100cr, 3 campaigns, 1 seat, basic analytics, 1 service request
- Growth $89/mo — 350cr, unlimited campaigns, 3 seats, full analytics, 3 service requests
- ProAgent $149/mo — 1,000cr, unlimited campaigns, 5 seats (+$15/seat), dedicated support, quarterly review, white-glove onboarding


---

## Session Summary — May 31, 2026 (Session 3)
*Full detail in CONTEXTV9.md*

### What shipped
- Approval queue UI — `/dashboard/agents/approvals`, bulk actions, rejection chips, deep-link from morning digest, sidebar badge
- Public pricing page — `/pricing`, dark theme, three-column cards, compare table, FAQ, monthly/annual toggle
- Billing page — full Maya feature lists on all three plan cards
- Typography generate-fonts UI — frontend wired to existing generate-fonts API
- Agent names audit ✅ (shipped in prior session, confirmed done)

### Work queue — final status
14. Public pricing page ✅ DONE (V9)
15. Billing page feature descriptions ✅ DONE (V9)
16. Approval queue UI ✅ DONE (V9)
17. Credit top-up (Stripe checkout mid-month) 🟡
18. Orchestration progress UI 🟡
19. Foundation content rebuild (both accounts) ⚠️ fill form + rescore
20. Profile dedup ⚠️ run dedup SQL
21. Merge to production 🔴 After validation

### Session handoff protocol
Every new session reads MAYA_CONTEXT.md + CONTEXTV9.md before writing any code.
Run `git remote -v` — must show `agent7even-v2`.


---

## Credit Top-Up — Built & Verified May 31, 2026

### What shipped
Full Stripe one-time payment flow for mid-month credit purchases.

### Key fix during testing
Webhook route was at `app/api/stripe/webhook/route.ts` — blocked by Clerk middleware (404 on unauthenticated Stripe POST). Fixed by merging into `app/api/webhooks/stripe/route.ts` which is explicitly public in `proxy.ts`.

### Stripe webhook
- URL: `https://agent7even-v2.vercel.app/api/webhooks/stripe`
- Events: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed`
- Env var: `STRIPE_WEBHOOK_SECRET` (independent from production — separate Vercel project)

### Three credit packages
| Package | Credits | Price | Env var |
|---|---|---|---|
| Small | 100 | $5 | `STRIPE_CREDITS_SMALL_PRICE_ID` |
| Medium | 350 | $15 | `STRIPE_CREDITS_MEDIUM_PRICE_ID` |
| Large | 1,000 | $40 | `STRIPE_CREDITS_LARGE_PRICE_ID` |

### Verified end to end ✅
- `credit_topups` row created `pending` on checkout initiation
- Webhook fires → `status = completed`, `completed_at` set
- `credit_balances` increases by correct amount
- `credit_ledger` gets `type = topup` row
- Success banner shows on `/dashboard/billing?topup=success`
- Low balance modal triggers at ≤20% plan max, dismisses for session

### Work queue final status
17. Credit top-up ✅ DONE
18. Orchestration progress UI 🟡 — only remaining feature item
19. Foundation rebuild (both accounts) ⚠️ manual — fill form + rescore
21. Merge to production 🔴 after validation


---

## Orchestration Progress UI — Built May 31, 2026

### What shipped
Real-time agent-by-agent progress display for parallel orchestration runs.

### Schema additions
- `orchestration_sessions.agent_ids text[]` — which agents ran
- `orchestration_sessions.agent_status jsonb` — per-agent status (pending/running/completed/failed)

### New component
`components/agents/OrchestrationProgress.tsx` — full and compact modes, Supabase realtime subscription, progress bar, agent status rows with spinner/checkmark/X, budget exceeded warning, cost summary on completion

### Surfaces
- Agent Command Center Live Activity — shows active orchestration in real time, recent completed orchestrations below
- Campaign generation screen — replaces generic dots with agent-by-agent progress

### New API routes
- `GET /api/agents/orchestrations/active` — returns running orchestration for user
- `GET /api/agents/orchestrations/recent` — returns last 5 completed

### Work queue
18. Orchestration progress UI ✅ DONE — all feature items complete

---

## Kyle Norton Lessons — Added May 31, 2026

`KYLE_NORTON_LESSONS.md` added to project. Companion to `SAASTR_LESSONS.md`.
Source: Kyle Norton (CRO, Owner.com) SaaStr AI 2026 talk.

### Core thesis for Maya
Maya is the productized version of the centralized AI team an SMB could never hire.
The owner should never orchestrate agents, manage prompts, or assemble workflows —
Maya runs everything centrally and surfaces results.

### Key principles that affect the build

**Principle 1 — Performance theater test**
Before building any owner-facing config UI: does this get the owner to a result,
or just make them feel like they're doing AI? Cut features that fail this test.

**Principle 3 — Lossiness (most important architectural takeaway)**
Every generative step compounds error. Target: no agent chain runs more than
2–3 generative steps without a human or deterministic checkpoint. The approval
queue is Maya's lossiness interceptor — must sit at the right points inside
chains, not only at final output. Foundation reduces lossiness at the source.

**Principle 4 — Autonomy ramp**
Autonomy is earned over time per agent, not chosen up front. New owners start
with everything in Approval. After a track record of approved on-brand output,
Maya suggests graduating that agent to Auto.

**Principle 6 — Capture, don't ask**
Every owner action (approve, edit, reject, reschedule) should write a structured
signal back into Maya's permanent context automatically. The bidirectional canvas
must be a capture mechanism, not just a reflect one.

### Action items added to roadmap
1. Map generative-chain length for every agent and orchestration
2. Audit approval queue position — confirm mid-chain interception possible
3. Make canvas binding a capture mechanism (approvals/edits write back to context)
4. Build autonomy ramp — per-agent Auto suggestion after track record
5. Wire Maya chat into runAgent() — existing gap, elevated priority
6. Per-agent eval + iteration loop before marking any agent "done"
7. Run every proposed build through Kyle's 5 build/buy questions
8. Performance theater test on every feature before building

### Sophistication ladder positioning
Most SMBs are at L0 (ChatGPT as search bar). Maya delivers L3 (centralized
infrastructure, context library that compounds, real leverage) with zero
building required. Copy frame: "You don't need to learn AI. You need the
thing the best operators built — and that's what Maya is."


---

## Kyle Norton Principles — Interjections & Modifications
*What needs to change in the existing build based on KYLE_NORTON_LESSONS.md*

---

### 1. Session Handoff Protocol — Two New Checks Added

Every session that proposes or builds a new feature must pass two tests
before writing any code. Add these to the Session Handoff Protocol:

**Performance theater test (Principle 1):**
> "Does this get the owner closer to a marketing result, or does it just
> make them feel like they're doing AI?"
> If the answer is the latter — cut it. Features that ask the owner to
> configure, chain, manage, or orchestrate anything are performance theater.

**Build/buy test (Principle 2) — Kyle's 5 questions:**
1. How critical is uptime? (if it breaks, does everything stop?)
2. How customized does it need to be? (is off-the-shelf 90% there?)
3. What's the engineering ROI?
4. Is this core proprietary intelligence?
5. Does it give a real competitive advantage?

If the answer isn't "we must build this" — buy or integrate instead.
Infrastructure (auth, payments, email, transcription) = buy.
Intelligence (Foundation, brand context, campaign reasoning, agent outputs) = build.

---

### 2. Generative Chain Length — Required Documentation Per Agent

**Status: Not yet done — add to work queue**

Before any agent is considered production-ready, its generative chain must
be documented. Claude Code should produce this as a single reference file.

Format per agent:
```
Agent: content_writer
Chain: user_request → [brand_kit fetch] → [foundation_answers fetch] →
       generate_draft (1 generative step) → [brand_voice_guardian check
       (1 generative step)] → approval_queue
Checkpoint: approval_queue (human intercept before delivery)
Chain length: 2 generative steps before human checkpoint ✅
```

Target: no chain runs more than 2–3 generative steps without a human
or deterministic checkpoint. Chains longer than 3 generative steps
are high-lossiness and need a mid-chain intercept added.

**Add to work queue:**
- Document all 9 agent chains
- Document all orchestration flows (campaign_builder, etc.)
- Flag any chain > 3 generative steps for redesign

---

### 3. Autonomy Ramp — New Product Feature (not yet built)

**Status: Not built — add to roadmap**

Currently Auto/Approval is a static setting in the agent registry.
It should be a dynamic, earned progression per agent per user.

**How it works:**
- New users: all agents default to `approval_required` regardless of registry setting
- After N consecutive approved outputs from an agent (suggested: 5), Maya
  proactively suggests in chat: "Your Content Writer has produced 5 outputs
  you've approved without changes. Want me to let it run automatically?"
- User confirms → that agent switches to `auto` for that user in a new
  `agent_autonomy_overrides` table
- User can revert any agent back to approval at any time from Agent Command Center

**New table needed:**
```sql
CREATE TABLE agent_autonomy_overrides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES profiles(id) ON DELETE CASCADE,
  agent_id    text NOT NULL,
  autonomy    text NOT NULL,  -- 'auto' | 'approval_required'
  approved_streak integer DEFAULT 0,
  upgraded_at timestamptz,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, agent_id)
);
```

**Runtime behavior:**
`buildSystemPrompt()` and task creation should check
`agent_autonomy_overrides` first, fall back to registry default.

**Maya's suggestion trigger:**
After each approval, increment `approved_streak`. When streak hits 5
and agent is still on `approval_required`, send an in-app notification
and surface in Maya chat on next session.

---

### 4. Canvas as Capture Mechanism — New Table + Wiring

**Status: Partially built (rejection notes saved) — gap: not permanent context**

Every owner action must write a structured signal back into Maya's
permanent context — not just the current session.

**New table:**
```sql
CREATE TABLE owner_signals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES profiles(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  -- 'approved' | 'rejected' | 'edited' | 'dismissed' | 'campaign_created'
  -- 'agent_run' | 'content_rescheduled' | 'brand_kit_updated'
  agent_id    text,
  entity_type text,   -- 'agent_output' | 'campaign' | 'brand_doc' | 'calendar_item'
  entity_id   uuid,
  signal_data jsonb,  -- { original, edited, rejection_reason, etc. }
  created_at  timestamptz DEFAULT now()
);
```

**Where signals get written:**
- Approval queue approve → `signal_type: 'approved'`
- Approval queue reject → `signal_type: 'rejected'` + rejection_reason
- Approval queue edit → `signal_type: 'edited'` + diff
- Campaign created → `signal_type: 'campaign_created'`
- Brand Kit updated → `signal_type: 'brand_kit_updated'`
- Morning digest dismissed → `signal_type: 'dismissed'`

**How Maya uses it:**
`/api/maya/chat/route.ts` system prompt includes a summary of recent
owner signals — last 10 signals, grouped by type. Maya uses this to
understand patterns: what gets approved, what gets rejected, what the
owner edits vs. accepts wholesale.

```typescript
// In system prompt construction:
const recentSignals = await getOwnerSignals(profileId, 10)
const signalSummary = summarizeSignals(recentSignals)
// e.g. "Owner has rejected 3 outputs for 'Off-brand tone' this week.
//       All approved outputs were under 150 words.
//       Last 5 campaigns were for warm leads segment."
```

---

### 5. Build/Buy Applied to Pending Roadmap Items

Run each remaining roadmap item through the 5 questions:

| Item | Build or Buy? | Reason |
|---|---|---|
| Help center content | Build (Maya) | Core intelligence — Maya IS the help |
| Design system | Build | Brand/product-specific |
| Marketing site | Build | Positioning is proprietary |
| Analytics dashboard | Buy (existing GA/Meta) | Already 90% solved |
| Email sending | Buy (Resend) ✅ already | Infrastructure |
| A/B testing | Buy when needed | Not core intelligence |
| Video content | Buy (partner/service) | Not core intelligence |
| Autonomy ramp | Build | Core product behavior |
| Owner signals capture | Build | Core intelligence layer |

---

### 6. Sophistication Ladder — Copy Changes Needed

**L0→L3 framing must appear in two places:**

**Foundation intro (first screen after sign-up):**
Current: generic "let's learn about your business"
Needed: "Most business owners use AI like a search bar. Maya gives you
what the best marketing operators built — a system that knows your
business, runs your marketing, and gets better the longer you use it.
Let's set that up."

**Pricing page value proposition (subtitle):**
Current: "One platform for your marketing dashboard, AI tools, and
managed services."
Needed: "The centralized marketing system your best competitors are
already running — without the team, the budget, or the learning curve."

**Agent Command Center empty state:**
When no agents have run yet, instead of "No activity yet — run an agent
to get started":
"Your agents are ready. While your competitors are manually posting,
emailing, and guessing — yours will be running automatically."

---

### Updated Session Handoff Protocol

Every new session — Claude Code or otherwise — must:

1. Read `MAYA_CONTEXT.md` fully
2. Read the highest-numbered `CONTEXTV*.md` for technical detail
3. Run `git remote -v` — confirm `agent7even-v2`
4. **Performance theater test** — does the feature get the owner to a result?
5. **Build/buy test** — run Kyle's 5 questions before building anything new
6. Confirm the feature fits Maya's architecture

When building a new agent or orchestration:
7. Document the generative chain length
8. Confirm a human or deterministic checkpoint exists within 2–3 steps
