# CONTEXTV16 — Content Posting, Billing/Admin Fixes, Zernio Analytics Parity
*Snapshot: June 12, 2026*

This document supersedes `CONTEXTV15.md`. Everything in V15 still applies
unless this file explicitly changes it.

Session logs: `SESSION_2026-06-11.md` (Foundation safety), `SESSION_2026-06-12.md`
(Content Posting merge + Zernio).

---

## Parallel-session reconciliation (June 12)

These docs were written in the **Cursor thread** that merged Content Posting and
Zernio analytics to `main` (`37f1e2e`, docs commit `b11e0f2`). A **separate
Claude Code session** ran overlapping Zernio Bucket-2 work the same evenings;
records were split until this pass.

| Concern | Verdict |
|---------|---------|
| **Foundation contamination** | Fixed **June 11** in this repo (`b9fac70`, undo `0ce8b1a`/`ca3f109`) — was missing from V16; now in `SESSION_2026-06-11.md` + section below |
| **Best-post View link** | **Closed** in Cursor thread — Chrome cache of stale API responses + server-side `bestPost` (`37f1e2e`). Not blocked on Ana for permalink. Hard-refresh Chrome to QA |
| **Mock leakage (`69639f3`)** | **Already on `main`** (June 11). Do not re-run Bucket-2 mock cleanup — would duplicate shipped work |
| **Ana / Zernio still open** | Native publish → `/analytics` sync; `posts[]` empty while daily-metrics shows activity — **not** the View-link permalink mystery |
| **AGENTS.md “this project”** | This folder = **agent7even-v2** experimental. Production SaaS portal = `~/agent7even-app/` — separate repo |

---

## Repository State

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app
Branch: main
Latest commits: b11e0f2 (docs), 37f1e2e (Content Posting + Zernio merge).
Foundation safety: b9fac70, 0ce8b1a, ca3f109 (June 11, already on main).
Mock leakage: 69639f3 (June 11, already on main).
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

### Foundation identity safety (June 11 — do not reopen)

**Recently closed wound:** Upload Review Findings used to merge extractions into
`foundation_answers` via `save-answers`, silently overwriting business identity.

| Piece | Shipped | What |
|-------|---------|------|
| **1 — Severance** | `b9fac70` | Upload Save → `foundation_knowledge.confirmed_fields` PATCH only; ingest never touches identity |
| **1b — Undo** | `0ce8b1a`, `ca3f109` | Single-slot snapshot + reversible `POST /api/foundation/restore-previous` |
| **Rescore policy** | same session | `POST /api/foundation/score` does **not** capture snapshot — only deliberate edits (`save-answers`, `save-exa-confirm`) |

**Still pending (reference layer — Pieces 2+3):** purpose/classification tags on
knowledge rows; Maya on-demand retrieval with prompt separation. Details:
`SESSION_2026-06-11.md`.

**Guardrail for future work:** Never route upload approval through `save-answers`.
Identity edits = Intelligence tab section editor only.

### Admin + client health

| Area | Summary |
|------|---------|
| **Revenue** | `lib/stripeRevenue.ts` — SaaS subscription charges only (filters legacy $7,500 packages / test noise). |
| **Client health** | `lib/clientHealth.ts` — activity-first status; dedupe by email; table layout fix. |
| **Clerk webhook** | Blocks duplicate active client profiles per email (`app/api/webhooks/clerk/route.ts`). |
| **SQL** | `16_prevent_duplicate_client_emails.sql` — unique index on active client emails (applied in Supabase, June 12). |

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

**Real-client gate (still open):** Do not onboard paying clients' live social
accounts through Zernio OAuth/publish until Q4 data-handling/DPA is cleared with
Zernio. Test on FREE tier and owner test accounts only — same boundary as
`AGENTS.md` / superseded `CONTEXTV15.md`.

### Open with Zernio support

- Native publish → `/analytics` post list sync timing
- `GET /analytics` post list empty while daily-metrics shows activity (historical ticket)

