# Phase C — Dashboard Cold-Open Handoff

**Status:** shipped (first slice) — June 10, 2026 session  
**Gates:** A1 (Maya-forward logged-in) · A2 (approval-first, no auto-post claims) · performance-theater test  
**Next in Phase C:** IA regroup · asset lifecycle · situational grounding (Thread 7)

---

## Problem (571-page audit P0)

Dashboard opened with a static “Command center” welcome block. `MorningDigest` existed but was buried in the right column and **returned null** when there was no overnight activity — so most cold-opens felt like an empty nav shell, not Maya’s morning brief.

---

## What shipped

### 1. Digest-first layout (`app/dashboard/page.tsx`)

- **Maya daily brief** is now the first full-width hero (Command Center soft-shadow card).
- Removed duplicate welcome hero; metrics moved to compact “Today at a glance” strip below the brief.
- Agents workspace card: **12 specialist agents** (from `AGENTS` registry), not “9”.

### 2. Morning brief always speaks (`components/dashboard/MorningDigest.tsx`)

- **Never hides on empty activity** — shows Maya-forward cold-open copy keyed to user state (no plan · pending approvals · no campaigns · no agent runs · top goal).
- Empty state CTAs: primary next move + **Talk to Maya**.
- Active brief footer: **Continue with Maya** → opens sidebar via `maya:open-panel`.
- Hero styling matches dashboard Command Center exception (`rounded-[24px]`, soft shadow).

### 3. Digest approval bug fix (`app/api/digest/generate/route.ts`)

**Was wrong:** `.eq('status', 'approval_required')` — no tasks use that status.  
**Correct (June 10 follow-on):** `agent_outputs.status = 'pending_approval'` via `lib/agents/pendingApprovals.ts` — single count for dashboard brief, lifecycle bar, sidebar badge, Agents snapshot, and digest generation.  
**Was (intermediate):** `requires_approval = true` + `status = 'completed'` + `approved_at`/`rejected_at` null — could drift from output status and disagreed with stale `daily_digests.approvals` JSON when `MorningDigest` used `Math.max(digest, live)`.

**Note:** Digests generated before the output-based fix may have stale `approvals` until `digestStale` triggers regenerate (count mismatch) or the next daily row.

### 4. Maya sidebar hook (`app/dashboard/DashboardShell.tsx`)

- New event: `maya:open-panel` — opens chat without a `__TASK__` sentinel (page context still binds via `canvasContext: Dashboard`).

### 5. Richer dashboard Maya context (`lib/maya/summaries/pageOverviewContext.ts`)

- Passes pending approvals, campaigns, agent runs, top goal into sidebar context.
- Affordance: summarize what needs attention; one practical next step.

---

## Maya write-path recon (Thread 7 gate)

**Question:** Can Maya chat actuate canvas/form state, or is it output-only?

**Answer: output-only for agents/runs; form fill via Apply gate (Layer 2 shipped June 10, 2026).** Layer 1 (read) exists; Layer 2 writes through user-confirmed patch apply — not auto-mutation.

| Path | Read | Write |
|------|------|-------|
| Sidebar `MayChatPanel` | `canvasContext`, `canvasData`, `useMayaContext`, `formSurface` snapshot | Text + optional `maya-form-patch` block → **Apply** card updates registered forms |
| Full-page `MayaShell` | Same + campaign canvas states | Trigger phrase → Campaign Builder orchestration; task mode locks canvas text |
| Cross-page events | N/A | `maya:open-task` → sends `__TASK__` (chat executes in text, does not mutate forms) |
| Agents | N/A | Separate runner — not invoked from sidebar chat (`MAYA_NO_FAKE_ACTIONS`) |

**Layer 2 (shipped):** `MayaFormActuationProvider` + `useRegisterMayaFormSurface` on agent setup + guided campaign. Extend to Settings/Posts in follow-on.

---

## Do not revert

- Approval-first language in brief empty states (“queue work for your approval”).
- Digest-first page order — brief before metrics cards.
- Correct pending-approval query via `lib/agents/pendingApprovals.ts` (not digest JSON or task-only drift).

---

## Verification

```bash
npm run tsc
# Manual: /dashboard — brief visible at top; empty account sees Maya copy + CTAs
# Manual: account with pending approvals — digest “What needs you” populated after refresh
# Manual: “Talk to Maya” / “Continue with Maya” opens sidebar with Dashboard context
```

---

## Open follow-ons (Phase C backlog)

1. **IA regroup** — sidebar 13 items → grouped nav (separate handoff).
2. **Asset lifecycle** — Draft → Approved → Scheduled → Published surfacing.
3. **Thread 7 Layer 1** — bind visible form field values into `canvasData` on SEO Scanner et al.
4. **Thread 7 Layer 2** — design actuation API after product decision.
5. **Stale digest refresh** — **Shipped:** `forceRegenerate` on `/api/digest/generate`; dashboard detects approval count mismatch and refreshes.
6. **Approval count consistency** — **Shipped:** `lib/agents/pendingApprovals.ts`; all six “needs review” read-points use `agent_outputs.pending_approval`; removed `Math.max` with cached digest.
