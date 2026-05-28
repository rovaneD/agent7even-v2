# Agent7even V2 — Implementation Context

## Version History
| Version | Date | What changed |
|---|---|---|
| V6 | May 28, 2026 | Foundation flow, campaign builder, my campaigns page, routing fixes, mode selector, Claude Code workflow established |
| V5 | (prior) | Initial v2 scaffold, Maya chat, onboarding flow, agent registry |

---

## What This Product Is
Agent7even V2 is an AI-first marketing platform for small businesses. The primary interface is Maya — an AI marketing strategist. Unlike the production app (app.agent7even.com) which is tool-based, V2 is outcome-based: Maya guides users through building their marketing foundation, then executes campaigns autonomously via a multi-agent system.

**Inspiration:** Mindtrip — don't show a list of tools, build the entire outcome.

---

## Two Products — Important Distinction
| | Production | V2 |
|---|---|---|
| URL | app.agent7even.com | agent7even-v2.vercel.app |
| Repo | rovaneD/agent7even-app | rovaneD/agent7even-v2 |
| Local path | ~/agent7even-app/ | ~/agent7even-v2-clean/ |
| Branch | main | main |
| Status | Stable, client-facing | Experimental |
| Approach | Tool-based client portal | Maya-first, agentic |

**Critical:** Never push from agent7even-v2-clean to the production repo. Always run `git remote -v` to confirm before pushing.

---

## Tech Stack

### Runtime & Framework
| Package | Version |
|---|---|
| next | 16.2.6 |
| react | 19.2.4 |
| react-dom | 19.2.4 |
| typescript | ^5 |
| tailwindcss | ^4 |

### AI
| Package | Version | Notes |
|---|---|---|
| ai (Vercel AI SDK) | ^6.0.191 | Core streaming, `useChat`, `streamText`, `convertToModelMessages` |
| @ai-sdk/react | ^3.0.193 | `useChat` hook |
| @anthropic-ai/sdk | ^0.98.0 | Direct Anthropic calls (foundation generate, campaign generate) |
| @openrouter/ai-sdk-provider | ^2.9.0 | Maya chat and agent streaming via OpenRouter |

### Auth & Database
| Package | Version |
|---|---|
| @clerk/nextjs | ^7.4.0 |
| @supabase/supabase-js | ^2.106.1 |
| @supabase/ssr | ^0.10.3 |

### Payments
| Package | Version |
|---|---|
| stripe | ^22.1.1 |
| @stripe/stripe-js | ^9.6.0 |

### UI
| Package | Version |
|---|---|
| lucide-react | ^1.16.0 |
| framer-motion | ^12.40.0 |
| react-markdown | ^10.1.0 |
| recharts | ^3.8.1 |
| react-hot-toast | ^2.6.0 |
| @radix-ui/react-avatar | ^1.1.11 |
| @radix-ui/react-dialog | ^1.1.15 |
| @radix-ui/react-dropdown-menu | ^2.1.16 |
| @radix-ui/react-progress | ^1.1.8 |
| @radix-ui/react-tabs | ^1.1.13 |

### Integrations
| Package | Version |
|---|---|
| resend | ^6.12.3 |
| svix | ^1.94.0 |
| @google-analytics/admin | ^9.1.0 |
| @google-analytics/data | ^6.0.0 |
| date-fns | ^4.2.1 |
| zod | ^4.4.3 |
| zustand | ^5.0.13 |
| clsx | ^2.1.1 |
| tailwind-merge | ^3.6.0 |

---

## Infrastructure

### Environment Variables
All required in `.env.local`:

**Supabase**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Clerk**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Clerk SDK auto-detection)
- `CLERK_SECRET_KEY` (Clerk SDK auto-detection)
- `CLERK_WEBHOOK_SIGNING_SECRET`

**AI**
- `ANTHROPIC_API_KEY` — direct Anthropic SDK calls (foundation/generate, maya/campaign)
- `OPENROUTER_API_KEY` — all agent streaming via OpenRouter (Maya chat, content writer)

