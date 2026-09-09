## REPO IDENTITY — READ FIRST
This repo is the LIVE customer-facing product.
GitHub: rovaneD/agent7even-v2
Vercel project: agent7even-v2
Serves: https://www.agent7even.ai (primary) and agent7even-v2.vercel.app
Pushing to `main` deploys to real customers. Treat it as production.
Legacy portal `rovaneD/agent7even-app` (app.agent7even.com) is frozen — never touch it from this folder.
Before every push: run `git remote -v` and confirm it shows agent7even-v2.

---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:agent7even-product-rules -->
# Agent7even — Product & Workspace Rules
<!-- Last reviewed: September 4, 2026 — keep this date current at the end of every session -->

## Properties

| Property | Repo | Status |
|----------|------|--------|
| `www.agent7even.ai` | **this repo** (`rovaneD/agent7even-v2`) | **Live product.** Marketing site and app in one Next.js app. |
| `app.agent7even.com` | `~/agent7even-app/` (`rovaneD/agent7even-app`) | Legacy portal. Frozen. Do not edit or deploy from here. |
| `agent7even.com` | `~/agent7even/` (`master`) | Legacy marketing site. Redirect decision open — see `PRODUCTION_GREENLIGHT.md` §2. |

`.ai` is a replacement for both `.com` properties, not a companion. It is self-contained
and must not link to either of them.

## Ground rules
1. Never revert changes without being told to. If unsure whether a change was intentional, ask before reverting.
2. Do not port CTAs, auth links, or app URLs between repos. `.ai` is self-contained; the legacy `.com` repos are frozen. Pricing and product claims must still stay consistent wherever they appear.
3. Before any significant change, remind the user to commit what's working. After completing a feature, commit and push before moving on.
4. Source of truth: instructions in chat > CONTEXTV30.md > CONTEXTV29.md > CONTEXTV28.md > CONTEXTV27.md > CONTEXTV26.md > CONTEXTV25.md > CONTEXTV24.md > CONTEXTV23.md > CONTEXTV22.md > MAYA_CONTEXT_V10.md > code in this repo.
5. At the end of every session: review and update AGENTS.md if anything changed, and ensure the latest CONTEXT version reflects all work done.

## Current product direction (do not revert)
Agent7even is a SaaS subscription platform — not a one-time project agency.

**3 subscription tiers:**
- Starter — $49/mo ($490/yr)
- Growth — $89/mo ($890/yr)
- ProAgent — $149/mo ($1,490/yr)

**Trial:** 7-day free trial on all paid tiers (`lib/billing/trialPolicy.ts`). Card collected upfront; first charge on day 8. Limits during trial: 5 AI Toolkit runs total, Brand Kit locked. Trial signal is Stripe `subscription.status === 'trialing'` — use `isProfileOnTrial()`, not plan name alone. Post-sign-up gate: `/start-trial` when profile lacks subscription (admin/owner/billing_exempt bypass via `profileBypassesSubscriptionGate()`).

**Team seats:** $15/mo per extra seat beyond plan's included seats (Starter: 1, Growth: 3, ProAgent: 5). `STRIPE_SEAT_PRICE_ID = price_1TbBQ6CjXyyqncdvakHy4jce`

**CTA standard** (this repo — internal routes, never absolute `.com` URLs):
- Nav / footer "Sign up" → `/sign-up`
- Primary marketing CTAs "Start your free trial" → `/pricing`
- Pricing — all three tiers: "Start your free trial" (trial is tier-neutral, see `lib/billing/trialPolicy.ts`)
- No "Book a free call" anywhere
- Never emit `app.agent7even.com` or `agent7even.com` in this codebase. Only exception: `hello@agent7even.com` as the Resend sender until the sending domain moves to `.ai`.

**Add-on services** are available inside the platform. No prices shown on marketing site. Design & Development and Packaging Design require scope — route to inquiry form, not order modal.

## Stripe API version
Always use `'2026-04-22.dahlia'` cast as `as any`. **Never use `'2025-04-30.basil'`** — causes build failure.

