# CONTEXTV13 - Zernio Built, Exa Pre-fill Shipped, Marketing Site at Root
*Snapshot: June 9, 2026*

This document supersedes `CONTEXTV12.md`. Everything in V12 still applies
unless this file explicitly changes it.

## Repository State

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2          (verified via git remote -v, June 9, 2026)
Vercel: agent7even-v2.vercel.app
Current branch: main (latest commit 8a881b4, June 9, 2026)
Production repository: rovaneD/agent7even-app - do not touch from this folder
```

Before every push:

```bash
git remote -v
```

The remote must show `rovaneD/agent7even-v2`.

---

## What Changed Since CONTEXTV12

All items below are verified against `git log --since="2026-06-04"` (62 commits)
and the current working tree. Evidence file paths are cited per item.

1. **Exa Foundation pre-fill is BUILT and merged** (commit 378e4b5, June 5).
   V12 listed it as "NEXT FEATURE". It now exists:
   - `lib/research/exa.ts` exports `exaReadSite`, `exaFindCompetitors`,
     `exaSynthesizeFoundation`.
   - `app/api/foundation/research/route.ts` applies a per-field confidence gate
     (`CONFIDENCE_THRESHOLDS`): businessDescription/problemSolved/transformation/
     customerWho/differentiatorOwn require `high`, competitors requires `medium`.
     Voice and Budget/Goals fields are never pre-filled, as specified.
   - `app/api/foundation/save-exa-confirm/route.ts` persists confirmed fields.
   - The pre-step lives inside `app/foundation/FoundationFlow.tsx`.

2. **Foundation V2 Hub shipped** (commit 9bb7d20, June 5).
   `app/dashboard/foundation/FoundationHub.tsx` (~1,380 lines) with four tabs:
   Intelligence, Knowledge, Memory, Agent connections (tab array at line ~1199).
   New routes: `/api/foundation/ingest`, `/api/foundation/knowledge` (+ `[id]`),
   `/api/foundation/memory`, `/api/foundation/save-answers`. New extraction lib
   `lib/foundation/extract.ts`, new context loader `lib/agents/loadFoundationContext.ts`.
   New table `foundation_knowledge` plus `profiles.foundation_knowledge_count`
   (migration file `09_foundation_knowledge.sql`).

3. **Zernio is no longer an evaluation - it is built** (commit 6feae27 plus
   roughly 25 fix commits on June 8, and 0e17410 on June 9). V12 section X.6
   said "tracked as an EVALUATION (not a build)". The code now contains a full
   integration:
   - `lib/social/publisher.ts` (~600 lines): createProfile, listProfiles,
     getConnectUrl, disconnect, getSocialAnalytics, getDailyAnalytics,
     getBestTimeToPost, getPostingFrequency, getContentDecay, getFollowerStats,
     getAdsAnalytics, getInboxSummary, listPosts/getPost/createPost/updatePost/
     deletePost, presignMedia/uploadToPresignedUrl, listQueueSlots.
   - OAuth-style connect flow: `/api/integrations/zernio/{connect,callback,disconnect}`.
   - Analytics proxies: `/api/analytics/zernio/{social,ads,inbox}`.
   - The Stripe webhook (`app/api/webhooks/stripe/route.ts`, ~line 187)
     disconnects all Zernio accounts and clears `zernio_*` columns on
     subscription cancellation.
   - The swappable-publisher-interface rule from V12 was followed: everything
     goes through `lib/social/publisher.ts`.

4. **Posts section added to the dashboard** (commit 0e17410, June 9).
   Nav item "Posts" (`app/dashboard/DashboardShell.tsx` line 90), page at
   `/dashboard/posts` (`PostsClient.tsx`, ~1,126 lines: media upload, image
   previews, post type selector, per-platform captions, validation via
   `lib/social/postConstraints.ts`, queue picker). API routes: `/api/posts`,
   `/api/posts/[postId]`, `/api/posts/media`, `/api/posts/queues`. Parsers:
   `lib/social/zernioPostsParse.ts`, `lib/social/zernioQueuesParse.ts`.
   Access gate: `hasPermission(teamPerms, 'analytics')`
   (`app/dashboard/posts/page.tsx` line 41).

5. **Analytics page rebuilt (Analytics V2) and Google Analytics integrated**
   (commits faa53b0 June 5, c20fd03 June 7, 6602026 June 9).
   `app/dashboard/analytics/AnalyticsClient.tsx` now has three tabs:
   "Posting analytics", "Inbox analytics", "Google analytics"
   (`type PostingTab = 'posting' | 'inbox' | 'ga'`, line 927; TABS at line 3125).
   GA4 OAuth + data routes: `/api/analytics/{ga-connect,ga-callback,ga-data,
   ga-properties,connect,disconnect}` using `@google-analytics/data`.
   Meta routes also exist: `/api/analytics/{meta-connect,meta-callback,meta-data,
   meta-disconnect}`. Frontend event tracking: gtag.js tag `G-8913QV8Z1M` loaded
   in `app/layout.tsx` (lines 21-26), helper `lib/gtag.ts` (`trackEvent`),
   global type in `types/gtag.d.ts`. Mock-data system in `lib/analytics/mockData.ts`.

6. **Marketing site (lab5) promoted to the root of the app** (commit 9501406,
   June 9, plus the June 6-7 lab5 build commits). `app/page.tsx` re-exports
   `app/lab5/page.tsx`; same wrapper pattern for `/agents`, `/use-cases`,
   `/use-cases/[slug]`. Hero/CTA animations use `@paper-design/shaders-react`
   Metaballs, wrapped in `app/lab5/SafeMetaballs.tsx` (error boundary plus
   `webglcontextlost` listener with a static gradient fallback - fixes the
   Android Chrome white-box failure). Shared responsive nav with hamburger menu:
   `app/lab5/MarketingNav.tsx`. Logo: `public/agent7even_logo.svg`.
   `/pricing` (the live Stripe checkout page) was restyled white and kept
   functional.

7. **Public routes expanded** (`proxy.ts`): `/`, `/sign-in`, `/sign-up`,
   `/pricing`, `/privacy`, `/terms`, `/security`, `/agents`, `/use-cases(.*)`,
   the `lab*` experiments, `/api/webhooks(.*)`, `/api/analytics/ga-callback(.*)`,
   `/api/analytics/meta-callback(.*)`, `/api/team/accept(.*)`,
   `/api/agents/run/(.*)` (internal dispatch, secret-authenticated).

8. **Legal pages rebranded, /security added** (commit 8a881b4, June 9).
   `app/privacy/page.tsx` and `app/terms/page.tsx` now use
   `support@agent7even.ai` and `agent7even.ai`; new `app/security/page.tsx`.

9. **Sign-in always lands on /dashboard** (commit 8a881b4).
   `app/sign-in/[[...sign-in]]/page.tsx` sets `forceRedirectUrl="/dashboard"`.
   Sign-up still force-redirects to `/foundation`
   (`app/sign-up/[[...sign-up]]/page.tsx` line 14).

10. **Responsive passes** (commits e66b572, fc83340, 0343828, June 9):
    marketing pages and all dashboard pages were made mobile-responsive
    (`px-4 sm:px-8` canvases, responsive grids, `flex-wrap`, scrollable wide
    content, Maya panel as a mobile drawer).

11. **Stripe Growth monthly price corrected** (June 9 session, env-level).
    The Growth product's monthly price object was misconfigured at $49 in
    Stripe. A new $89/month price (`price_1TgVGMCjXyyqncdvdgHT5wzF`) was
    created, set as the product default, the $49 price archived, and
    `STRIPE_GROWTH_MONTHLY_PRICE_ID` updated in `.env.local`. No code change.

12. **shadcn/ui initialized** (commit e67ca19, June 5) with lab pages under
    `app/lab-*`; tokens merged into `app/globals.css`.

---

## 1. Visual System Status

Confirmed in `app/globals.css` (`:root` tokens):

- `--color-brand-primary: #3B82F6` (blue) remains the interaction color.
- `--color-brand-accent: #F5349B` (pink) remains logo/accent only.
- Surfaces are white/near-white (`--color-bg: #FCFCFC`, `--color-surface: #FFFFFF`,
  `--color-border: #E2E8F0`).