**Stripe**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_STARTER_MONTHLY_PRICE_ID`
- `STRIPE_STARTER_ANNUAL_PRICE_ID`
- `STRIPE_GROWTH_MONTHLY_PRICE_ID`
- `STRIPE_GROWTH_ANNUAL_PRICE_ID`
- `STRIPE_PROAGENT_MONTHLY_PRICE_ID`
- `STRIPE_PROAGENT_ANNUAL_PRICE_ID`
- `STRIPE_SEAT_PRICE_ID`

**Google Analytics**
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_SA_CLIENT_EMAIL`
- `GOOGLE_SA_PRIVATE_KEY`

**Meta**
- `META_APP_ID`
- `META_APP_SECRET`

**App**
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `NOTIFY_EMAIL`
- `CRON_SECRET`

### AI Routing Architecture
Two separate AI clients are in use:

1. **OpenRouter** (`lib/ai/client.ts`) — used for all streaming agent calls via Vercel AI SDK `streamText`. Maya chat runs through OpenRouter → `anthropic/claude-sonnet-4`. This is the path for `runAgent()`.

2. **Direct Anthropic SDK** (`@anthropic-ai/sdk`) — used for non-streaming, structured output calls: foundation document generation (5 parallel Claude calls) and campaign plan generation (returns JSON). Uses `claude-sonnet-4-20250514`.

Model registry in `lib/ai/client.ts` — change a model platform-wide by editing one line:
```ts
export const models = {
  maya: openrouter('anthropic/claude-sonnet-4'),
  campaignGenerator: openrouter('anthropic/claude-sonnet-4'),
  competitorAnalyzer: openrouter('google/gemini-2.5-flash'),
  contentWriter: openrouter('anthropic/claude-haiku-4'),
  brandAnalyzer: openrouter('anthropic/claude-sonnet-4'),
}
```

### Middleware
`proxy.ts` (not `middleware.ts` — Next.js 16 naming). Only does Clerk auth protection. No onboarding or routing logic in middleware — all routing guards live in individual page server components.

---

## File Structure

```
app/
├── layout.tsx
├── page.tsx                             # Root/landing
├── pricing/page.tsx
├── privacy/page.tsx
├── terms/page.tsx
├── checkout-now/page.tsx
│
├── sign-in/[[...sign-in]]/page.tsx
├── sign-up/[[...sign-up]]/page.tsx
│
├── onboarding/page.tsx                  # Old onboarding flow (5 steps, dark UI)
├── foundation/
│   ├── page.tsx                         # Server: auth + profile upsert + redirect guard
│   └── FoundationFlow.tsx               # Client: 5-step form, calls save-step + generate
│
├── maya/
│   ├── page.tsx                         # Server: auth + profile fetch + foundation gate
│   └── MayaShell.tsx                    # Client: chat + canvas + mode picker
│
├── my-campaigns/
│   ├── page.tsx                         # Server: auth + fetch campaigns from Supabase
│   └── CampaignList.tsx                 # Client: expand/collapse cards, week accordions
│
├── dashboard/
│   ├── layout.tsx
│   ├── page.tsx                         # Gates: onboarding_complete + foundation_complete
│   ├── DashboardShell.tsx
│   ├── PlanBanner.tsx
│   ├── agents/page.tsx + AgentCommandCenter.tsx
│   ├── ai-toolkit/page.tsx + AIToolkitClient.tsx
│   ├── analytics/page.tsx + AnalyticsClient.tsx
│   ├── billing/page.tsx + BillingClient.tsx
│   ├── brand-kit/page.tsx + BrandDocument.tsx + BrandFlow.tsx + BrandKitClient.tsx + questions.ts
│   ├── deliverables/page.tsx + DeliverablesClient.tsx
│   ├── notifications/page.tsx + NotificationsClient.tsx
│   ├── services/page.tsx + ServicesClient.tsx + inquiry/
│   ├── settings/page.tsx + SettingsClient.tsx
│   ├── support/page.tsx + SupportClient.tsx
│   └── team/page.tsx + TeamClient.tsx
│
├── admin/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── clients/[id]/ + clients/
│   ├── inquiries/[id]/ + inquiries/
│   ├── orders/
│   ├── revenue/
│   ├── settings/
│   └── support/[id]/ + support/
│
└── api/
    ├── foundation/generate/route.ts     # 5 parallel Anthropic calls, saves foundation_documents
    ├── foundation/save-step/route.ts    # Per-step profile field updates (step-scoped)
    ├── maya/chat/route.ts               # Maya streaming via OpenRouter, mode detection
    ├── maya/campaign/route.ts           # Structured campaign JSON, saves to campaigns table
    ├── campaigns/list/route.ts          # GET — user's campaigns ordered by created_at desc
    ├── agents/content-writer/route.ts
    ├── agents/outputs/route.ts
    ├── agents/run/campaign-builder/route.ts
    ├── agents/tasks/route.ts
    ├── agents/tasks/[id]/approve/route.ts
    ├── agents/tasks/[id]/reject/route.ts
    ├── agents/tasks/create/route.ts
    ├── ai/run-prompt/route.ts
    ├── ai/save-prompt/route.ts
    ├── analytics/{connect,disconnect,ga-*,meta-*}/route.ts
    ├── brand/{generate,save-answers,save-document}/route.ts
    ├── cron/run-scheduled-agents/route.ts
    ├── deliverables/{admin-upload,delete,download,upload}/route.ts
    ├── notifications/mark-read/route.ts
    ├── onboarding/complete/route.ts
    ├── orders/create/route.ts
    ├── services/inquiry/route.ts
    ├── settings/update/route.ts
    ├── stripe/checkout/route.ts
    ├── stripe/portal/route.ts
    ├── support/{create,reply,update}/route.ts
    ├── team/{accept,invite,remove,update}/route.ts
    └── webhooks/{clerk,stripe}/route.ts

lib/
├── ai/
│   ├── client.ts                        # OpenRouter model registry
│   └── runAgent.ts                      # streamText wrapper → toUIMessageStreamResponse
├── agents/
│   ├── registry.ts                      # 9 agent definitions with models + schedules
│   └── runner.ts
├── supabase/
│   ├── client.ts                        # Browser client
│   └── server.ts                        # Server client (createServiceClient)
├── createNotification.ts
├── getNotifyEmail.ts
├── requireAdmin.ts
└── teamPermissions.ts
```