## Middleware filename
Next.js 16 uses `proxy.ts` not `middleware.ts`.
`/api/cron(.*)` and `/api/digest/generate` must stay in `isPublicRoute`. Vercel cron sends `Authorization: Bearer CRON_SECRET`, which is not a Clerk JWT — `auth.protect()` rewrites those requests to 404 (`protect-rewrite`, `token-invalid`). Route handlers still enforce the cron bearer (digest generate also accepts a signed-in workspace session).

## Key third-party notes
- **Social scheduling** — Buffer is OUT for multi-tenant publishing (verified June 4, 2026). Publer is dashboard-first, also not a multi-tenant fit. **Zernio** is the integrated publisher (`lib/social/publisher.ts`). **DPA:** Signed both sides (Trust Center, Jul 2026). **Go-live (Jul 8, 2026):** Zernio cleared paying customers' live social accounts. Runbook: `vendor/zernio/go_live_runbook.md`; readiness: `scripts/verify-zernio-go-live-readiness.ts`. Tenant isolation answers still in chat (non-blocking pilot). Details: `vendor/zernio/`, `zernio_social_evaluation_backlog.md`.
- **Instagram Lucide icon** — does not exist. Use `Hash` icon instead.

## This app (agent7even-v2) — live
Changes are made deliberately and committed before moving on. Pushes to `main`
reach paying customers on `www.agent7even.ai`. The legacy portal in
`rovaneD/agent7even-app` is frozen and must not be touched from this folder.