- Standard cards: white, `rounded-2xl`, `border-gray-100`, no default shadow.
  Dashboard Command Center and Agents Command Center heroes keep the
  soft-shadow exception.
- Centered constrained canvas (`mx-auto max-w-[1240px]`), now with responsive
  padding `px-4 sm:px-8`.

Caveat (measured June 9): dashboard TSX files contain roughly 600 hardcoded hex
values versus roughly 115 token (`var(--color-*)`) usages. The token system is
the rule but adoption in page code is partial. This is the main blocker for a
future platform dark mode.

The marketing site uses its own `--l5-*` token set in `app/lab5/styles.css`.

## 2. Onboarding and Billing Flow

Verified unchanged from V12:

- Foundation generation runs pre-checkout on the platform-funded path:
  `app/api/foundation/generate/route.ts` calls `runAgent` with
  `chargeCredits: false`.
- Completion routing (`app/foundation/FoundationFlow.tsx` line 240):
  selected plan -> `/checkout-now?plan=...`; no plan ->
  `/pricing?foundation=complete`.
- Maya no-credit modal CTA (`components/maya/MayChatPanel.tsx` line 393):
  has plan -> `/dashboard/billing`; no plan -> `/pricing?source=maya`.

New since V12: sign-in force-redirects to `/dashboard` (see change 9 above).
`/dashboard` redirects users with `foundation_complete = false` to
`/foundation` (`app/dashboard/page.tsx` lines 36-37), so onboarding gating is
preserved.