**Closed locally (June 12):** Best-post View link / permalink — live Zernio returns
correct `platformPostUrl`; stale Chrome cache caused “random post”; code prefers
`platforms[].platformPostUrl` + `cache: 'no-store'`.

Support bundle (local, not in git): `zernio-analytics-support-bundle-2026-06-10.json`.

---

## SQL migrations — run in Supabase

| File | Purpose | Status |
|------|---------|--------|
| `11_foundation_answers_snapshot.sql` | Single-slot undo columns on `profiles` | **Applied** — prod undo verified (reversible swap, June 11) |
| `12_post_assets_bucket.sql` | Private `post-assets` bucket | **Applied** (June 12) |
| `13_post_caption_agent_skill.sql` | Legacy Post Caption skill | Superseded by 14 for new runs |
| `14_content_posting_agent_skill.sql` | Content Posting skill | **Applied** (June 12) |
| `15_churn_orphan_onboarding_profiles.sql` | Optional orphan cleanup | Optional |
| `16_prevent_duplicate_client_emails.sql` | Unique active client email | **Applied** (June 12) |

---

## Key paths (quick reference)

| Domain | Paths |
|--------|-------|
| Foundation safety | `lib/foundation/answersSnapshot.ts`, `app/api/foundation/restore-previous/route.ts`, `app/api/foundation/knowledge/[id]/route.ts`, `FoundationHub.tsx` UploadCard |
| Content Posting | `lib/agents/contentPosting.ts`, `lib/agents/executeAgentRun.ts`, `AgentCommandCenter.tsx` |
| Analytics API | `app/api/analytics/zernio/social/route.ts` |
| Analytics UI | `app/dashboard/analytics/AnalyticsClient.tsx` |
| Zernio client | `lib/social/publisher.ts`, `lib/social/zernioAnalyticsParse.ts` |
| Billing | `lib/credits.ts`, `app/dashboard/billing/page.tsx`, Stripe webhook |
| Admin | `lib/stripeRevenue.ts`, `lib/clientHealth.ts`, `app/admin/` |

---

## Open backlog

1. **Zernio Q4 DPA** — real client social accounts gated until data-handling/DPA cleared; FREE tier / test accounts only.
2. **Competitor post-level metrics (CONDITIONAL GO)** — EnsembleData spike confirmed IG views + ~50 units/tenant/weekly refresh; **production blocked** until ToS clears derived-insight redistribution + public-scraped risk accepted. Stage 1 refresh jobs must **stagger tenants across the week** (daily unit ceiling — see `backlog_gate_competitor_reach.md`). Stage 2 ships independently. Refs: `ensembledata_verification_findings.md`, `backlog_gate_competitor_reach.md`.
3. **Zernio native publish → analytics** — confirm sync before trusting best-post for composer publishes.
4. **Engagement cron** — `GET /api/cron/calculate-engagement` with `CRON_SECRET` (never ran in v2).
5. **Post media Phases A–C** — gated on `post_media_expansion_handoff.md` after v1 stable.
6. **Marketing copy** — image-context “to match it” on `~/agent7even/` after prod smoke.
7. **Port to agent7even-app** — separate repo; live Stripe, crons, full QA.

---

## Current docs to read first

| Priority | Doc |
|----------|-----|
| Technical state | `CONTEXTV16.md` (this file) |
| Foundation safety log | `SESSION_2026-06-11.md` |
| June 12 merge log | `SESSION_2026-06-12.md` |
| Maya product rules | `MAYA_CONTEXT_V07.md` |
| Post media roadmap | `post_media_expansion_handoff.md` |
| Outlier intelligence (Stage 1/3) | `outlier_intelligence_handoff.md`, `ensembledata_verification_findings.md`, `backlog_gate_competitor_reach.md` |
| Idea Analysis → Viral Hooks (active) | `stage2_idea_analysis_plan.md` |
| Audit ledger | `AUDIT_FIXES_2026-06-02.md` |

Superseded: `CONTEXTV15.md`, `MAYA_CONTEXT_V06.md`.

---

*Last reviewed: June 12, 2026 (reconciliation pass — Foundation arc added)*
