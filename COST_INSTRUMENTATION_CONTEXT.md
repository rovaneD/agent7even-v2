# Cost Instrumentation — Unified Context & Staging Protocol
*Source of truth for the cost/credit/admin-analytics workstream. Drop in project root alongside MAYA_CONTEXT.md.*
*Created for alignment across parallel Claude Code build sessions.*

---

## Why this document exists

This workstream was built **in parallel** with other project work via Claude
Code. That creates drift risk: different sessions making different assumptions
about table names, credit costs, and what's already wired. This doc is the single
reference so every session aligns. If a build session contradicts this doc, this
doc wins — or this doc gets updated deliberately, not silently.

---

## The one-line purpose

Make every dollar of AI inference cost attributable to a specific account, job,
and run — so pricing, margin, and the product wedge are decided from real data
instead of guesses.

---

## Current state (what is TRUE as of this doc)

### Already built (pre-existing infra — do not duplicate)
- `agent_tasks` — logs `input_tokens`, `output_tokens`, `cost_usd`, `model`,
  `agent` (the field that tags the source, e.g. `agent='maya'`), `orchestration_id`
- `agent_outputs` — token + cost columns
- `credit_balances` — one row per user, real-time
- `credit_ledger` — every debit/credit logged
- `orchestration_sessions` — parallel run grouping + budget cap
- Runner: `createTask`, `updateTaskStatus`, `saveAgentOutput` (`lib/agents/runner.ts`)
- All model calls route through `lib/agents/openrouter.ts`
- Cost/credit logic in `lib/agents/cost.ts`; `CREDIT_COST.light = 2`
- Crons: `run-scheduled-agents` (hourly), `allocate-credits` (1st/mo),
  `refresh-pricing` (6h)

### Credit model (current)
| Plan | Credits/mo |  | Run tier | Credits |
|---|---|---|---|---|
| Starter | 100 |  | Light | 2 |
| Growth | 350 |  | Standard | 8 |
| ProAgent | 1,000 |  | Deep | 25 |

> ⚠️ These credit costs are UNVALIDATED against real USD cost. The whole point of
> this workstream is to find out whether Light=2 / Standard=8 / Deep=25 actually
> match what each run costs to serve. Do not treat them as correct yet.

### Just completed (Build Step 1)
`/api/maya/chat` is now wired through the runner:
- Balance check first → 402 `INSUFFICIENT_CREDITS` if balance < 2
- `createTask({ userId, agent: 'maya', model, input: { messageCount } })` →
  `updateTaskStatus('running')`