## 3. Route Inventory (June 9, 2026)

### Authenticated app pages

`/dashboard` plus: `agents`, `agents/approvals`, `agents/[agentId]/outputs`,
`ai-toolkit`, `analytics`, `billing`, `brand-kit`, `calendar`, `campaigns`,
`campaigns/new`, `campaigns/[id]`, `deliverables`, `foundation`,
`notifications`, `posts`, `services`, `services/inquiry`, `settings`,
`support`, `team`. Also `/foundation` (onboarding flow), `/checkout-now`,
`/maya`, `/my-campaigns`, and the `/admin` area.

Note: `/dashboard/ai-toolkit` exists as a page but has no entry in the sidebar
NAV constant (`app/dashboard/DashboardShell.tsx` lines 76-107) and no inbound
link was found in `app/` or `components/`.

### Public pages

`/` (marketing home), `/agents`, `/use-cases`, `/use-cases/[slug]`, `/pricing`,
`/privacy`, `/terms`, `/security`, `/sign-in`, `/sign-up`, plus `lab*`
experiment pages.

### API routes (116 route.ts files)

- `admin/*`: clients (list, [id], billing, email, notes, nudge,
  reset-foundation, update), cost, inquiries/update, notes,
  orders/update-status, settings/{update,update-prompt,update-service,update-user}
- `agents/*`: approvals (+bulk), constraints, content-writer,
  orchestrations/{active,recent}, outputs, run/[agentId],
  tasks (+create, [id]/approve, [id]/reject)
- `ai/*`: run-prompt, save-prompt
- `analytics/*`: connect, disconnect, ga-callback, ga-connect, ga-data,
  ga-properties, meta-callback, meta-connect, meta-data, meta-disconnect,
  zernio/{ads,inbox,social}
- `brand/*`: generate, save-answers, save-document
- `brand-kit/*`: root, assets (+[id]), colors (+[id]), documents, fonts,
  generate-colors, generate-fonts, regenerate, sections/complete
- `campaigns/*`: generate, list
- `cron/*`: allocate-credits, calculate-engagement, morning-digest,
  nudge-inactive, refresh-pricing, run-scheduled-agents
- `dashboard/dismiss-getting-started`
- `deliverables/*`: admin-upload, delete, download, upload
- `digest/*`: generate, [id], [id]/dismiss
- `foundation/*`: generate, ingest, knowledge (+[id]), memory, research,
  save-answers, save-exa-confirm, save-step, score
- `integrations/zernio/*`: connect, callback, disconnect
- `maya/*`: campaign, chat, session, sessions, task-complete, upload
- `notifications/mark-read`
- `onboarding/complete`
- `orders/*`: complete-self-serve, create, delete-self-serve
- `posts/*`: root, [postId], media, queues
- `services/inquiry`
- `settings/update`
- `stripe/*`: checkout, credits/checkout, portal
- `support/*`: create, reply, update
- `team/*`: accept, invite, remove, update
- `webhooks/*`: clerk, stripe

