## REPO IDENTITY — READ FIRST
This is the EXPERIMENTAL v2 app.
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app
Production app lives at rovaneD/agent7even-app — never touch it from this folder.
Before every push: run `git remote -v` and confirm it shows agent7even-v2.

---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:agent7even-product-rules -->
# Agent7even — Product & Workspace Rules
<!-- Last reviewed: July 7, 2026 — keep this date current at the end of every session -->

## Two related projects
- `~/agent7even/` — marketing site (agent7even.com) — deploys from `master` branch
- `~/agent7even-app/` — **production** client portal SaaS (app.agent7even.com) — separate repo; deploys from `main`
- **This folder** — experimental v2 (`rovaneD/agent7even-v2`, agent7even-v2.vercel.app) — port to production when ready; never edit `agent7even-app` from here

## Ground rules
1. Never revert changes without being told to. If unsure whether a change was intentional, ask before reverting.
2. Always check both projects before making changes. Pricing, CTAs, auth links, and the chatbot system prompt all have counterparts in both codebases.
3. Before any significant change, remind the user to commit what's working. After completing a feature, commit and push before moving on.
4. Source of truth: instructions in chat > CONTEXTV25.md > CONTEXTV24.md > CONTEXTV23.md > CONTEXTV22.md > MAYA_CONTEXT_V10.md > code in this repo.
5. At the end of every session: review and update AGENTS.md if anything changed, and ensure the latest CONTEXT version reflects all work done.

## Current product direction (do not revert)
Agent7even is a SaaS subscription platform — not a one-time project agency.

**3 subscription tiers:**
- Starter — $49/mo ($490/yr) — 3-day free trial (Starter only)
- Growth — $89/mo ($890/yr) — no trial, charged immediately
- ProAgent — $149/mo ($1,490/yr) — no trial, charged immediately

**Trial:** Starter only — 3-day free trial. Card collected upfront, no charge for 3 days. Limits during trial: 5 AI Toolkit runs total, Brand Kit locked. After trial converts to paid, normal Starter limits apply.

**Team seats:** $15/mo per extra seat beyond plan's included seats (Starter: 1, Growth: 3, ProAgent: 5). `STRIPE_SEAT_PRICE_ID = price_1TbBQ6CjXyyqncdvakHy4jce`

**CTA standard:**
- Nav / footer "Sign up" → `https://app.agent7even.com/sign-up`
- Primary marketing CTAs "Start your free trial" → `https://app.agent7even.com/pricing`
- Pricing — Starter: "Start your free trial" · Growth/ProAgent: "Get started"
- No "Book a free call" anywhere

**Add-on services** are available inside the platform. No prices shown on marketing site. Design & Development and Packaging Design require scope — route to inquiry form, not order modal.

## Stripe API version
Always use `'2026-04-22.dahlia'` cast as `as any`. **Never use `'2025-04-30.basil'`** — causes build failure.

## Middleware filename
Next.js 16 uses `proxy.ts` not `middleware.ts`.

## Key third-party notes
- **Social scheduling** — Buffer is OUT for multi-tenant publishing (verified June 4, 2026). Publer is dashboard-first, also not a multi-tenant fit. **Zernio** is the integrated publisher (`lib/social/publisher.ts`). **DPA:** Agent7even signed Jul 2026 — await Zernio confirmation before onboarding client social accounts; SOC 2 Type II + GDPR attestation on file under trust-center NDA. Tenant isolation (scoped keys) still pending written answer. Details: `zernio_social_evaluation_backlog.md`, `CONTEXTV22.md` §8.
- **Instagram Lucide icon** — does not exist. Use `Hash` icon instead.

## This app (agent7even-v2) — experimental
Changes are made deliberately and committed before moving on. Production lives
in `rovaneD/agent7even-app` and must not be touched from this folder.

## Current docs to read first
- `CONTEXTV25.md` — latest product handoff: Foundation knowledge in agent/Maya context, team workspace guards, Memory observations, Guardian theme policy, July 7 critical invite/proposal guards.
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

## Key implementation notes (July 2026)
- **Canonical profile resolution:** `lib/profiles/resolveClerkProfile.ts` — use for any Clerk-scoped API route or page that reads `profiles`. Billing: `getBillingProfileForClerkUser`. Dashboard: `getDashboardProfileForClerkUser`. Analytics SSR: `getAnalyticsProfileForClerkUser`. GA OAuth: `lib/analytics/gaOAuthProfile.ts` (`saveGaOAuthTokensForClerkUser` saves by profile **id**). Never `.eq('clerk_user_id').single()` when duplicates may exist.
- **Agent guided setup:** dedicated run pages at `/dashboard/agents/[agentId]/run` — not modals on Command Center hub (`lib/agents/guidedSetup.ts`).
- **Pending approval count SSOT:** `lib/agents/pendingApprovals.ts` — count/list from `agent_outputs.status = 'pending_approval'`. Used by dashboard brief, lifecycle bar, sidebar badge, Agents Command Center, digest generate, and approvals API. Do not reintroduce `Math.max` with `daily_digests.approvals` or parallel `agent_tasks`-only counts for surfacing.
- **Foundation competitors:** store as `string[]` via `lib/foundation/competitorsArray.ts` — never comma-split prose into slots.
- **Structured approval views:** Campaign Builder, Ad Variations, Email Sequence use dedicated parsers + view components in `lib/agents/*Parse.ts` and `components/agents/*OutputView.tsx`.
- **Foundation site snapshot:** `34_foundation_site_snapshot.sql` + `lib/foundation/siteSnapshot.ts` — separate from guarded Phase 1 answers; enable via `site_snapshot_enabled`.
- **Foundation Intelligence:** Observer changelog (`32_foundation_changelog.sql`) → Guardian proposals (`33_foundation_proposals.sql`) → user proposal surface (`36`/`37` + `FoundationProposalsPanel.tsx`). Thresholds: `lib/foundation/guardian/guardianConfig.ts`. Batch: `scripts/run-foundation-guardian.ts`.

## Current visual-system rules
- Primary CTAs, links, focus, and selected actions use blue `#3B82F6`.
- Pink `#F5349B` is reserved for the logo and restrained accent moments (e.g. “Maya” in hero).
- Standard dashboard cards use white surfaces, `rounded-2xl`, `border-gray-100`, and no default shadow.
- Marketing homepage cards (`.lcard`, `.use`) use white surfaces, cropped product UI widgets at bottom — see `CONTEXTV18.md`.
- The Dashboard Command Center and Agents Command Center hero cards are intentional soft-shadow exceptions.
- Dashboard pages use a centered constrained canvas with internally left-aligned content.

## Deployment rules — READ BEFORE ANY DEPLOY

**How this v2 project works:**
- `agent7even-v2.vercel.app` is served by the Vercel project `agent7even-v2`
- GitHub branch pushes create Vercel deployments for this experimental project
- **`main`** is the active integration branch (merged June 12, 2026)
- Production app deployment rules belong to `rovaneD/agent7even-app`, not this repo

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