## Current docs to read first
- `CONTEXTV30.md` — latest handoff: website-first onboarding, trial v2 (7-day tier-neutral), admin delete, Maya hub actuation, auth/homepage copy, agent schedule fixes, Agents scroll UX (July 24, 2026).
- `SESSION_2026-07-24.md` — July 20–24 session log (onboarding, trial gate, agents UX, commits through `704c316`).
- `CONTEXTV29.md` — prior handoff: post-audit Phases 1–4, autonomous schedules, billing enforcement, Maya context fixes, scroll-story homepage hero on `/` (old hero at `/lab5`) (July 20, 2026).
- `SESSION_2026-07-20.md` — July 13–20 session log (audit fixes, homepage swap, mobile auto-play hero, commits through `a3e1eca`).
- `CONTEXTV28.md` — prior handoff: full codebase audit — `resolveClerkProfile` enforced at all 45 call sites, 16 dead API routes deleted, proxy/env cleanup, pre-push guard created (July 13, 2026).
- `SESSION_2026-07-13.md` — July 13 session log (audit findings + fixes, commit 8aa8719).
- `CONTEXTV27.md` — prior handoff: production launch audit (Clerk live on `.ai`), mobile modal scroll shell, blog hydration fix, Zernio OAuth request host (July 9, 2026 evening).
- `CONTEXTV26.md` — July 9 morning: Team Phase 5 notes (assignment + approval), Activity feed previews, Foundation classification backfill, Zernio go-live runbook.
- `SESSION_2026-07-09.md` — July 9 session log (launch audit, modal scroll, blog, Zernio OAuth, commit 9791696).
- `CONTEXTV25.md` — July 6 handoff: Foundation knowledge in agent/Maya context, team workspace guards, Memory observations, Guardian theme policy.
- `SESSION_2026-07-06.md` — July 6 session log (knowledge context, Zernio/generation-floor guards, ship validation).
- `CONTEXTV24.md` — July 4 handoff: transactional email complete, Guardian proposal surface, layers v0, profile DB clean.
- `CONTEXTV23.md` — prior handoff: duplicate profile resolution, Agents run sub-pages, Foundation site snapshot, GA OAuth fix (July 3, 2026).
- `SESSION_2026-07-03.md` — July 3 session log (commits 7002bb6 … 5a2a2c1 + doc pass).
- `CONTEXTV22.md` — prior handoff: Thread 3 lifecycle v1, Phase A crop, Zernio DPA/compliance (§8), structured output views, approval count SSOT (July 2, 2026).
- `SESSION_2026-07-01.md` — July 1 session log (commits c949a77 … b889cc6 + doc pass).
- `CONTEXTV21.md` — lab5 marketing homepage hero (approval-first), FAQ/agents channels, mobile mockup fixes (June 25, 2026).
- `SESSION_2026-06-25.md` — June 25 session log (5 commits: hero rebuild, mockups, channels, mobile, approval copy).
- `CONTEXTV20.md` — Content Posting 3-step UX (hub → format picker → setup), platform formats, brand icons, back-nav rules.
- `CONTEXTV19.md` — prior handoff (image gen v1.1, video gen v1 + hardening, creative assets, brief QA).
- `CONTEXTV18.md` — prior handoff (launch prep, auth/billing, lab5 homepage, analytics/GA, Zernio connect).
- `MAYA_CONTEXT_V10.md` — current versioned Maya product context (image gen UX, Assets, brief safety).
- `MAYA_CONTEXT_V09.md` — prior Maya snapshot (homepage, inbox, scheduling FAQ).
- `creative_generation_handoff.md` — v1 spec + v1.1 addendum (June 21).
- `SESSION_2026-06-23.md` — June 23 session log (Content Posting workflow UX: hub, format picker, platform previews, nav fixes).
- `SESSION_2026-06-22.md` — June 22 session log (video gen debug: Convoy HMAC, data envelope, unsigned_urls auth, reconcile endpoint, model catalog fix, generating card, pricing analysis).
- `SESSION_2026-06-21-video-generation.md` — June 21 video generation ship (async OpenRouter video, webhook, approval queue).
- `SESSION_2026-06-21.md` — June 21 session log (Assets + generation hardening ship).
- `SESSION_2026-06-20-creative-generation.md` — June 20 v1 generate ship.
- `PRODUCTION_GREENLIGHT.md` — go-live checklist for www.agent7even.ai.
- `zernio_inbox_phase_b_plan.md` — inbox Phase A/B build record (shipped June 14).
- `stage2_idea_analysis_plan.md` — Idea Analysis → Viral Hooks build record (shipped June 14).
- `SESSION_2026-06-18.md` — June 18 session log (homepage, auth, billing, analytics/GA, Zernio connect, docs).
- `SESSION_2026-06-11.md` — Foundation contamination fix, undo, reference-layer roadmap.
- `SESSION_2026-06-12.md` — June 12 session log (merge to main, Zernio/cache notes).
- `SESSION_2026-06-14.md` — June 14 session log (inbox, Stage 2, docs pass).
- `post_media_expansion_handoff.md` — scoped roadmap for crop, carousel, and video (user-supplied media; generation is separate).
- `AUDIT_FIXES_2026-06-02.md` — audit fix ledger plus follow-on testing fixes.
- `11_foundation_answers_snapshot.sql` — applied in prod (Foundation undo verified June 11).
- `12_post_assets_bucket.sql` — applied in prod (post-assets bucket).
- `14_content_posting_agent_skill.sql` — applied in prod (Content Posting agent skill).
- `16_prevent_duplicate_client_emails.sql` — applied in prod (duplicate client email guard).
- `18_idea_analysis_skill.sql` — run in Supabase if not applied (Idea Analysis agent skill).
- `19_creative_assets.sql` — creative asset library base table (**run if not applied**).
- `20_creative_assets_extend.sql` — `brief`, `qa_passed` on creative_assets (**run if not applied**).
- `21_creative_asset_folders.sql` — asset folders (**run if not applied**).
- `22_post_assets_allow_video.sql` — add `video/mp4` to post-assets bucket (**run before enabling video flag**).
- `23_creative_direction_cache.sql` — cache Creative Direction on profiles (**applied in Supabase June 23, 2026**).
- `34_foundation_site_snapshot.sql` — site snapshot columns on `profiles` (**applied**).
- `35_notifications_type_check.sql` — `approval_pending` in notifications CHECK (**applied**).
- `36_foundation_proposal_decisions.sql` — proposal user decisions (**run if not applied**).
- `37_foundation_layers.sql` — approved Foundation evolution layers (**run if not applied**).
- `41_foundation_knowledge_classification.sql` — upload purpose tags on `foundation_knowledge` (**applied Jul 8, 2026**).
- `45_agent_run_failed_notification_type.sql` — `agent_run_failed` in notifications CHECK (**run before deploying the failed-run notification, added Jul 18, 2026**).