New since the V12 era: all of `posts/*`, `analytics/zernio/*`,
`analytics/ga-*`, `integrations/zernio/*`, `foundation/{ingest,knowledge,
memory,research,save-answers,save-exa-confirm}`.

## 4. Agent Runner and Cost Instrumentation

### The runner path (the rule)

`lib/agents/runner.ts` `runAgent()` is the instrumented path. Verified flow,
all writes awaited:

1. `createTask` inserts into `agent_tasks` (status pending, trigger, model,
   input, orchestration_id).
2. `updateTaskStatus(taskId, 'running')` sets `started_at`.
3. `deductCredits` (skipped when `chargeCredits: false`) via the atomic
   `deduct_credits` RPC in `lib/credits.ts`; throws `INSUFFICIENT_CREDITS`.
4. Model call through `openRouterComplete` / `openRouterCompleteWithFallback`
   (`lib/agents/openrouter.ts`).
5. `calculateCost` using live OpenRouter pricing (`lib/agents/cost.ts`,
   refreshed by `/api/cron/refresh-pricing`).
6. Insert into `agent_outputs` (tokens + cost_usd).
7. Update `agent_tasks` to completed with `input_tokens`, `output_tokens`,
   `cost_usd`, `model`, `completed_at`.
8. `rollupCostToOrchestration` updates `orchestration_sessions` totals and
   pauses on `budget_exceeded` (caps from `BUDGET_CAPS_USD[plan]`).
9. On failure: task set to failed, credits refunded via `refund_credits` RPC.

`/api/foundation/generate` is FIXED relative to the old direct-SDK concern:
it imports `runAgent`, `createOrchestrationSession`, `completeOrchestration`
from `lib/agents/runner` (lines 4-8), runs the five docs in parallel under one
orchestration (`triggered_by: 'foundation_generate'`, agent ids
`foundation_generate_<type>`), with `chargeCredits: false` (platform-funded).
No Anthropic SDK import remains in that file.

`/api/agents/run/[agentId]` (the internal dispatch route, secured by
`INTERNAL_JOB_SECRET`) uses the AI SDK `generateText` + `openrouter` from
`lib/ai/client`, then `saveAgentOutput`, `chargeAgentRun` (tokens + cost_usd
onto the pre-created task), and `updateTaskStatus('completed')`. Instrumented.

`/api/maya/chat` creates a task via `createTask`, deducts `CHAT_CREDITS`, and
writes `cost_usd` back onto `agent_tasks` (lines 272, 282, 343-357). Instrumented.

### Routes that bypass the runner (verified June 9)

Direct Anthropic SDK, module-level client init, no `agent_tasks` row, no
`cost_usd` write, no credit deduction:

- `app/api/ai/run-prompt/route.ts` - logs usage to `ai_tool_usage` (trial
  limit of 5 runs enforced) but records no dollar cost.
- `app/api/brand/generate/route.ts`
- `app/api/maya/campaign/route.ts`

Raw `openRouterComplete` without task/cost rows:

- `app/api/brand-kit/generate-colors/route.ts` and `generate-fonts` -
  deduct credits but write no `agent_tasks`/`cost_usd`.
- `app/api/campaigns/generate/route.ts` - deducts credits, no task/cost rows.
- `app/api/brand-kit/regenerate/route.ts`, `app/api/foundation/score/route.ts`,
  `app/api/maya/session/route.ts`, `app/api/orders/create/route.ts` -
  no credits, no task/cost rows.

Consequence: `/api/admin/cost` and the `v_account_month_cost` view undercount
real model spend by whatever these routes consume.

### Known weak points (places a write can be dropped)

- `refundCredits` calls are wrapped in `.catch(() => {})`
  (`runner.ts` lines 300 and 345; `agents/run/[agentId]/route.ts` line 107).
  A failed refund is silently swallowed.
- The `agent_outputs` insert in `runAgent` step 6 (`runner.ts` line 312) does
  not check the returned error; a failed insert would not fail the run.
- `chargeAgentRun` writes tokens/cost but not status/`completed_at`; callers
  must also call `updateTaskStatus`. The one current caller
  (`agents/run/[agentId]`) does.

### Completion timestamps

`updateTaskStatus` (`runner.ts` lines 213-225) writes `started_at` on running
and `completed_at` on completed/failed. `runAgent` step 7 also writes
`completed_at` directly. The write exists and is awaited.

