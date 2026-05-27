## CRITICAL — REPO IDENTITY
This is **agent7even-v2** — the EXPERIMENTAL repo.
GitHub: github.com/rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app
Production app is at github.com/rovaneD/agent7even-app — **never touch it from this folder.**

---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:agent7even-product-rules -->
# Agent7even — Product & Workspace Rules
<!-- Last reviewed: May 26, 2026 — keep this date current at the end of every session -->

## Two related projects
- `~/agent7even/` — marketing site (agent7even.com) — deploys from `master` branch
- `~/agent7even-app/` — client portal SaaS app (app.agent7even.com) — **this project** — deploys from `main` branch

## Ground rules
1. Never revert changes without being told to. If unsure whether a change was intentional, ask before reverting.
2. Always check both projects before making changes. Pricing, CTAs, auth links, and the chatbot system prompt all have counterparts in both codebases.
3. Before any significant change, remind the user to commit what's working. After completing a feature, commit and push before moving on.
4. Source of truth: instructions in chat > CONTEXTV5.md > code in agent7even-app/ > code in agent7even/
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

## This app (agent7even-app/) — stable, do not touch unless asked
Changes are made deliberately and committed before moving on.

## Deployment rules — READ BEFORE ANY DEPLOY

**How production works:**
- `app.agent7even.com` is served by the Vercel project `agent7even-app`
- Vercel auto-deploys from GitHub on every push to `main`
- GitHub's auto-deploy ALWAYS wins the production alias — it will overwrite anything deployed via `vercel --prod` CLI if a new push arrives after
- Marketing site (`agent7even.com`) auto-deploys from `master` branch — always push with `git push origin master`

**Never do this:**
- Run `vercel --prod` with uncommitted local changes
- Push to `main` without first committing all in-progress changes

**Always do this:**
1. Finish a feature
2. `git add -A && git commit -m "..."` — commit everything
3. `git push` — GitHub auto-deploy takes it from here
4. Only run `vercel --prod` if the GitHub integration is broken AND all local changes are committed

**Safeguards in place:**
- `.git/hooks/pre-push` — blocks the push if there are uncommitted changes
- `.github/workflows/ci.yml` — runs TypeScript check + build on every push to main
<!-- END:agent7even-product-rules -->