## Key implementation notes (July 2026)
- **Canonical profile resolution:** `lib/profiles/resolveClerkProfile.ts` — use for any Clerk-scoped API route or page that reads `profiles`. Billing: `getBillingProfileForClerkUser`. Dashboard: `getDashboardProfileForClerkUser`. Analytics SSR: `getAnalyticsProfileForClerkUser`. GA OAuth: `lib/analytics/gaOAuthProfile.ts` (`saveGaOAuthTokensForClerkUser` saves by profile **id**). Never `.eq('clerk_user_id').single()` when duplicates may exist — enforced repo-wide July 13, 2026 (commit `8aa8719`); the pattern greps to zero, keep it that way.
- **Paid feature access:** API routes must use `hasPlatformAccess(profile.plan, profile.status, profile.billing_exempt)` rather than checking `profile.plan` alone. Failed payments retain the paid plan while setting `status = 'paused'`; plan-only gates let delinquent accounts invoke paid provider work.
- **Trial + subscription gate:** SSOT `lib/billing/trialPolicy.ts` (7-day, tier-neutral, day-8 charge). Gate helpers in `lib/billing/subscriptionGate.ts`; checkout recovery in `activateCheckoutSession.ts`. Dashboard entry redirects to `/start-trial` without subscription unless `profileBypassesSubscriptionGate()` (admin/owner/billing_exempt).
- **Website-first onboarding:** `POST /api/foundation/onboard-from-website` → confirm (`FoundationOnboardConfirm`) → `POST /api/foundation/complete-onboarding`. Core: `onboardFromWebsite.ts`, `synthesizeOnboardingAnswers.ts`, `runFoundationGeneration.ts`.
- **Admin delete account:** `lib/admin/deleteClientAccount.ts` + `POST /api/admin/clients/[id]/delete`. Guards: no self-delete, no admin/owner, no owner with team. UI in `ClientHealthView` + `ClientDetail`.
- **Autonomous agent schedules:** `lib/agents/ensureDefaultAgentSchedules.ts` seeds `agent_schedules` when Foundation completes (+ Agents page backfill). Cron always advances `next_run_at` via `advanceAgentScheduleNextRun`; `reconcileStaleAgentSchedules` on Agents page load. Pause/resume: `PATCH /api/agents/schedules/[id]`; UI in `AgentCommandCenter` SchedulesPanel. Cron skips paused/churned users (`run-scheduled-agents`).
- **Auto vs approval outputs:** `autonomyLevel: 'autonomous'` agents save outputs as approved — not in approval queue. Find in scorecard / Recent outputs / `/dashboard/agents/[id]/outputs`. Pending queue SSOT remains `pendingApprovals.ts`.
- **Maya page context:** `hooks/useMayaContext.ts` snapshots to `window.__MAYA_CANVAS_CONTEXT__` for late listeners. `DashboardShell` clears `canvasData` during render on pathname change (not in an effect). `MayChatPanel` waits for rich `canvasData` before greeting; re-greets on nav if user hasn't typed.
- **Marketing homepage hero:** `/` renders `HomepageSiteBrandStoryB` (`app/design-concept/homepage-site-brand-b/`). Desktop: scroll-story sticky hero. Mobile (≤860px): auto-play story when stage enters view. Previous hero preserved at `/lab5`.
- **Analytics / cookie chrome:** `components/analytics/DeferredChrome.tsx` — cookie banner + GA only outside app prefixes (`/dashboard`, `/admin`, `/foundation`, `/maya`, `/sign-in`, `/sign-up`, `/start-trial`). Vercel Analytics sitewide.
- **Agent guided setup:** dedicated run pages at `/dashboard/agents/[agentId]/run` — not modals on Command Center hub (`lib/agents/guidedSetup.ts`).
- **Pending approval count SSOT:** `lib/agents/pendingApprovals.ts` — count/list from `agent_outputs.status = 'pending_approval'`. Used by dashboard brief, lifecycle bar, sidebar badge, Agents Command Center, digest generate, and approvals API. Do not reintroduce `Math.max` with `daily_digests.approvals` or parallel `agent_tasks`-only counts for surfacing.
- **Foundation competitors:** store as `string[]` via `lib/foundation/competitorsArray.ts` — never comma-split prose into slots.
- **Structured approval views:** Campaign Builder, Ad Variations, Email Sequence use dedicated parsers + view components in `lib/agents/*Parse.ts` and `components/agents/*OutputView.tsx`.
- **Foundation site snapshot:** `34_foundation_site_snapshot.sql` + `lib/foundation/siteSnapshot.ts` — separate from guarded Phase 1 answers; enable via `site_snapshot_enabled`.
- **Foundation Intelligence:** Observer changelog (`32_foundation_changelog.sql`) → Guardian proposals (`33_foundation_proposals.sql`) → user proposal surface (`36`/`37` + `FoundationProposalsPanel.tsx`). Thresholds: `lib/foundation/guardian/guardianConfig.ts`. Batch: `scripts/run-foundation-guardian.ts`.
- **Dashboard modals (mobile):** Tall forms use `components/ui/DashboardModal.tsx` (`DashboardModalShell` + `DashboardModalScrollBody`) — `max-h-[90dvh]` with scrollable body. Do not use bare `overflow-hidden` on modal panels without a scroll region.
- **Production readiness:** `npx tsx scripts/verify-production-readiness.ts --production-only` — live `.ai` checks without failing on local test keys. Step-by-step launch: `PRODUCTION_LAUNCH_SESSION.md`.

