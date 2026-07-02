# COGS leak fix — customer surfaces only

**Status:** SHIPPED (July 1, 2026 — `AgentCommandCenter` Recent runs + `OrchestrationProgress` customer UI)  
**Priority:** P0 — live vendor dollar amounts on customer dashboard  
**Related but separate:** approval count SSOT (`lib/agents/pendingApprovals.ts`) — **shipped** in `b889cc6`

---

## Problem

OpenRouter/vendor **cost_usd** totals render on logged-in customer surfaces. Example observed: **$0.0068**, **$0.0069** in **Recent runs** on `/dashboard/agents` after Foundation Generate orchestrations.

Customers should never see internal COGS. Admin-only: `/admin/cost`, `/admin/revenue`, `AdminAgentCosts.tsx`.

---

## Root cause (current code)

COGS is **orchestration session cost**, not per-task `agent_tasks.cost_usd` in the feed.

| Surface | File | Line(s) | What leaks |
|---------|------|---------|------------|
| Agents → Live activity → **Recent runs** | `app/dashboard/agents/AgentCommandCenter.tsx` | ~1420 | `$orch.total_cost_usd.toFixed(4)` |
| Agents → active orchestration panel | `components/agents/OrchestrationProgress.tsx` | ~152–158 | "Total cost" footer when complete |
| Campaign flows (customer) | `components/campaigns/OpenCanvasFlow.tsx` | uses `OrchestrationProgress` | Same component |
| Campaign flows (customer) | `components/campaigns/GuidedCampaignFlow.tsx` | uses `OrchestrationProgress` | Same component |

**Not leaking on customer surfaces (confirmed grep):** `Recent outputs` section, agent scorecard, individual `agent_tasks` rows in Live activity (Completed today / Failed today show time only).

**Admin (keep):** `app/admin/revenue/AdminAgentCosts.tsx`, `app/admin/cost/CostActivityView.tsx`, `app/admin/page.tsx`.

---

## Fix scope

### 1. Strip dollar display from customer UI

**`AgentCommandCenter.tsx` — Recent runs block**

Remove the right-column cost line:

```tsx
// DELETE this block (keep agent count + relative time)
<p className="text-[11px] text-text-sec">${(orch.total_cost_usd ?? 0).toFixed(4)}</p>
```

Replace with operator-facing copy only, e.g. completed/budget badge (already present) or remove the cost column entirely.

**`OrchestrationProgress.tsx` — customer paths**

Remove the "Total cost" footer block (lines ~152–159) **or** gate behind `process.env.NEXT_PUBLIC_ADMIN_PREVIEW` if you need it in dev only.

Do **not** remove `total_cost_usd` from API/DB writes — admin and cost instrumentation depend on it.

### 2. Optional hardening

- Stop selecting `total_cost_usd` in customer-facing fetch if unused after UI strip (`/api/agents/orchestrations/recent` still used by Command Center — can keep field server-side, just don't render).
- Grep guard: no `cost_usd` / `total_cost_usd` + `toFixed` under `app/dashboard/` except billing/credits copy (unrelated).

---

## Verification

```bash
npx tsc --noEmit && npm run build
```

Manual:

1. Run Foundation Generate or any orchestration on a test account.
2. `/dashboard/agents` → **Recent runs** — no `$0.00xx` anywhere.
3. During active orchestration — no "Total cost" footer on customer Command Center.
4. `/admin/revenue` or `/admin/cost` — COGS still visible for operators.

---

## Out of scope (separate decisions)

| Finding | Type | Notes |
|---------|------|-------|
| Scorecard "Last run: Never" while Recent runs shows Foundation Generate | **Product/surface decision** | Foundation runs use `foundation_generate_*` agent ids + orchestration `triggered_by`, not the 10 Command Center agents. Data can be simultaneously correct and confusing. |
| Grid shows 10 agents not 12 | **Correct as designed** | `post_caption` + `weekly_content` hidden via `isCommandCenterAgent()`; see agent-count section in `CONTEXTV22.md` follow-on. |

---

*End handoff — verified against code July 1, 2026*
