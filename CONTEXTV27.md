# CONTEXTV27 — Launch readiness audit, mobile modals, blog + Zernio OAuth fixes
*Snapshot: July 11, 2026 — supersedes `CONTEXTV26.md` for logged-in + launch work*

---

## Repository state

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Production URL: https://www.agent7even.ai
Vercel project: agent7even-v2
Branch: main
Latest remote: 9791696 (mobile modals, blog hydration, Zernio OAuth host)
Prior handoff: CONTEXTV26 (July 9 morning — Phase 5 threads, Foundation, Zernio go-live)
```

**Deploy workflow:** push to `main` → Vercel auto-deploys. Before push: `git remote -v` → `rovaneD/agent7even-v2`.

---

## What changed since CONTEXTV26 (index)

| Area | Doc |
|------|-----|
| Production launch audit — Clerk live on `.ai` | **§1** |
| Mobile dashboard modal scroll (locked on iOS) | **§2** |
| Blog index hydration — nested `<a>` fix | **§3** |
| Zernio OAuth callback host from request | **§4** |
| Bulk approval owner guard | **§5** |
| Carry-forward from V26 (Phase 5, Foundation, Activity) | **§6** |

---

## 1. Production launch readiness (July 9 audit)

**Live site check:**

```bash
npx tsx scripts/verify-production-readiness.ts --production-only --url https://www.agent7even.ai
```

**10/10 passed** (July 9): legal routes, pricing, sign-up; **`pk_live_`** on production `/sign-up`.

| Item | Status |
|------|--------|
| Clerk Production on `www.agent7even.ai` | **Live** (`pk_live_` verified) |
| Vercel Production env vars | Present (Clerk, Stripe keys, price IDs, `ZERNIO_API_KEY`, `NEXT_PUBLIC_APP_URL`) |
| Stripe live billing E2E | **Manual QA still required** — §5 in `PRODUCTION_LAUNCH_SESSION.md` |
| Zernio first pilot | Ready — runbook §B in `PRODUCTION_LAUNCH_SESSION.md` |

**Script change:** `scripts/verify-production-readiness.ts` accepts `--production-only` so local `pk_test`/`sk_test` in `.env.local` do not fail the live-site audit.

**Docs updated:** `PRODUCTION_LAUNCH_SESSION.md` (July 9 snapshot), `vendor/zernio/go_live_runbook.md` (`.ai` URLs, request-host OAuth note).

**Recommended order (A then B):**

1. ~~Clerk Production~~ — done
2. Stripe live checkout QA on `www.agent7even.ai/pricing`
3. Confirm Vercel `NEXT_PUBLIC_APP_URL=https://www.agent7even.ai`
4. Owner Zernio connect on production Analytics
5. Sign off `PRODUCTION_GREENLIGHT.md` §16

---

## 2. Mobile dashboard modal scroll

**Problem:** Tall modals (e.g. Services → Generate Viral Hooks) used `overflow-hidden` with no `max-height` or scrollable body. On mobile Safari the form extended past the viewport; dashboard shell root is `overflow: hidden`, so nothing scrolled.

**Fix:** Shared shell in `components/ui/DashboardModal.tsx`:

- `DashboardModalShell` — `max-h-[90dvh]`, flex column, pinned header/footer
- `DashboardModalScrollBody` — `min-h-0 flex-1 overflow-y-auto overscroll-contain`

**Applied to:**

| Surface | File |
|---------|------|
| Services — Viral Hooks + request modals | `app/dashboard/services/ServicesClient.tsx` |
| Team — assign / invite / permissions | `app/dashboard/team/TeamClient.tsx` |
| Deliverables — upload | `app/dashboard/deliverables/DeliverablesClient.tsx` |
| Analytics — GA connect + property picker | `app/dashboard/analytics/AnalyticsClient.tsx` |
| AI Toolkit prompt modal | `app/dashboard/ai-toolkit/AIToolkitClient.tsx` |
| Meta connect disclosure | `components/social/MetaConnectDisclosure.tsx` |

**Already OK:** Posts create/edit drawer (`flex-1 overflow-y-auto`), Asset preview modal, Meta disclosure pattern before `90dvh` tweak.

