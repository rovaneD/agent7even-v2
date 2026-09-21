# CONTEXTV31 — Homepage HeaderBack, Maya Phase 2, production cron repair
*Snapshot: September 21, 2026 — supersedes `CONTEXTV30.md`*

---

## Repository state

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Production URL: https://www.agent7even.ai  (also agent7even-v2.vercel.app)
Vercel project: agent7even-v2 (team plan: Pro)
Supabase project: jianzyolobriaqpttamt (Agent7 — currently Free tier; inactivity pause warning Sep 2026)
Branch: main
Latest remote: b98889c (cron sharp fix)
Prior handoff: CONTEXTV30 (July 24 — onboarding v2, trial gate, agents UX)
```

**Deploy workflow:** push to `main` → Vercel auto-deploys. Before push: `git remote -v` → `rovaneD/agent7even-v2`. Pre-push hook blocks uncommitted tracked changes.

---

## What changed since CONTEXTV30 (index)

| Area | Doc |
|------|-----|
| Production homepage → HeaderBack left-aligned hero | **§1** |
| Marketing footer social links | **§2** |
| Trialing QA profiles (all tiers) | **§3** |
| Internal account billing email guard | **§4** |
| Maya Phase 2 — per-member sessions, dead path removal | **§5** |
| Schema snapshot + `chat_sessions` drop | **§6** |
| Vercel cron repair (Clerk 404 + sharp 500) | **§7** |
| Open items / follow-ups | **§8** |
| Carry-forward from V30 | **§9** |

Full commit ledger: `SESSION_2026-09-21.md`.

---

## 1. Homepage — HeaderBack left-aligned hero (`4662694`, `bbe55fd`, `6c3b1ea`)

**Production `/` no longer uses scroll-story variant B.** It now renders `HomepageLeftHeaderBack` (`app/design-concept/homepage-left-header-back/`).

| Surface | Route | Component |
|---------|-------|-----------|
| **Live homepage** | `/` | `HomepageLeftHeaderBack` — left-aligned copy, `HeaderBack.jpg` backdrop, **static** dashboard mockup |
| Scroll-story variant B (preserved) | `/design-concept/homepage-site-brand-b` | `HomepageSiteBrandStoryB` — desktop scroll-story, mobile auto-play |
| Legacy hero | `/lab5` | prior marketing hero |

**Do not revert AGENTS.md or CONTEXT docs to “scroll-story on `/`”** — that was true through July 2026 (`74573d5` … `704c316`) but superseded August 2026.

---

## 2. Marketing footer social links (`d8ff9cc`)

Facebook, Instagram, and LinkedIn links added to the shared marketing footer (`components/marketing/`).

---

## 3. Trialing QA profiles — all paid tiers (`4cd59c0`)

QA / test harness now requires trialing profiles for **Starter, Growth, and ProAgent** — not Growth-only. See scripts or env docs referencing trialing QA if present.

---

## 4. Internal account billing guard (`e9ca38a`)

Stripe webhook lifecycle emails and churn side-effects **skip** profiles where `role` is `admin` or `owner`, or `billing_exempt` is true. Prevents internal/demo accounts from receiving payment-failed noise or unintended churn mutations.

---

## 5. Maya Phase 2 (`db1de76`)

Recon + ship from Maya architecture audit. **Verified live** (Aug 2026).

| Item | Before | After |
|------|--------|-------|
| **Session list scope** | Workspace owner id in some paths | **`maya_sessions.user_id = acting profile id`** (`app/dashboard/layout.tsx` L60 → `p.id`) — teammates see their own sessions, not cross-leak |
| **MayaShell** | Dead orchestration UI | **Removed** (`MayaShell.tsx` deleted) |
| **runOrchestration()** | Unused orchestration path | **Removed** — Foundation voice uses direct generation; F6 verified zero-cost path still works |
| **chatSurface validation** | Client-trusted | Server validates in `/api/maya/chat` |
| **`/api/maya/campaign`** | Orphan after MayaShell | Route retained; **zero callers** after F5 — safe to delete in a future cleanup pass |
| **`chat_sessions` table** | Empty orphan | **Dropped** from prod + code (F3, `1332923`) |

**Maya context unchanged:** `hooks/useMayaContext.ts` → `window.__MAYA_CANVAS_CONTEXT__`; `DashboardShell` clears on pathname change during render.

**Doc SSOT for Maya product UX:** still `MAYA_CONTEXT_V10.md` for image gen/Assets; **`MAYA_CONTEXT_V11.md`** for Phase 2 session/orchestration changes.

---

## 6. Database schema snapshot (`1332923`, `e6e7fb9`)

- Live schema captured via `scripts/pg-dump-schema.sh` → `db/schema_live_2026-08-21.sql` (5039 lines, constraints + RLS).
- **`chat_sessions` removed** — was 0 rows, no app references after F3 code pass.
- **`db/README.md`** — workflow + known drift documented.
- **`maya_sessions`:** multiple sessions per profile intentional; list query uses `(user_id, updated_at DESC)` composite index (live-confirmed).

**Env for pg_dump:** `DIRECT_URL` or `SUPABASE_DB_URL` in `.env.local`; pooler host `aws-1-us-east-1.pooler.supabase.com` for project `jianzyolobriaqpttamt`.

---

## 7. Vercel cron repair (`ad09f74`, `3a489c7`, `b98889c`) — Sep 9, 2026

**Symptom:** Supabase Free-tier inactivity warning — crons had not been hitting the database for weeks.

**Root cause 1 — Clerk proxy (404):** Vercel cron sends `Authorization: Bearer CRON_SECRET`. Clerk `auth.protect()` treated that as an invalid JWT and returned **404** (`protect-rewrite`) before handlers ran.

**Fix:** `proxy.ts` — add `/api/cron(.*)` and `/api/digest/generate` to `isPublicRoute` (same pattern as `/api/webhooks(.*)`). Handlers still require cron bearer; digest also accepts signed-in workspace session.

**Root cause 2 — sharp module load (500):** After Clerk fix, `/api/cron/run-scheduled-agents` crashed at startup — Turbopack bundled `sharp` transitively via `dispatch` → `executeAgentRun` → `visionCaption` → `postAssetsImagePayload`.

**Fix (`b98889c`):**
- `next.config.ts` — `serverExternalPackages: ['sharp']`
- Lazy `import('sharp')` in `postAssetsImagePayload.ts`
- Dynamic `import('@/lib/agents/executeAgentRun')` in `dispatch.ts`
- Dynamic import of compress helper in `visionCaption.ts`

**Verified production (Sep 9, 2026):** unauthenticated probe → **401** (not 404/500). Vercel deployment `dpl_CVS1sD8rYhmVQAXvAer3BUiAPU4X`.

**Verification script:** `scripts/verify-cron-public-proxy.ts`

**Cron routes (`vercel.json`):**

| Route | Schedule |
|-------|----------|
| `/api/cron/run-scheduled-agents` | Hourly |
| `/api/cron/refresh-pricing` | Every 6h |
| `/api/cron/calculate-engagement` | Daily 06:00 UTC |
| `/api/cron/nudge-inactive` | Daily 09:00 UTC |
| `/api/cron/morning-digest` | Daily 12:00 UTC |
| `/api/cron/allocate-credits` | 1st of month |

---

## 8. Open items

1. **Supabase Pro upgrade** — production DB `jianzyolobriaqpttamt` on Free tier; auto-pause after ~7 days low activity. Crons now restore activity but **Pro is the durable fix** for a paying-customer database.
2. **Team workspace critical fixes (PRs #48–#60)** — merged to **preview branches only** as of Sep 21, 2026; **not yet on `main`**. Covers teammate workspace scoping (Brand Kit, campaigns, deliverables, inbox, AI Toolkit, agent outputs, etc.). Merge queue when validated.
3. **`45_agent_run_failed_notification_type.sql`** — confirm applied before relying on failed-run notifications (carried from V30).
4. **Legacy `.com` URL fallbacks** — several modules still default to `app.agent7even.com` when env unset; SSOT is `lib/siteUrls.ts` (carried from V30).
5. **`agent7even.com` redirect** — still open (`PRODUCTION_GREENLIGHT.md` §2).
6. **Resend sending domain** — still `hello@agent7even.com` (carried from V30).
7. **Preview `CRON_SECRET` unset** — preview cron invocations fail auth (`Bearer undefined`); production only matters for Supabase activity.
8. **First cron tick after repair** — may catch up overdue `agent_schedules` in one burst (pre-existing behavior).

---

## 9. Carry-forward from CONTEXTV30

Unchanged unless this doc overrides:

- Website-first Foundation onboarding + trial v2 (`lib/billing/trialPolicy.ts`, `/start-trial`)
- Admin delete account (`lib/admin/deleteClientAccount.ts`)
- `resolveClerkProfile` — never raw `.eq('clerk_user_id').single()`
- `hasPlatformAccess` — paid API gate
- Pending approvals SSOT — `lib/agents/pendingApprovals.ts`
- Autonomous agent schedules + `advanceAgentScheduleNextRun`
- DeferredChrome — cookie banner + GA marketing-only
- Zernio live for paying customers (Jul 8, 2026)

---

*Last reviewed: September 21, 2026*
