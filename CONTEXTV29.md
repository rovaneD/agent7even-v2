# CONTEXTV29 — Approval page render safety
*Snapshot: July 16, 2026 — supersedes `CONTEXTV28.md`*

## Repository state

```txt
GitHub: rovaneD/agent7even-v2
Branch: cursor/critical-bug-investigation-7b16
Code fix: 22c3c13
Prior handoff: CONTEXTV28 (July 13 full audit)
```

## Critical fix

Commit `6b53042` had made the Approvals Server Component call
`reconcileOrphanedPendingApprovalOutputs()` during every render. The helper
classified pending outputs as orphaned when their task row was missing or used a
different `user_id`, then silently changed them to `rejected`. Initial page
loads and the client's 45-second `router.refresh()` cycle could therefore
destroy paid, reviewable output without an owner decision. The update also had
no status predicate, so it could overwrite a concurrent approval.

Commit `22c3c13` removes the render-time reconciliation and deletes the unused
destructive helper. The queue and badge remain aligned by counting/listing only
pending outputs attached to visible tasks; inconsistent rows remain unchanged
for explicit, owner-guarded operational review.

## Invariant

Approval page loads and refreshes are read-only. Never auto-approve,
auto-reject, or otherwise reconcile `agent_outputs` from a Server Component or
render-triggered client effect. Any future orphan cleanup must be explicit,
owner-guarded, status-conditional, and auditable.

## Validation

- `npx tsc --noEmit` — pass
- `npm run build` — pass (Next.js 16.2.6, 216 static pages)
- No automated test harness exists in the repository; the fix removes the only
  runtime call and implementation, and repository search confirms no remaining
  reconciliation symbol or synthetic rejection message.

## Carry-forward

Open items from `CONTEXTV28.md` remain unchanged, including the unlinked
`/dashboard/ai-toolkit`, production environment verification, and live Stripe /
Zernio QA.