**Convention for new modals:** Use `DashboardModalShell` + `DashboardModalScrollBody` for any form modal that can exceed one mobile screen.

---

## 3. Blog index hydration — nested anchors

**Problem:** `BlogIndexClient` wraps each card in `<Link>`. `BlogImage` rendered Unsplash credit as nested `<a>` tags → React hydration error on `/blog`.

**Fix:** `components/marketing/BlogImage.tsx` — prop `creditLinks` defaults to `false` when `aspectRatio="card"`. Card thumbnails show plain-text attribution; hero/inline images keep clickable credits.

---

## 4. Zernio OAuth — request host

**Problem:** Connect/callback used module-level `oauthCallbackBase()` (env `NEXT_PUBLIC_APP_URL`). Stale env could mis-route OAuth on production.

**Fix:** Same pattern as GA OAuth:

| Route | Change |
|-------|--------|
| `app/api/integrations/zernio/connect/route.ts` | `oauthCallbackBaseFromRequest(req)` for callback URL |
| `app/api/integrations/zernio/callback/route.ts` | `appBase` from request for all redirects |

Still set `NEXT_PUBLIC_APP_URL=https://www.agent7even.ai` on Vercel Production; request host is the safety net.

---

## 5. Bulk approval owner guard (July 11 automation)

**Problem:** `app/api/agents/approvals/bulk/route.ts` resolved team members to the owner workspace but did not enforce the same owner-only guard as the single approve endpoint. A team member with dashboard access could POST directly to the bulk approval API and approve or reject owner workspace outputs.

**Fix:** Bulk approval/rejection now calls `requireWorkspaceOwner(...)` before any mutations. Bulk approval also updates only `agent_outputs.status = 'pending_approval'` rows so stale/rejected outputs are not resurrected by a broad task-level approve.

**Validation:** `./node_modules/.bin/tsc --noEmit` and `npm run build` passed on July 11, 2026.

---

## 6. Carry-forward from CONTEXTV26 (unchanged)

| Area | Key paths / migrations |
|------|------------------------|
| Team assignment notes | `42_team_task_notes.sql`, `lib/team/taskNotes.ts` |
| Approval discussion threads | `43_approval_task_notes.sql`, `ApprovalDiscussion.tsx` |
| Activity note previews | `lib/team/workspaceActivity.ts` |
| Foundation classification | `41_foundation_knowledge_classification.sql`, backfill script (8/8 Agent7even rows) |
| Clerk fail-soft | `lib/clerk/sessionUser.ts` |
| Zernio lifecycle timeout | `lib/social/publisher.ts` |
| Zernio go-live clearance | `vendor/zernio/go_live_clearance_2026-07-08.md` |

**Migrations (Supabase — apply if not done):** `41`, `42`, `43`.

---

## Known open items

| Item | Notes |
|------|--------|
| Stripe live billing E2E on production | Owner action — real card QA per `PRODUCTION_LAUNCH_SESSION.md` §5 |
| Zernio first production pilot | Owner connect on `www.agent7even.ai` Analytics |
| Zernio tenant isolation write-up | Chat with Elean — non-blocking for first pilot |
| Hub rescore field-score refresh | Open since June |
| AGENTS.md CTA URLs | Still reference `app.agent7even.com` — intentional until full `.ai` cutover comms |

---

## Do not revert

- All CONTEXTV26 “do not revert” items.
- `DashboardModal` scroll pattern for tall dashboard forms.
- `BlogImage` `creditLinks={false}` default on card aspect ratio.
- Zernio OAuth request-host redirects.
- `--production-only` on production readiness script.

---

## Related docs

| Doc | Role |
|-----|------|
| `CONTEXTV26.md` | July 9 morning — Phase 5 + Foundation + Zernio clearance |
| `PRODUCTION_LAUNCH_SESSION.md` | Step-by-step launch + Zernio pilot §B |
| `PRODUCTION_GREENLIGHT.md` | Master go-live checklist (§0 updated Jul 9) |
| `SESSION_2026-07-09.md` | This session commit log |
| `AGENTS.md` | Product rules + deploy |

---

*End CONTEXTV27 — July 9, 2026*