- Stream unchanged (`streamText` → `toUIMessageStreamResponse()`)
- Post-stream: records tokens + `cost_usd`, deducts 2 credits, writes ledger
- Stream error → task `failed`, no charge
- Decisions locked: **fixed 2 credits/turn**, **per turn**, **cached_tokens
  deferred** (AI SDK v6 doesn't surface them)

### Known open risk on Build Step 1 (MUST verify — see Staging Protocol)
The post-stream cost recording is **fire-and-forget after the HTTP response
completes**. On Vercel serverless, the function can be frozen/reclaimed once the
response is sent, which can drop the background write → lost cost rows. Must be
confirmed safe (via `after()` / `waitUntil`) before trusting any numbers.

---

## ⚠️ STAGING IS SHOWING THE OLD PACKAGE SYSTEM — read before testing

You reported test accounts only show the old package system. **Do not run the
verification test until this is resolved**, because a clean result would be
meaningless — you'd be testing old code paths. Diagnose in this order:

1. **Which app is staging running?** There are two repos (CONTEXTV6):
   - `agent7even-app` (old, `app.agent7even.com`)
   - `agent7even-v2` (new Maya rebuild, `agent7even-v2.vercel.app`)
   Confirm staging points at **v2**. If test accounts show the old package
   system, staging may be serving the old app entirely. Check the deployment URL
   and `git remote -v` on the deployed branch.

2. **Are the test accounts on the new credit tables?** Old accounts may predate
   `credit_balances` / `credit_ledger`, so they render the legacy package UI and
   have no credit row. A user with no `credit_balances` row will either error or
   fall back to old logic. Fix: either migrate test accounts into the credit
   system, or create fresh test accounts in v2.

3. **Did `allocate-credits` ever run for these accounts?** Credits are allocated
   by a monthly cron. A brand-new test account created mid-cycle may have a
   balance row of 0 (or none) until the cron runs. Fix: manually seed a credit
   balance for test accounts (insert a `credit_balances` row + a `credit_ledger`
   grant) so they can actually run Maya.

**You cannot validate cost instrumentation against accounts running the old
system.** Get at least 2–3 clean v2 test accounts with seeded credit balances
first. This is the real blocker right now — not the code.

---

## Staging verification protocol (run ONLY after the above is clean)

Run against **deployed v2 staging, never local.** Local never reclaims the
serverless function, so fire-and-forget always works locally and hides the exact
bug we're worried about.

### Test A — basic capture (single message)
1. Send one Maya chat message from a seeded v2 test account.
2. Confirm a new `agent_tasks` row: `agent='maya'`, non-zero `input_tokens`,
   non-zero `cost_usd`, status `complete`.
3. Confirm a matching `credit_ledger` debit row (description references the task).
4. Confirm `credit_balances` decreased by exactly 2.

### Test B — the teardown test (THE important one)
1. Send **10–15 Maya messages in quick succession** from the test account.
2. Count `agent_tasks` rows where `agent='maya'` created in that window.
3. **Messages sent must equal rows recorded.**
   - 15 sent / 15 rows → background write survives teardown. ✅
   - 15 sent / 12 rows → fire-and-forget is dropping writes under serverless
     teardown. ❌ Fix with `after()` (next/server) or `waitUntil`
     (@vercel/functions) wrapping the post-stream recording, then re-test.
4. Cross-check: `credit_balances` should have dropped by (rows × 2). If ledger
   debits < tasks, the deduction is also racing teardown.

### Test C — failure path
1. Cut a stream off mid-response (close the tab / abort).
2. Confirm the task shows `status='failed'` and **no** credit was deducted.

> If Test B undercounts, every downstream metric inherits the undercount and your
> margin dashboard will read artificially healthy. Fix before the migration.

---

## The workstream sequence (do not reorder)

1. ✅ Wire `/api/maya/chat` through runner — DONE
2. ⏳ **Resolve staging old-package issue** (above) — CURRENT BLOCKER
3. ⏳ Run staging verification Tests A/B/C; fix teardown gap if Test B fails
4. ⬜ Run `01_cost_instrumentation.sql` — adds `job_type` (or confirm `agent`
   field covers it), `cached_tokens`, indexes, `v_account_month_cost` view.
   **Reconcile the `profiles`/MRR join against real billing columns first.**
5. ⬜ Admin tool Screen 2 (Account Activity Table) — the workhorse
6. ⬜ Screen 1 (Margin Overview), Screen 3 (Run Log)
7. ⬜ Screen 4 (Job Economics / wedge-finder), Screen 5 (Pricing Simulator) —
   once there are a few weeks of real multi-account usage

---

## Naming reconciliation note for SQL migration (Step 4)

The migration doc `01_cost_instrumentation.sql` assumes a `job_type` enum, but the
real table uses an `agent` field. **Decide before running:**
- Option A: skip the `job_type` column; use existing `agent` for source tagging.
  Simpler, but `agent='maya'` is coarser than per-job (`social_post`, `seo_audit`).
- Option B: add `job_type` *in addition to* `agent`, for finer wedge analysis.
  More granular, needed for Screen 4 to find the wedge.
Recommendation: **Option B** — `agent` says which agent ran, `job_type` says what
job it did; the wedge-finder needs the latter. But confirm it's worth the column
before adding.

Also reconcile before running the migration:
- `cached_tokens` — deferred in code (v6 limitation); add column now (defaults 0)
  so it's ready when the SDK surfaces it, OR defer the column too. Pick one.
- `profiles` join — confirm the real table holding `plan` and per-account MRR.
- credit balance key — confirm `credit_balances` keys on `user_id` vs `account_id`;
  the queries assume account-level rollup.

---

## Locked decisions (don't re-litigate without updating this doc)
- Maya chat: fixed **2 credits/turn**, **per turn**. Revisit only when Test B is
  clean AND a few weeks of data show chat running hot (P90 chat cost > 2 credits
  of value).
- Cost recording is conservative while `cached_tokens` is deferred — you'll look
  slightly *less* profitable than reality. Safe direction to be wrong.
- No admin action that charges/changes a customer ships without a confirm dialog
  + audit row. (Carried from admin tool spec.)
- All pushes go to the **v2** repo. Run `git remote -v` before every push.