---

## Database Schema

All tables in Supabase. Columns documented from actual code references.

### `profiles`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, referenced as FK in other tables |
| clerk_user_id | text | Unique, used for all lookups |
| email | text | From Clerk |
| full_name | text | From Clerk |
| avatar_url | text | From Clerk |
| company_name | text | Set in onboarding / foundation |
| business_type | text | Industry |
| role | text | 'client', 'admin', 'owner' |
| status | text | 'onboarding', 'active' |
| plan | text | Stripe plan tier |
| website_url | text | |
| instagram_handle | text | |
| business_goals | text[] | |
| ideal_customer | text | From foundation step 1 |
| sell_locations | text[] | From foundation step 4 |
| marketing_budget | text | From foundation step 4 |
| competitors | text[] | From foundation step 2 |
| top_goals | text[] | From foundation step 4 |
| marketing_challenge | text | From foundation step 1 |
| content_comfort | text | From old onboarding |
| foundation_complete | boolean | Set true after ≥3 of 5 docs generated |
| foundation_step | int | 0–5 progress tracker |
| onboarding_complete | boolean | Set true on foundation complete AND old onboarding complete |
| updated_at | timestamptz | |

### `foundation_documents`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → profiles.id |
| type | text | 'brief', 'icp', 'positioning', 'voice', 'plan' |
| title | text | Human-readable name |
| markdown | text | Full generated content |
| version | int | Always 1 for now |
| updated_at | timestamptz | |

Unique constraint: `(user_id, type)` — used for upsert conflict resolution.

### `campaigns`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| user_id | uuid | FK → profiles.id on delete cascade |
| title | text | From AI-generated plan title |
| plan | jsonb | Full plan: title, summary, weeks[], quick_wins[], metrics_to_track[], budget_allocation |
| status | text | Default 'active' |
| created_at | timestamptz | Default now() |
| updated_at | timestamptz | Default now() |

**Note:** Must be created manually. SQL is in the comment block at the top of `app/api/maya/campaign/route.ts`.

### `agent_tasks`
Referenced in `maya/page.tsx` for pending approval badge count:
- `id`, `requires_approval`, `status`, `approved_at`, `rejected_at`