## 5. Foundation Completion Gate

`app/api/foundation/generate/route.ts` lines 159-173: `foundation_complete`
is set to true only when ALL documents in the run saved successfully AND no
`sections` filter was passed - i.e. a full five-document generation (brief,
icp, positioning, voice, plan). The same update sets `onboarding_complete:
true` and `foundation_step: 5`. Partial regenerations never flip the flag.

Related gates: `/foundation` redirects to `/dashboard/foundation` when
`foundation_complete` or `foundation_step >= 5` (`app/foundation/page.tsx`
lines 44-45); `/dashboard` redirects to `/foundation` when not complete
(`app/dashboard/page.tsx` lines 36-37).

## 6. Supabase Schema as Used by Code

Tables referenced via `.from('...')` across `app/` and `lib/` (June 9):

profiles, agent_tasks, agent_outputs, agent_skills, agent_schedules,
agent_constraints, orchestration_sessions, credit_balances, credit_ledger,
credit_topups, foundation_documents, foundation_knowledge,
foundation_field_scores, brand_documents, brand_document_versions,
brand_answers, brand_kit_sections, brand_kit_colors, brand_kit_fonts,
brand_kit_assets, campaigns, daily_digests, maya_sessions, deliverables,
orders, projects, project_inquiries, services, notifications, support_tickets,
support_messages, team_members, platform_settings, prompt_library,
saved_prompts, ai_tool_usage, oauth_states, client_activity_log, admin_notes,
admin_email_log, and the view v_account_month_cost.

Credit RPCs: `deduct_credits`, `refund_credits` (called from `lib/credits.ts`).

New/changed profile columns the code relies on:

- Zernio: `zernio_profile_id`, `zernio_profile_ids` (text[]),
  `zernio_connected_platforms` (jsonb), `zernio_connected_at`
  (migrations `05_zernio_columns.sql`, `10_zernio_profile_ids.sql`).
- Google Analytics: `ga_connected`, `ga_refresh_token`, plus GA property
  fields used by `/api/analytics/connect` and `ga-data`.
- Meta: `meta_connected` plus related fields in the `meta-*` routes.
- Foundation: `foundation_knowledge_count` (`09_foundation_knowledge.sql`).

Schema/code mismatch flags:

- `analytics_briefings` is created in `05_zernio_columns.sql` but no code
  reads or writes it (grep across `app/` and `lib/` returns nothing). It is
  forward provisioning for a briefing feature.
- The migration files `05_zernio_columns.sql`, `09_foundation_knowledge.sql`,
  and `10_zernio_profile_ids.sql` are untracked files in the repo root. Code
  in production depends on these columns existing.

## 7. Stack and Integration Pins (verified in package.json / config)

- Next.js `16.2.6`, React `19.2.4`. Middleware file is `proxy.ts` (Next 16
  convention), not `middleware.ts`. Confirmed present at repo root.
- Stripe `^22.1.1`; API version pinned in `lib/stripe.ts` line 10:
  `'2026-04-22.dahlia' as any`. The never-use rule for `'2025-04-30.basil'`
  stands.
- Clerk `@clerk/nextjs ^7.4.0`.
- AI SDK `ai ^6.0.191`; OpenRouter via raw fetch in `lib/agents/openrouter.ts`
  and via `lib/ai/client.ts` for `generateText`/`streamText`.
- `@anthropic-ai/sdk ^0.98.0` (only the three bypass routes in section 4).
- `exa-js ^2.13.0` - live, used by `lib/research/exa.ts`.
- `@google-analytics/data ^6.0.0` - GA4 Data API.
- Resend `^6.12.3`.
- `@paper-design/shaders-react ^0.0.76` - marketing metaballs.
- recharts `^3.8.1`, lucide-react `^1.17.0` (Instagram icon still does not
  exist in Lucide; `Hash` used instead).
- Env validation: `lib/env.ts` requires Clerk/Supabase/Stripe/OpenRouter/
  Resend/cron/internal-job vars; feature-gates Team seats, Credit top-ups,
  Google OAuth, Google service account, Meta OAuth, Anthropic, `EXA_API_KEY`,
  `ZERNIO_API_KEY`.

## 8. Verification Workflow

Unchanged from V12 and exercised on June 9:

