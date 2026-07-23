# CONTEXTV29 — Post-audit hardening, homepage scroll-story hero
*Snapshot: July 20, 2026 — supersedes `CONTEXTV28.md`*

---

## Repository state

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Production URL: https://www.agent7even.ai  (also agent7even-v2.vercel.app)
Vercel project: agent7even-v2
Branch: main
Latest remote: a3e1eca (hero spacing — stage farther below copy)
Prior handoff: CONTEXTV28 (July 13 — profile resolution audit, dead routes)
```

**Deploy workflow:** push to `main` → Vercel auto-deploys. Before push: `git remote -v` → `rovaneD/agent7even-v2`. Pre-push hook blocks uncommitted tracked changes (stash unrelated edits like local `proxy.ts` if needed).

---

## What changed since CONTEXTV28 (index)

| Area | Doc |
|------|-----|
| Full product audit (read-only) + 4 fix phases | **§1** |
| Autonomous agent schedules + Maya context | **§2** |
| Billing / platform access enforcement | **§3** |
| Marketing homepage + analytics chrome | **§4** |
| Open items / follow-ups | **§5** |
| Carry-forward from V28 | **§6** |

Full commit ledger: `SESSION_2026-07-20.md`.

---

## 1. Product audit + fix phases (July 18–19)

Read-only audit across agents, billing, foundation, Maya/notifications, dashboard UX, and marketing/API hygiene. Findings grouped into four shipped phases:

**Phase 1 — security + billing lifecycle** (`2b6a0cd`)
- Auth-gate `POST /api/digest/generate` (CRON_SECRET or workspace owner).
- OpenRouter video webhook fails closed when secret unset.
- Stripe webhook: deactivate schedules on `subscription.deleted`, reactivate on checkout; map `subscription.updated` status to `profiles.status`.
- `stripe/checkout`: update existing subscription instead of creating duplicates.
- Brand Kit trial lock server-side (page + generate APIs + `useBrandVoice` in run-prompt).
- Cron `run-scheduled-agents`: skip paused/churned users.

**Phase 2 — keep product promises** (`cddfa60`)
- Brand Voice Guardian labeled on-request (key off `defaultSchedule`, not `autonomyLevel`).
- Foundation wizard persists draft answers; step clamp prevents lockout.
- Remove dead dashboard ContextMenu; **AI Toolkit** linked in sidebar.
- Morning digest deep-link → `/dashboard/agents/approvals?task=…`.
- UTC labels on marketing agents schedule copy.

**Phase 3 — enforce UI claims server-side** (`eb6f509`)
- `hasPlatformAccess(plan, status, billing_exempt)` gates paid APIs (run-prompt, orders, agent tasks, image/video gen).
- AI Toolkit category tier gates in `run-prompt` via `lib/ai/toolkitCategoryPlan.ts`.
- Service-request limits (`PLAN_SERVICE_REQUESTS`), seat billing guard on team invite, approval guards.
- Canonical billing profile resolution in Stripe flows.

**Phase 4 — product polish** (`c2d3a55`)
- Maya context on Content Posting steps; re-greet on navigation when panel open.
- `trial_will_end` Stripe webhook + in-app/email notification.
- `agent_run_failed` notification for scheduled run failures (`45_agent_run_failed_notification_type.sql` — **run in Supabase if not applied**).
- Schedule pause/resume UI + `PATCH /api/agents/schedules/[id]`.
- Modal a11y (Escape, focus trap, aria-labels on icon buttons).
- Default OG image (`app/opengraph-image.tsx`); `robots.ts` disallows lab/design routes.
- Pink cleanup on analytics banner, billing chart, Meta connect notice.

**Post-phase:** Cookie banner + GA tag scoped to marketing only (`DeferredChrome.tsx`). Maya context race fix via `window.__MAYA_CANVAS_CONTEXT__` + DashboardShell render-time clear (`aefc17a`, `dc07d97`).

---

## 2. Agents + Maya

**Autonomous schedules** (`c2fa91c`, extended in Phase 4):
- `lib/agents/ensureDefaultAgentSchedules.ts` seeds `agent_schedules` from `registry.ts` when Foundation completes (+ Agents page backfill).
- `computeNextRunAt` shared with schedules PATCH API.
- Agent Command Center: Foundation banner, schedule panel, pause/resume.

**Maya page context:**
- `hooks/useMayaContext.ts` snapshots latest context globally for late listeners.
- `MayChatPanel.tsx`: 700ms wait for rich `canvasData`; re-greet on nav if user hasn't typed.
- `DashboardShell.tsx`: clear `canvasData` during render on pathname change (not in effect — avoids wiping child dispatch).

**Performance Digest:** prompt requires connected analytics signals; no fabrication when GA disconnected.

---

## 3. Billing + access (implementation SSOT)

- **`hasPlatformAccess`** — `lib/plans.ts`: requires paid plan **and** `profiles.status === 'active'` (or null), unless `billing_exempt`.
- **Trial Brand Kit lock** — `lib/billing/brandKitLock.ts` + server routes.
- **Pending approvals** — still SSOT from `agent_outputs.status = 'pending_approval'` (`lib/agents/pendingApprovals.ts`).
- **Stripe API version** — `'2026-04-22.dahlia'` as `as any`.
- **Webhook:** subscribe to `customer.subscription.trial_will_end` in Stripe dashboard (verified Jul 2026).

---

## 4. Marketing homepage (July 20)

**Live homepage (`/`):** `app/page.tsx` → `HomepageSiteBrandStoryB` (`app/design-concept/homepage-site-brand-b/`).

| Route | Purpose |
|-------|---------|
| `/` | Scroll-story hero (variant B) + production below-the-fold sections |
| `/lab5` | Previous homepage preserved for A/B comparison |
| `/design-concept/homepage-site-brand-b` | Same hero with design-concept preview banner |

**Hero behavior:**
- **Desktop (>860px):** sticky viewport, 750vh scroll track, smoothed progress (`SMOOTHING = 0.14`), WebGL metaballs bleeding off edges, production `HeroDashboardMockup`-style stage content.
- **Mobile (≤860px):** document-flow layout — copy, then stage, then narration. Story **auto-plays** when stage enters viewport (~14s loop); no scroll-scrubbing (fixes orb detachment and type-over-UI overlap).
- **Copy:** eyebrow / display headline / Maya subline / body / blue CTA / 3-day trial trust line. Intentional `<br />` breaks to avoid widows.
- **Spacing:** `HERO_STAGE_GAP = 80px` between trust line and mockup (desktop); mobile stage `margin-top: 44px`.

**Below-the-fold:** unchanged production sections from `Lab5HomePage` (trust strip, StackCompare, How it works, features, FAQ, dark CTA, footer). `mockups.js` lazy-loaded as before.

**Analytics chrome:** `components/analytics/DeferredChrome.tsx` — cookie banner + GA only outside `/dashboard`, `/admin`, `/foundation`, `/maya`, `/sign-in`, `/sign-up`. Vercel Analytics sitewide.

**Prior marketing work (still relevant):** cookie consent banner, Vercel Analytics events, lab5 pricing CTA tracking, Teams journey section, mobile LCP pass (SSR hero mockup, deferred metaballs on mobile).

---

## 5. Open items

1. **Mobile hero polish** — stage scaling on very narrow widths; user flagged "needs further work" after ship.
2. **`45_agent_run_failed_notification_type.sql`** — confirm applied in Supabase before relying on failed-run notifications in prod.
3. **Local `npm run build`** fails on untracked `app/design-concept/components/*` (missing `gsap`) — those files are not on `main`; either install gsap for local experiments or keep them out of typecheck path.
4. **Uncommitted local `proxy.ts`** — adds `/design-concept(.*)` public route; not pushed.
5. **Vercel Production env** — still confirm `OPENROUTER_VIDEO_WEBHOOK_SECRET`, credit price IDs (from V28).
6. **PR #29** (Cursor billing-enforcement follow-up) — review/merge separately if not already on `main`.
7. **Marketing agent cards** — two legacy agents (`post_caption`, `weekly_content`) still on marketing page as folded-into Content Posting; in-app roster differs by design.

---

## 6. Carry-forward from CONTEXTV28

- Stripe live checkout QA on `www.agent7even.ai/pricing` — manual.
- First production Zernio connect (pilot) — `vendor/zernio/go_live_runbook.md`.
- ~~AI Toolkit unreachable~~ — **fixed** (sidebar link added Phase 2).
