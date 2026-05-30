# Maya — Product Context & North Star Document
*Created: May 29, 2026 — This is the source of truth for all Maya development*

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

### 4. Stealth churn tracking — Admin panel 🟡 Retention
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