```bash
npx tsc --noEmit
git diff --check
npm run build
git remote -v
git push
```

`.git/hooks/pre-push` still blocks pushes with uncommitted changes.
`.github/workflows/ci.yml` still runs TypeScript check + build.

## 9. Current Source Files

The latest docs to read are now:

- `CONTEXTV13.md` (this file)
- `MAYA_CONTEXT_V04.md`
- `AUDIT_FIXES_2026-06-02.md`
- `zernio_social_evaluation_backlog.md` (historical: the evaluation that
  preceded the build)
- `exa_foundation_prefill_handoff.md` (historical: the pre-fill build spec)

## 10. Current Priority

The marketing site, Posts section, Zernio analytics, and GA4 integration are
live on `main`. Parked next items, in the order they were raised:

1. Dark mode: marketing site first (token set is ready), platform later
   (requires a hardcoded-hex-to-token sweep across ~40 dashboard files).
2. Cost-instrumentation cleanup: migrate the bypass routes in section 4 onto
   the runner so admin cost reporting is complete.
3. Reconcile the platform agent registry with the marketing roster (see
   MAYA_CONTEXT_V04 section on the roster mismatch).

---

## X.1 Exa Status Update (supersedes V12 X.1-X.5 queue state)

The Foundation pre-fill is built and merged (see change 1). The architecture
matches the V12 spec: shared lib at `lib/research/exa.ts`, fail-soft functions,
confidence gating in the route, voice/budget never pre-filled, platform-funded.
`lib/env.ts` gates the feature on `EXA_API_KEY`.

What V12 planned but is NOT yet in code: `exaSearchTopic`, `exaResearchCompany`,
and the fleet-wide tiered grounding rollout (Light/Standard/Deep). The
template-to-agent map in V12 X.4 remains the roadmap, still gated on pre-fill
results.

## X.2 Zernio Status Update (supersedes V12 X.6)

Buffer remains OUT (unchanged). Zernio moved from evaluation to build during
June 7-9: connect/callback/disconnect OAuth flow, social/ads/inbox analytics,
full posts CRUD with media and queues, and webhook-driven disconnect on
subscription cancellation. All Zernio API access flows through
`lib/social/publisher.ts`, preserving the swappable-interface rule. Known
operational behavior encoded in the code: 402 free-tier limit handling,
"already exists" profile recovery, `zernio_profile_ids` array fan-out for
multi-profile accounts, and `accountId` scoping for analytics.

The V12 vendor gates (tenant isolation, support/reliability, DPA) were never
marked resolved in any tracked file - see UNVERIFIED.

---

## UNVERIFIED - NEEDS ROVANE CONFIRMATION

1. Production domain: is `agent7even.ai` now pointing at the `agent7even-v2`
   Vercel project, and is `agent7even-v2.vercel.app` still the canonical
   deploy URL? The repo cannot confirm DNS or Vercel domain assignment.
2. Vercel environment variables: `.env.local` now contains the corrected
   `STRIPE_GROWTH_MONTHLY_PRICE_ID`, Google OAuth credentials, the Google
   service-account pair, `EXA_API_KEY`, and `ZERNIO_API_KEY`. Have all of
   these been mirrored into the Vercel project (Preview AND Production scopes,
   per the V12 rule)?
3. Have the untracked SQL migrations (`05_zernio_columns.sql`,
   `09_foundation_knowledge.sql`, `10_zernio_profile_ids.sql`) all been run
   against the live Supabase instance? Code assumes yes.
4. Zernio vendor gates from V12 X.6 (tenant isolation, support/reliability,
   data-handling/DPA): were these answered before the build proceeded, or did
   the build supersede the evaluation?
5. Exa pre-fill A/B test: the feature is in code - is the
   `NEXT_PUBLIC_EXA_PREFILL_ENABLED` flag on in production, and has the 50/50
   value test described in V12 actually been run/measured?
6. `/dashboard/ai-toolkit` has no sidebar nav entry and no inbound links were
   found. Is it intentionally hidden, pending removal, or should it be
   re-linked?
7. `analytics_briefings` table is provisioned but unused. Still planned for a
   briefing feature, or should the migration be dropped?
8. Is `design-system/color-tokens` still meant to be described as "the active
   visual-system validation branch" (AGENTS.md), given all June work landed
   directly on `main`?
