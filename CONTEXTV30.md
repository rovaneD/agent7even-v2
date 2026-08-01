# CONTEXTV30 — Website-first onboarding, trial v2, agents UX hardening
*Snapshot: July 24, 2026 (updated July 28 — domain correction in §10) — supersedes `CONTEXTV29.md`*

---

## Repository state

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Production URL: https://www.agent7even.ai  (also agent7even-v2.vercel.app)
Vercel project: agent7even-v2
Branch: main
Latest remote: 704c316 (Agents Command Center scroll fix)
Prior handoff: CONTEXTV29 (July 20 — post-audit phases, scroll-story homepage)
```

**Deploy workflow:** push to `main` → Vercel auto-deploys. Before push: `git remote -v` → `rovaneD/agent7even-v2`. Pre-push hook blocks uncommitted tracked changes.

---

## What changed since CONTEXTV29 (index)

| Area | Doc |
|------|-----|
| Website-first Foundation onboarding + complete flow | **§1** |
| Trial billing v2 (7-day, tier-neutral) + subscription gate | **§2** |
| Admin delete account + signup notify | **§3** |
| Maya Foundation Hub actuation | **§4** |
| Marketing/auth copy refresh | **§5** |
| Agent schedules + auto-output clarity + scroll UX | **§6** |
| Homepage polish (Jul 20–23) | **§7** |
| AGENTS.md domain + CTA correction (Jul 28) | **§10** |
| Open items / follow-ups | **§8** |
| Carry-forward from V29 | **§9** |

Full commit ledger: `SESSION_2026-07-24.md`.

---

## 1. Website-first Foundation onboarding (`5e214d1`)

Replaced the old Foundation research race with a URL-driven synthesis → confirm → generate flow.

**Backend:**
- `lib/foundation/onboardFromWebsite.ts` — Exa read + synthesis, merges with `enrichFromWebsite`, returns normalized `OnboardingAnswers` + checklist.
- `lib/foundation/synthesizeOnboardingAnswers.ts` — maps enrichment output to all Foundation answer fields.
- `lib/foundation/runFoundationGeneration.ts` — shared doc generation after confirm.
- `POST /api/foundation/onboard-from-website` — public/authed entry for URL onboarding.
- `POST /api/foundation/complete-onboarding` — score, generate Foundation docs, mark complete, seed schedules.

**UI:**
- `app/foundation/FoundationFlow.tsx` — calls onboard API; no artificial 6s cap on loading.
- `components/foundation/FoundationOnboardConfirm.tsx` — “Looks good” confirm CTA; shows checklist from synthesis.

**Flow:** Sign up → Foundation URL step → synthesis loading → confirm screen → complete-onboarding → dashboard with Foundation complete.

---

## 2. Trial billing v2 + subscription gate (`5e214d1`, `4ee6a55`)

**SSOT:** `lib/billing/trialPolicy.ts`

| Constant | Value |
|----------|-------|
| `TRIAL_DAYS` | 7 |
| `FIRST_CHARGE_DAY` | 8 |
| `TRIAL_TOOLKIT_RUNS` | 5 (during trial) |
| `TRIAL_MEDIA_CREDITS` | 25 |
| `TRIAL_LABEL` | `7-day free trial` |

- **Tier-neutral:** all paid tiers (Starter, Growth, ProAgent) start via Stripe checkout with a 7-day trial; card collected upfront; charge on day 8.
- **Trial signal:** `isProfileOnTrial()` reads Stripe subscription `status === 'trialing'` — not `profiles.status` (webhook maps trialing → active).
- **`/start-trial`** — post-sign-up gate when profile lacks subscription; plan picker + checkout (`app/start-trial/`).
- **`lib/billing/activateCheckoutSession.ts`** — checkout sync / recovery for profiles missing subscription data.
- **`lib/billing/subscriptionGate.ts`** — `ensurePaidSubscriptionForClerkUser`, `profileBypassesSubscriptionGate`.
- **Admin/owner bypass (`4ee6a55`):** `role === 'admin' | 'owner'` or `billing_exempt` skips `/start-trial` redirect on dashboard entry.

**Limits during trial:** 5 AI Toolkit runs total, Brand Kit locked (unchanged from audit Phase 3). After trial converts, normal plan limits apply.

**Copy surfaces:** import from `trialPolicy.ts` — auth (`lib/auth/authContent.ts`, `clerkLocalization.ts`), homepage trust line, `/start-trial`.

---

## 3. Admin delete + signup notify (`5e214d1`)

**Permanent client delete:**
- `lib/admin/deleteClientAccount.ts` — Stripe cancel, Zernio teardown, cascade delete user/profile tables, Clerk user delete.
- `POST /api/admin/clients/[id]/delete`
- UI: `ClientHealthView.tsx` (⋯ menu), `ClientDetail.tsx` (Quick actions) — confirmation modals.

**Guards:** no self-delete; no admin/owner targets; no workspace owner with team members.

**Signup notify:** `lib/notifyAdminNewSignup.ts` — wired from `ensureProfile.ts` + Clerk webhook (dev/new signup alert).

---

## 4. Maya Foundation Hub actuation (`5e214d1`)

- `lib/foundation/hubFormActuation.ts` — structured patch application for Foundation Hub fields.
- `app/dashboard/foundation/FoundationHub.tsx` — consumes actuation from Maya.
- `lib/maya/formActuation.ts` — streaming JSON strip so Maya responses don't leak raw JSON into chat.

---

## 5. Marketing + auth copy (`ecb48b4`, `e262765`)

**Auth (`lib/auth/authContent.ts`, `components/auth/AuthMarketingShell.tsx`):**
- Bullets: Foundation, agents, approval queue (not legacy AI Toolkit / Live Analytics / Managed Services).
- Headline restored: pink **“AI-powered marketing for small business.”**
- Approval copy: ongoing — “You approve before anything goes live” (not “approve once”).
- Foundation bullet: no em dash.

**Homepage (`HomepageSiteBrandStoryB.tsx`, `lab5/page.tsx`, `VsSchedulingCompareSection.tsx`):**
- Same approval messaging as auth.
- Maya subline + orb centered as one block (`homepage-site-brand-b.css`).
- Trial trust line uses 7-day copy from `trialPolicy`.

**Earlier homepage polish (`a3da327`, `879cbbb`):** reduced repetitive feature-block copy; dropped fake counts from checklists.

---

## 6. Agents Command Center (`182b07a`, `704c316`)

**Schedule overdue fix:**
- Root cause: cron skipped runs without advancing `next_run_at` → UI showed perpetual “Due now” while `last_run_at` was stale (e.g. July 7).
- `advanceAgentScheduleNextRun()` — shared helper; cron always bumps `next_run_at` on skip/failure/complete.
- `reconcileStaleAgentSchedules()` — on Agents page load, rolls schedules stuck >6h overdue forward.
- UI: honest overdue labels instead of misleading “Due now”.

**Auto vs approval output clarity:**
- Autonomous agents (`autonomyLevel: 'autonomous'`) save outputs as **approved** — they do **not** land in the approval queue.
- Empty approval banner + Recent outputs copy updated; auto outputs badge: **Saved** vs **Approved**.

**Scroll UX (`704c316`):** removed `max-h-[360px] overflow-y-auto` from Live activity + Scorecard in `AgentCommandCenter.tsx` — single vertical scroll via `DashboardShell` `<main>`.

---

## 7. Homepage polish (Jul 20–23, pre-onboarding ship)

| Commit | Summary |
|--------|---------|
| `cefa02b` | Docs pass to V29; `/design-concept(.*)` public in `proxy.ts` |
| `a3da327` | Feature-block copy variety; FAQ de-duplication |
| `879cbbb` | Drop fake checklist counts on homepage/lab5 |

---

## 8. Open items

1. **Mobile hero polish** — stage scaling on very narrow widths (carried from V29).
2. **`45_agent_run_failed_notification_type.sql`** — confirm applied in Supabase before relying on failed-run notifications in prod.
3. **Untracked design-concept GSAP experiments** — may break local full-repo `tsc`/`build` if present; not on main.
4. **Vercel Production env** — confirm `OPENROUTER_VIDEO_WEBHOOK_SECRET`, credit price IDs; `NEXT_PUBLIC_APP_URL=https://www.agent7even.ai` on Production.
5. **Legacy `.com` URL fallbacks in code** — several modules still default to `https://app.agent7even.com` when env unset (`createNotification.ts`, `openrouter.ts`, `lib/ai/client.ts`, cron routes). Canonical SSOT is `lib/siteUrls.ts`. Fix in a separate commit.
6. **`agent7even.com` redirect** — decision open; see `PRODUCTION_GREENLIGHT.md` §2.
7. **Resend sending domain** — still `hello@agent7even.com`; `support@agent7even.ai` not stood up (blocks Ask Maya widget).
8. **Marketing agent cards** — legacy agents on marketing page still folded into Content Posting; in-app roster differs by design.