### Other tables referenced in API routes
- `orders` — order management
- `services` — service catalog
- `inquiries` — service inquiry submissions
- `notifications` — in-app notifications
- `support_tickets` / `support_messages` — support system
- `team_members` — multi-seat team management
- `deliverables` — file deliverables per client
- `agent_outputs` — stored agent run results
- `app_settings` — admin-controlled platform settings

---

## What's Built and Working

### Foundation Flow ✓
- 5-step form: Your Business → Your Customer → Your Position → Your Voice → Your 30 Days
- Each step saves only its relevant profile fields (step-scoped — no cross-step overwrite)
- On final step: 5 parallel Anthropic calls generate brief, ICP, positioning, voice, 30-day plan
- Documents saved to `foundation_documents` with upsert on `(user_id, type)`
- `foundation_complete` and `onboarding_complete` both set to `true` only after ≥3 of 5 docs save
- Progress animation is real (no fake setTimeout) — all 5 checkmarks appear after API returns
- Fetch errors logged per-document; silent failures don't block the rest

### Maya Chat ✓
- Full context injection from `foundation_documents` table (brief, ICP, positioning, voice)
- Falls back to raw profile fields if no foundation documents exist
- Streams via OpenRouter → `anthropic/claude-sonnet-4`
- System prompt enforces: max 3 sentences per reply, references specific business details, never says "Great!" or "Absolutely!"
- Hidden message filtering: `__SYSTEM_INIT__` and `__MODE__` messages stripped from visible chat

### Mode Selector ✓
- Shown on `/maya` before any conversation starts (`mode === null && !chatStarted && !initialPrompt`)
- 4 modes in a 2×2 grid:
  - **Build a campaign** (Rocket) — "Create a 30-day marketing plan"
  - **Create content** (PenLine) — "Generate captions, emails, or ad copy"
  - **Analyze my marketing** (BarChart2) — "Review what's working and what's not"
  - **Just talk to Maya** (MessageCircle) — "Open conversation, no agenda"
- Selecting a mode sends `__MODE__{name}__` hidden message; input bar hidden until selection
- In `chat/route.ts`: `__MODE__` detected, replaced with mode-specific opening instruction before hitting model
- New users with `initialPrompt` bypass the picker

### Campaign Builder ✓
- Triggered when Maya says "spinning up the Campaign Builder" (keyword detection in `onFinish`)
- `generateCampaign()` posts to `/api/maya/campaign` — direct Anthropic call, 4000 tokens, structured JSON
- Returns: title, summary, weeks (4), tasks per week (day/action/channel/time/priority), quick_wins, metrics_to_track, budget_allocation
- Saves to `campaigns` table; if insert fails, plan still renders (graceful degradation — returns `{ plan, campaign: null }`)
- Right canvas panel: default → building → plan states
- Save button: "Save plan" → "Saving..." → "Plan saved ✓" (2s) → resets, no redirect

### My Campaigns Page ✓
- `/my-campaigns` — server component, fetches from Supabase directly, ordered by `created_at desc`
- Cards: title, created date, green "Active" badge, "View plan" / "Hide plan" toggle
- Expanded view: 2-sentence summary, quick wins (→ arrows), week accordions (Week 1 open by default), metrics chips
- Empty state: links to `/maya`
- `/api/campaigns/list` — GET route for future client-side use

### Routing ✓
- Foundation complete → `/maya` (redirected from foundation page on revisit)
- `/maya` gate: `foundation_complete === false` → `/foundation`
- `/dashboard` gate: `!onboarding_complete` → `/onboarding`, then `foundation_complete === false` → `/foundation`
- `onboarding_complete` set to `true` by foundation generate route — foundation-flow users no longer get stuck in onboarding loop
- Foundation page upsert no longer sets `onboarding_complete: false`

### Agent Command Center ✓ (partial)
- `/dashboard/agents` — displays 9 registered agents
- Pending approval count shown as dot in Maya sidebar nav
- Approve/reject task routes exist (`/api/agents/tasks/[id]/approve` and `/reject`)

---

## What's NOT Built Yet

### Maya Sidebar Nav — Unlinked Items
From `NAV_ITEMS` in `MayaShell.tsx`:

| Nav item | href | Status |
|---|---|---|
| Talk to Maya | /maya | ✓ Working |
| My campaigns | /my-campaigns | ✓ Working |
| Content calendar | null (button only) | ✗ Not built |
| Results | null (button only) | ✗ Not built |
| Agents | /dashboard/agents | ✓ Existing page |
| Saved | null (button only) | ✗ Not built |
| Brand kit | null (button only) | ✗ Not built (Maya version) |
| Services | null (button only) | ✗ Not built (Maya version) |

### Features Referenced But Not Implemented
- **Foundation documents viewer** — 5 generated docs exist in `foundation_documents` table but no UI to read or edit them in the Maya experience
- **Content calendar** — nav item present, no page
- **Results / analytics view** — nav item present, links nowhere in Maya
- **Saved** — nav item present, no page or data model
- **Brand kit (Maya)** — separate from `/dashboard/brand-kit`, not built in the Maya context
- **"New campaign" button** in Maya sidebar — renders but has no `onClick` handler
- **Campaign deletion / archiving** — no delete route or UI
- **Session persistence** — chat history is in-memory only; refreshing starts a fresh conversation
- **Competitor watcher, Trend spotter, Analytics Reader outputs** — agents defined and scheduled, not wired to any display UI

---

## Agent System

All 9 agents defined in `lib/agents/registry.ts`. Streamed via OpenRouter through `lib/ai/runAgent.ts`.

| Agent | ID | Model | Autonomy | Schedule | Status |
|---|---|---|---|---|---|
| Competitor Watcher | competitor_watcher | google/gemini-2.5-flash | autonomous | Weekly Mon 8am | Defined, not wired to UI |
| Content Writer | content_writer | anthropic/claude-haiku-4 | approval_required | on-demand | Route exists: `/api/agents/content-writer` |
| Campaign Builder | campaign_builder | anthropic/claude-sonnet-4 | approval_required | on-demand | Route exists: `/api/agents/run/campaign-builder` |
| Analytics Reader | analytics_reader | google/gemini-2.5-flash | autonomous | Daily 7am | Defined, not wired to UI |
| Trend Spotter | trend_spotter | google/gemini-2.5-flash | autonomous | Daily 6am | Defined, not wired to UI |
| Email Sequence Builder | email_sequence_builder | anthropic/claude-sonnet-4 | approval_required | on-demand | Defined only |
| Ad Copy Generator | ad_copy_generator | anthropic/claude-haiku-4 | approval_required | on-demand | Defined only |
| SEO Scanner | seo_scanner | anthropic/claude-sonnet-4 | autonomous | Weekly Mon 9am | Defined only |
| Brand Voice Guardian | brand_voice_guardian | anthropic/claude-haiku-4 | autonomous | on-demand | Defined only |

Cron job at `/api/cron/run-scheduled-agents` exists for scheduled autonomous agents.
Approval flow: tasks create a record, user approves/rejects via `/api/agents/tasks/[id]/approve` or `/reject`.

---

## Key Architectural Decisions

### How Maya Gets Foundation Context
1. `maya/page.tsx` fetches profile via `clerk_user_id` (server-side)
2. `maya/chat/route.ts` re-fetches profile AND `foundation_documents` on every message
3. If foundation docs exist: injects all 4 docs verbatim into system prompt — Maya told "Never ask for information covered above"
4. If no docs: falls back to raw profile fields (idealCustomer, marketingBudget, competitors, etc.)
5. `hasFoundation` boolean switches between the two system prompt branches

### How Campaign Trigger Works
1. Maya's system prompt instructs it to say exactly: "Got everything I need. I'm spinning up the Campaign Builder now — it'll have your full 30-day plan ready in about a minute."
2. `MayaShell.tsx` `onFinish` callback checks: `text.toLowerCase().includes("spinning up the campaign builder")`
3. If matched: calls `generateCampaign(currentMessages)` → POST to `/api/maya/campaign`
4. Campaign route uses **direct Anthropic SDK** (not OpenRouter) with structured JSON prompt, 4000 tokens
5. Response parsed (strips markdown fences) → JSON.parse → saved to `campaigns` table
6. If DB insert fails: plan still returned to UI (`{ plan, campaign: null }`)

