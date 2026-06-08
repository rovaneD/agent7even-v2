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
<!-- Last reviewed: June 8, 2026 — keep this date current at the end of every session -->

## Two related projects
- `~/agent7even/` — marketing site (agent7even.com) — deploys from `master` branch
- `~/agent7even-app/` — client portal SaaS app (app.agent7even.com) — **this project** — deploys from `main` branch

## Ground rules
1. Never revert changes without being told to. If unsure whether a change was intentional, ask before reverting.
2. Always check both projects before making changes. Pricing, CTAs, auth links, and the chatbot system prompt all have counterparts in both codebases.
3. Before any significant change, remind the user to commit what's working. After completing a feature, commit and push before moving on.
4. Source of truth: instructions in chat > CONTEXTV11.md > MAYA_CONTEXT_V02.md > code in this repo.
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
- **Buffer** — do NOT attempt OAuth integration. Buffer stopped accepting new developer OAuth registrations as of 2026. Use Later or Publer for social scheduling instead.
- **Instagram Lucide icon** — does not exist. Use `Hash` icon instead.

## This app (agent7even-v2) — experimental
Changes are made deliberately and committed before moving on. Production lives
in `rovaneD/agent7even-app` and must not be touched from this folder.

## Current docs to read first
- `CONTEXTV11.md` — latest technical/product handoff for the design-system branch.
- `MAYA_CONTEXT_V02.md` — current versioned Maya product context and visual rules.
- `AUDIT_FIXES_2026-06-02.md` — audit fix ledger plus follow-on testing fixes.

## Current visual-system rules
- Primary CTAs, links, focus, and selected actions use blue `#3B82F6`.
- Pink `#F5349B` is reserved for the logo and restrained accent moments.
- Standard dashboard cards use white surfaces, `rounded-2xl`, `border-gray-100`, and no default shadow.
- The Dashboard Command Center and Agents Command Center hero cards are intentional soft-shadow exceptions.
- Dashboard pages use a centered constrained canvas with internally left-aligned content.

## Deployment rules — READ BEFORE ANY DEPLOY

**How this v2 project works:**
- `agent7even-v2.vercel.app` is served by the Vercel project `agent7even-v2`
- GitHub branch pushes create Vercel deployments for this experimental project
- `design-system/color-tokens` is the active visual-system validation branch
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