## Current visual-system rules
- Primary CTAs, links, focus, and selected actions use blue `#3B82F6`.
- Pink `#F5349B` is reserved for the logo and restrained accent moments (e.g. “Maya” in hero).
- Standard dashboard cards use white surfaces, `rounded-2xl`, `border-gray-100`, and no default shadow.
- Marketing homepage cards (`.lcard`, `.use`) use white surfaces, cropped product UI widgets at bottom — see `CONTEXTV18.md`.
- Live homepage hero (`/`) uses scroll-story variant B — display headline, centered Maya subline with `MayaOrb`, production dashboard mockup stage; below-the-fold sections match lab5. Approval copy: “You approve before anything goes live.” See `CONTEXTV30.md` §5–§6.
- The Dashboard Command Center and Agents Command Center hero cards are intentional soft-shadow exceptions.
- Dashboard pages use a centered constrained canvas with internally left-aligned content.

## Deployment rules — READ BEFORE ANY DEPLOY

**How this project works:**
- The Vercel project `agent7even-v2` serves `www.agent7even.ai` and `agent7even-v2.vercel.app`
- GitHub branch pushes create Vercel deployments; `main` deploys to the live domain
- **`main`** is the active integration branch (merged June 12, 2026)
- There is no separate production repo to deploy. This is it.
- Zernio is live with paying customers' social accounts (Jul 8, 2026). A bad push can affect real publishing.

**Never do this:**
- Run `vercel --prod` with uncommitted local changes
- Push without confirming `git remote -v` shows `rovaneD/agent7even-v2`
- Touch or deploy `rovaneD/agent7even-app` from this folder

**Always do this:**
1. Finish a feature
2. Preserve unrelated user changes; do not stage or revert them
3. Run TypeScript, diff, and build verification
4. Commit the intended files
5. Run `git remote -v`
6. `git push origin main` and let the GitHub/Vercel integration deploy (direct to `main` unless a change needs PR review)

**Safeguards in place:**
- `.git/hooks/pre-push` — blocks the push if there are uncommitted changes
- `.github/workflows/ci.yml` — runs TypeScript check + build on pushes
<!-- END:agent7even-product-rules -->