### Mode Selector Flow
1. `mode` state in `MayaShell` — `null` initially
2. `showModePicker` = `mode === null && !chatStarted && !initialPrompt`
3. On card click: `setMode(id)` + `sendMessage({ text: '__MODE__{id}__' })`
4. `chatStarted` includes `mode !== null` — chat UI shows immediately after selection (before API responds)
5. `__MODE__` messages filtered from `visibleMessages` — never shown in chat bubbles
6. In `chat/route.ts`: after `convertToModelMessages`, any user message starting with `__MODE__` has its content replaced with the mode-specific instruction before the model sees it

### AI Client Split
- **OpenRouter** for all streaming (Maya chat, agent runs) — `streamText` → `toUIMessageStreamResponse()`
- **Direct Anthropic SDK** for structured non-streaming (foundation docs, campaign JSON) — enables `Promise.allSettled` parallelism and clean JSON parsing
- This split is intentional: streaming needs AI SDK, structured output needs raw SDK control

### Stripe / Billing
- Full Stripe integration: checkout, portal, webhooks, price IDs for 3 tiers × 2 billing periods + seat add-on
- Stripe API version: `'2026-04-22.dahlia'` cast as `as any` — **never use `'2025-04-30.basil'`** (causes build failure per AGENTS.md)
- Plans: Starter ($49/mo / $490/yr), Growth ($89/mo / $890/yr), ProAgent ($149/mo / $1,490/yr)
- Team seat add-on: $15/mo per extra seat (`STRIPE_SEAT_PRICE_ID`)

### Middleware
- `proxy.ts` (Next.js 16) — only `auth.protect()` for non-public routes
- All routing logic lives in page server components, not middleware
- Public routes: `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/pricing`, `/privacy`, `/terms`, `/api/webhooks(.*)`, analytics callbacks, team accept

---

## Known Issues
1. **`campaigns` table must be created manually** — no migration file; SQL schema is only in a comment in `app/api/maya/campaign/route.ts`
2. **Foundation documents viewer missing** — docs exist in DB but no UI to read or edit them in the Maya experience
3. **Session not persistent** — `useChat` state is in-memory; refreshing `/maya` starts a fresh conversation
4. **"New campaign" button in Maya sidebar** — renders but has no `onClick` handler, does nothing
5. **Budget label mismatch** — foundation flow uses "Under $200/mo" labels; old onboarding uses "Under $200"; `marketing_budget` column may have inconsistent values
6. **Mode selector not shown for returning users** — by design, but there's no way to reset to the picker from the UI once a conversation starts
7. **Duplicate profile rows** — early testing may have created duplicate `clerk_user_id` entries in v2 Supabase; verify with: `select clerk_user_id, count(*) from profiles group by clerk_user_id having count(*) > 1`

---

## What's Next (Priority Order)
1. **Foundation documents viewer** — show the 5 generated docs in Maya right panel or a tab; readable + editable
2. **"New campaign" button** — wire to reset mode + chat state (start fresh session)
3. **Session persistence** — save/load chat history to Supabase so conversations survive refresh
4. **Budget label fix** — align foundation flow labels with profile field values
5. **Content calendar** — first non-Maya nav item to build; week view linked to campaign tasks
6. **Results view** — connect Analytics Reader output to a display panel
7. **Decide: V2 relationship to production** — replace, premium tier, or separate product

---

## Design Notes
- **Functionality first, design later** — current UI is intentionally minimal
- **Mindtrip is the UX inspiration** — don't show a list of tools, build the entire outcome
- **MayaShell uses inline styles** throughout — not Tailwind; dashboard uses Tailwind; don't mix within the same component
- **Agentic side must be strong** — Maya orchestrates, agents execute; the agent registry is the backbone
- **Canvas panel** (right side of Maya) is the key differentiator — work product appears there, not just in chat

---

## Session: May 28, 2026 — Foundation Flow & Campaign Builder

### What Was Built and Confirmed Working

