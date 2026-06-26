# Phase C — Asset Lifecycle Surfacing Handoff

**Status:** shipped (surfacing layer — not new state machine)  
**Prior:** IA regroup  
**Next:** Thread 7 Layer 2 (actuation — not built)

---

## Problem

Audit: users cannot see **Draft → Review → Scheduled → Published** as one pipeline. Three parallel state models exist (agent approvals, Zernio posts, calendar); only the approval→post bridge was explained in a banner on Posts.

---

## Shipped

### `lib/content/lifecycleCounts.ts`

Server helper aggregates:
- **Review** — `agent_tasks` pending approval (`requires_approval`, completed, not approved/rejected)
- **Draft / Scheduled / Published** — Zernio `listPosts` pagination totals when profile connected + `ZERNIO_API_KEY` set

### `components/dashboard/ContentLifecycleBar.tsx`

Four linked stage cards → Approvals queue or Posts filtered by `?status=`.

Surfaces on:
- **Dashboard** — below Maya brief
- **Posts** — below page header (`compact`)

### `PostsClient.tsx`

Reads `?status=` from URL on load for deep links from pipeline cards.

---

## Honest scope (A2)

- **Review** = approval queue, not all drafts everywhere.
- **Draft/Scheduled/Published** = Zernio post rows only (requires connected social).
- No separate **Approved** stage count — approved agent output not yet in Zernio is implicit between Review and Draft (existing Posts banner still applies for post-type approvals).

---

## Verification

```bash
npx tsc --noEmit
# Dashboard: pipeline row visible with Review count
# Posts: ?status=draft filters list; pipeline compact bar visible when connected
```
