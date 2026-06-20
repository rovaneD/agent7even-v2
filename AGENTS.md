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
<!-- Last reviewed: June 18, 2026 — keep this date current at the end of every session -->

## Two related projects
- `~/agent7even/` — marketing site (agent7even.com) — deploys from `master` branch
- `~/agent7even-app/` — **production** client portal SaaS (app.agent7even.com) — separate repo; deploys from `main`
- **This folder** — experimental v2 (`rovaneD/agent7even-v2`, agent7even-v2.vercel.app) — port to production when ready; never edit `agent7even-app` from here

## Ground rules
1. Never revert changes without being told to. If unsure whether a change was intentional, ask before reverting.
2. Always check both projects before making changes. Pricing, CTAs, auth links, and the chatbot system prompt all have counterparts in both codebases.
3. Before any significant change, remind the user to commit what's working. After completing a feature, commit and push before moving on.
4. Source of truth: instructions in chat > CONTEXTV18.md > MAYA_CONTEXT_V09.md > code in this repo.
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
- **Social scheduling** — Buffer is OUT for multi-tenant publishing (verified June 4, 2026): legacy REST OAuth is closed to new developer app registrations (no new client_id), and the new GraphQL API is personal-key-only beta with no third-party end-user OAuth. Publer is dashboard-first, also not a multi-tenant fit. Leading candidate is **Zernio** (multi-tenant OAuth-as-a-service, white-label, per-account pricing, publish/fail webhooks) — pending verification (tenant isolation [open], cost caps [answered], support/reliability, data-handling/DPA) and gated behind the Exa pre-fill value test. Build behind a swappable `lib/social/publisher.ts` interface. Do NOT attempt Buffer OAuth. Details in `zernio_social_evaluation_backlog.md`.
- **Instagram Lucide icon** — does not exist. Use `Hash` icon instead.

## This app (agent7even-v2) — experimental
Changes are made deliberately and committed before moving on. Production lives
in `rovaneD/agent7even-app` and must not be touched from this folder.

## Current docs to read first
- `CONTEXTV18.md` — latest technical handoff (launch prep, auth/billing, lab5 homepage, analytics/GA, Zernio connect).
- `CONTEXTV17.md` — prior handoff (Zernio inbox, Stage 2 Idea Analysis, Viral Hooks UX).
- `MAYA_CONTEXT_V09.md` — current versioned Maya product context and visual rules.
- `MAYA_CONTEXT_V08.md` — prior Maya snapshot (superseded by V09).
- `PRODUCTION_GREENLIGHT.md` — go-live checklist for www.agent7even.ai.
- `zernio_inbox_phase_b_plan.md` — inbox Phase A/B build record (shipped June 14).
- `stage2_idea_analysis_plan.md` — Idea Analysis → Viral Hooks build record (shipped June 14).
- `SESSION_2026-06-18.md` — June 18 session log (homepage, auth, billing, analytics/GA, Zernio connect, docs).
- `SESSION_2026-06-11.md` — Foundation contamination fix, undo, reference-layer roadmap.
- `SESSION_2026-06-12.md` — June 12 session log (merge to main, Zernio/cache notes).
- `SESSION_2026-06-14.md` — June 14 session log (inbox, Stage 2, docs pass).
- `post_media_expansion_handoff.md` — scoped roadmap for crop, carousel, and video (planning; after v1 ships).
- `AUDIT_FIXES_2026-06-02.md` — audit fix ledger plus follow-on testing fixes.
- `11_foundation_answers_snapshot.sql` — applied in prod (Foundation undo verified June 11).
- `12_post_assets_bucket.sql` — applied in prod (post-assets bucket).
- `14_content_posting_agent_skill.sql` — applied in prod (Content Posting agent skill).
- `16_prevent_duplicate_client_emails.sql` — applied in prod (duplicate client email guard).
- `18_idea_analysis_skill.sql` — run in Supabase if not applied (Idea Analysis agent skill).

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
6. `git push` and let the GitHub/Vercel integration deploy the branch

**Safeguards in place:**
- `.git/hooks/pre-push` — blocks the push if there are uncommitted changes
- `.github/workflows/ci.yml` — runs TypeScript check + build on pushes
<!-- END:agent7even-product-rules -->