**Foundation Flow (/foundation)**
- 5-step guided journey: Business → Customer → Position → Voice → 30 Days
- FoundationFlow.tsx — full client component, step validation, progress bar, Maya intro per step
- Per-step saves to profiles table (only saves relevant fields per step — no clobbering)
- Generation screen with real checkmarks (not fake animation)
- Calls /api/foundation/generate — 5 parallel Anthropic calls, saves to foundation_documents table
- Sets foundation_complete = true AND onboarding_complete = true after >= 3 docs saved
- Redirects to /maya?new=true on completion

**Foundation Documents Table**
- foundation_documents: id, user_id, type (brief/icp/positioning/voice/plan), title, markdown, version, created_at, updated_at
- unique(user_id, type) constraint
- 5 document types confirmed saving with real content

**Profiles Table — New Columns**
- foundation_complete (boolean, default false)
- foundation_step (int, default 0)

**Maya — Informed Opening**
- app/maya/page.tsx fetches foundation_documents and passes to chat route
- app/api/maya/chat/route.ts injects all 5 documents into system prompt
- Maya opens with specific business context — does not ask for info already known
- Right panel shows "What Maya Knows" chips from profile data
- Competitors panel shows up to 3 competitors with "Watching..." status

**Campaign Builder**
- Trigger: keyword detection in MayaShell — "spinning up the campaign builder"
- Calls /api/maya/campaign/route.ts — 4000 token Anthropic call, structured JSON output
- JSON schema: title, summary, weeks[], quick_wins[], metrics_to_track[], budget_allocation
- Saves to campaigns table: id, user_id, title, plan (jsonb), status, created_at, updated_at
- Right panel renders: summary, quick wins, week-by-week task cards, metrics chips, Save button
- Save button shows "Plan saved ✓" confirmation, stays on /maya

**My Campaigns Page (/my-campaigns)**
- Server component fetches all campaigns for current user
- Campaign cards with title, date, Active badge
- "View plan" / "Hide plan" toggle
- Expandable week accordions
- Quick wins list
- Empty state with link to /maya
- "+ New campaign" button

**Routing Fixed**
- foundation/page.tsx no longer sets onboarding_complete = false
- generate route sets both foundation_complete and onboarding_complete = true
- savePlan no longer redirects to non-existent /my-campaigns or /dashboard
- No more redirect loops

### Known Issues
- Budget display discrepancy — Maya shows "$200-$500" instead of "$500-$1,500" (mapping bug in save-step)
- Duplicate profile rows — production user leaks into v2 Supabase (different clerk_user_id, same email)
- Mode selector not yet built
- Foundation documents viewer not yet built
- "Your business" in bottom left of Maya — should show company name

### What's Next (Priority Order)
1. Budget mapping fix — save-step route maps wrong budget value
2. Mode selector — 4 modes shown before first message: Build campaign, Create content, Analyze, Just talk
3. Foundation documents viewer — Brand Kit sidebar item shows all 5 documents, editable
4. Decide: V2 relationship to production — replace / premium tier / separate product
5. Agentic execution — agents actually running tasks, not just registered

### Workflow Note
Cursor struggled with complex multi-file changes. Claude Code (terminal) is significantly more reliable for this codebase. Use Claude Code for all future development on v2.

---

## Product Vision — Maya as the Intelligence Layer

Every section of the platform is a Maya briefing, not a data display.

Core principle: Maya doesn't show data — she interprets it, contextualizes it, and recommends action.

Pattern for every feature:
- Analytics → Maya reads GA + Meta via analytics_reader agent, surfaces insights conversationally
- Services → Maya tracks order status, flags issues, suggests improvements
- Content → Maya drafts based on calendar and brand voice, user approves
- Deliverables → Maya reviews against brief, flags mismatches before client sees them
- Competitors → competitor_watcher agent runs autonomously, Maya surfaces relevant moves

The agentic loop:
Agents collect data → Maya synthesizes → User responds/approves → Agents execute → Maya reports back

This means:
- No static pages with charts the user has to interpret
- Every metric change triggers a Maya insight
- Every agent output goes through Maya before the user sees it
- Maya educates the user on what's working, what's not, and what to do next

This is the core differentiator from every other marketing tool.
Inspiration: Mindtrip — you don't browse hotels, it builds your trip.
Agent7even V2 — you don't check your analytics, Maya tells you what matters.
