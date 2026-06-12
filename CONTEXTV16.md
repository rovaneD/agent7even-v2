# CONTEXTV16 — Content Posting, Billing/Admin Fixes, Zernio Analytics Parity
*Snapshot: June 12, 2026*

This document supersedes `CONTEXTV15.md`. Everything in V15 still applies
unless this file explicitly changes it.

Session log: `SESSION_2026-06-12.md`.

---

## Repository State

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app
Branch: main
Latest commit: 37f1e2e (merged from feature/image-context-v1-verify)
```

Before every push: `git remote -v` must show `rovaneD/agent7even-v2`.

Production SaaS app (`rovaneD/agent7even-app`) is **not** this repo — port
deliberately when v2 is prod-ready.

---

## What Shipped on `main` (June 12 merge)

### Content Posting + image-context loop

| Area | Summary |
|------|---------|
| **Content Posting agent** | Unified Command Center tile: `contentFlow=single` (image + vision caption) or `weekly` (7-day plan). Skill SQL: `14_content_posting_agent_skill.sql`. |
| **Post Caption agent** | Still in registry for legacy rows; new runs use `content_posting`. |
| **Vision caption** | `lib/agents/visionCaption.ts`, `lib/agents/contentPosting.ts`, Standard tier when image attached. |
| **In-process runs** | `lib/agents/executeAgentRun.ts` — avoids Vercel deployment-protection 401 on self-dispatch. |
| **Approvals ↔ Posts** | Phase 1 UX: run banner, task polling, image preview, publish on approve. |
| **Credits** | Failed Zernio publish refunds caption publish charge; billing usage window + Stripe checkout credit allocation fixes. |

Capability contract: `lib/posts/imageContextCapabilities.ts`. Storage: `12_post_assets_bucket.sql`.

### Admin + client health

| Area | Summary |
|------|---------|
| **Revenue** | `lib/stripeRevenue.ts` — SaaS subscription charges only (filters legacy $7,500 packages / test noise). |
| **Client health** | `lib/clientHealth.ts` — activity-first status; dedupe by email; table layout fix. |
| **Clerk webhook** | Blocks duplicate active client profiles per email (`app/api/webhooks/clerk/route.ts`). |
| **SQL** | `16_prevent_duplicate_client_emails.sql` — unique index on active client emails (run in Supabase). |

### Zernio posting analytics

| Area | Summary |
|------|---------|
| **Parser** | `lib/social/zernioAnalyticsParse.ts` — correct `/analytics` envelope shapes; `pickBestAnalyticsPost()`. |
| **Social route** | Staggered API calls + 429 retry; server-computed `bestPost`; `accountId` on all calls. |
| **Best-post URL** | Prefer `platforms[].platformPostUrl` matched by `platformPostId`; reject stale top-level URLs. |
| **Client** | `cache: 'no-store'` on analytics fetch; `@accountUsername` on best-post card. |

**Verified (June 12):** Live Zernio data for `@rovanedurso` returns Alex goal reel
(`DYbQyJxgkkk`) with matching caption. View link opens correct post in Instagram
app / fresh Safari session.

**Chrome cache gotcha:** Stale Chrome sessions showed wrong post after earlier
deploys. Hard refresh (`Cmd+Shift+R`) or clear site data fixes it — not a bad
href in current code.

---

## Zernio operational notes (learned June 10–12)

### Two post systems — do not conflate

| Source | What it is | Used for |
|--------|------------|----------|
| `GET /analytics` | Synced Instagram history + metrics | Analytics page, best post, charts |
| `GET /posts` | Zernio composer (drafts, scheduled, published) | Posts page, publish flow |

External/synced posts (`isExternal: true`) appear in **analytics** only.
Native Zernio publishes appear in **posts** first; analytics sync may lag or
never arrive if deleted quickly (test publishes).

### Test account cleanup (Rovane, June 12)

- Removed Lumina (`luminaprophoto`) — single account `@rovanedurso` only.
- Deleted butterflies test publish (IG + Zernio); ghost row may still resolve by ID.
- Supabase profile row cleaned:

```json
zernio_profile_id: "6a26ee48ff84dc2d54c98d56"
zernio_profile_ids: ["6a26ee48ff84dc2d54c98d56"]
zernio_connected_platforms: ["instagram"]  // jsonb, not text[]
```

### Open with Zernio support

- Native publish → `/analytics` post list sync timing
- `GET /analytics` post list empty while daily-metrics shows activity (historical ticket)
- Permalink field authority (`platformPostUrl` on post vs `platforms[]`)

Support bundle (local, not in git): `zernio-analytics-support-bundle-2026-06-10.json`.

---

## SQL migrations — run in Supabase

| File | Purpose | Status |
|------|---------|--------|
| `12_post_assets_bucket.sql` | Private `post-assets` bucket | Required for image attach |
| `13_post_caption_agent_skill.sql` | Legacy Post Caption skill | Superseded by 14 for new runs |
| `14_content_posting_agent_skill.sql` | Content Posting skill | **Run if not applied** |
| `15_churn_orphan_onboarding_profiles.sql` | Optional orphan cleanup | Optional |
| `16_prevent_duplicate_client_emails.sql` | Unique active client email | **Run if not applied** |

---

## Key paths (quick reference)

| Domain | Paths |
|--------|-------|
| Content Posting | `lib/agents/contentPosting.ts`, `lib/agents/executeAgentRun.ts`, `AgentCommandCenter.tsx` |
| Analytics API | `app/api/analytics/zernio/social/route.ts` |
| Analytics UI | `app/dashboard/analytics/AnalyticsClient.tsx` |
| Zernio client | `lib/social/publisher.ts`, `lib/social/zernioAnalyticsParse.ts` |
| Billing | `lib/credits.ts`, `app/dashboard/billing/page.tsx`, Stripe webhook |
| Admin | `lib/stripeRevenue.ts`, `lib/clientHealth.ts`, `app/admin/` |

---

## Open backlog

1. **Zernio native publish → analytics** — confirm sync before trusting best-post for composer publishes.
2. **Engagement cron** — `GET /api/cron/calculate-engagement` with `CRON_SECRET` (never ran in v2).
3. **SQL 14 + 16** — confirm applied in Supabase prod DB.
4. **Post media Phases A–C** — gated on `post_media_expansion_handoff.md` after v1 stable.
5. **Marketing copy** — image-context “to match it” on `~/agent7even/` after prod smoke.
6. **Port to agent7even-app** — separate repo; live Stripe, crons, full QA.

---

## Current docs to read first

| Priority | Doc |
|----------|-----|
| Technical state | `CONTEXTV16.md` (this file) |
| Session log | `SESSION_2026-06-12.md` |
| Maya product rules | `MAYA_CONTEXT_V07.md` |
| Post media roadmap | `post_media_expansion_handoff.md` |
| Audit ledger | `AUDIT_FIXES_2026-06-02.md` |

Superseded: `CONTEXTV15.md`, `MAYA_CONTEXT_V06.md`.

---

*Last reviewed: June 12, 2026*
