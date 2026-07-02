# Phase C — Asset Lifecycle Surfacing Handoff

**Status:** Thread 3 v1 shipped (lifecycle spine on `agent_outputs`)  
**Prior:** IA regroup  
**Next:** Thread 7 Layer 2 (actuation — not built)

---

## Problem

Audit: users cannot see **Review → Approved → Draft → Scheduled → Published** as one pipeline. Three parallel state models exist (agent approvals, Zernio posts, calendar); only the approval→post bridge was explained in a banner on Posts.

---

## Shipped (Thread 3 v1 — July 2026)

### `30_content_lifecycle_unification.sql`

Adds to `agent_outputs`:
- `lifecycle_stage` — `review | approved | draft | scheduled | published | rejected`
- `zernio_post_id` — links output row to Zernio post after publish bridge

Backfills from existing `status`. **Run once in Supabase SQL Editor.**

### `lib/content/agentOutputLifecycle.ts`

SSOT helpers: stage mapping, approved post-pipeline count, `linkOutputToZernioPost`, `syncOutputLifecycleFromZernioPost`.

### `lib/content/lifecycleCounts.ts`

Server helper aggregates:
- **Review** — `getPendingApprovalCount()` (`agent_outputs.status = 'pending_approval'`)
- **Approved** — post-type outputs with `lifecycle_stage = 'approved'` and no Zernio link yet
- **Draft / Scheduled / Published** — Zernio `listPosts` pagination totals when profile connected + `ZERNIO_API_KEY` set

### `components/dashboard/ContentLifecycleBar.tsx`

Five linked stage cards → Approvals queue or Posts filtered by `?status=`.

Surfaces on:
- **Dashboard** — below Maya brief
- **Posts** — below page header (`compact`)
- **Calendar** — compact bar

### Write-path wiring

- `lib/agents/runner.ts` — sets `lifecycle_stage` on insert
- Approve / reject / bulk routes — update `lifecycle_stage`
- `publishApprovedImageCaption` + approve route — `linkOutputToZernioPost` when Zernio draft created
- `app/api/posts/[postId]/route.ts` PATCH — `syncOutputLifecycleFromZernioPost` on status change

### `lib/content/outputLifecycleLabel.ts`

Output archive labels use `lifecycle_stage` when present (falls back to `status`).

### `PostsClient.tsx`

Reads `?status=` from URL on load for deep links from pipeline cards.

---

## Honest scope (A2)

- **Review** = approval queue (`pending_approval`).
- **Approved** = post-type agent output approved but not yet linked to Zernio (or publish bridge blocked).
- **Draft/Scheduled/Published** = Zernio post rows (requires connected social).
- Non-post approvals (weekly plans, etc.) stay in archive with `lifecycle_stage = approved` but do not increment **Approved** pipeline count.

---

## Verification

```bash
npx tsc --noEmit
# Run 30_content_lifecycle_unification.sql in Supabase
# Dashboard: pipeline shows Review + Approved + Draft/Scheduled/Published when connected
# Approve post with media → lifecycle moves Approved → Draft; schedule → Scheduled
```