---

## 9. Carry-forward from CONTEXTV29

- **`hasPlatformAccess`** — paid API gate; see V29 §3.
- **`resolveClerkProfile`** — canonical profile lookup; never raw `.eq('clerk_user_id').single()`.
- **Pending approvals SSOT** — `lib/agents/pendingApprovals.ts` (`agent_outputs.status = 'pending_approval'`).
- **Live homepage (`/`)** — `HomepageSiteBrandStoryB`; old hero at `/lab5`.
- **Maya context** — `__MAYA_CANVAS_CONTEXT__` snapshot + DashboardShell render-time clear.
- **DeferredChrome** — cookie banner + GA marketing-only; includes `/start-trial`.

---

## 10. AGENTS.md domain correction (July 28, 2026)

Closes the deferred item from `CONTEXTV27.md` line 138 (`.com` CTA URLs in `AGENTS.md`).

**What changed (docs only):**
- `AGENTS.md` repo identity: this repo is the **live** product on `www.agent7even.ai`, not experimental v2.
- Properties table: `.ai` = live; `app.agent7even.com` and `agent7even.com` = legacy/frozen.
- CTA standard: internal routes only (`/sign-up`, `/pricing`); all tiers “Start your free trial”; never emit `.com` URLs in code.
- Deployment rules: no separate production repo; Zernio live warning retained.
- `README.md` aligned (live product wording, legacy portal frozen).

**Redirect decision:** still open (`PRODUCTION_GREENLIGHT.md` §2). Docs written for “redirect pending” — legacy `.com` properties marked frozen without asserting redirect exists.

**Canonical URL SSOT in code:** `lib/siteUrls.ts` (`CANONICAL_SITE_URL`, `CANONICAL_APP_URL` → `https://www.agent7even.ai`).

**Still not in scope:** user migration from legacy `.com` accounts; Resend domain move to `.ai`.
