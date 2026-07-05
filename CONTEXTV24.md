# CONTEXTV24 — Transactional email complete, Guardian proposal surface
*Snapshot: July 4, 2026 — supersedes `CONTEXTV23.md` for logged-in product work*

Session logs: `SESSION_2026-07-04.md`; July 5 critical team hardening addendum in `SESSION_2026-07-05.md`.

---

## Repository state

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app
Branch: main
Latest commits: 435d037 (email migration + merge tooling) · proposal surface commit pending
Prior handoff: CONTEXTV23 (July 3)
```

**Deploy workflow:** push directly to `main` → Vercel auto-deploys.

Before every push: `git remote -v` must show `rovaneD/agent7even-v2`.

---

## What changed since CONTEXTV23 (index)

| Area | Doc |
|------|-----|
| Transactional email migration (complete) | **§1** |
| `approval_pending` notifications CHECK fix | **§2** |
| Profile merge tooling + DB status | **§3** |
| Guardian checkpoint + threshold hold | **§4** |
| Proposal surface + layers v0 (Build Sequence 3–4) | **§5** |
| July 5 team workspace critical hardening | **§6** |

---

## 1. Transactional email — migration complete

**Shipped (`435d037`):** `lib/email/sendTransactionalEmail.ts` wraps `buildTransactionalEmailHtml` + `transactionalFromAddress()`.

**Migrated routes:** welcome (Clerk webhook), team invite, support create/reply/close, admin client email, order admin notify, project inquiry, analytics connect notify, data deletion (admin + confirmation with `replyTo`).

**Deduped:** `admin/orders/update-status` — delivery email only via `createNotification` (removed parallel terracotta send).

**Intentionally separate:** `morning-digest` cron (Maya voice / separate design).

**Do not revert:** On-brand blue `#3B82F6` template, `hello@agent7even.ai` from address.

---

## 2. Notifications — `approval_pending` CHECK

**Problem:** In-app `notifications` insert failed on `approval_pending` type; email still sent.

**Fix:** `35_notifications_type_check.sql` — applied in Supabase this session.

---

## 3. Duplicate profiles — resolved (no DB merge needed)

**Code mitigation (CONTEXTV23):** `resolveClerkProfile`, GA canonical save — keep.

**DB state:** `scripts/list-duplicate-profiles.ts` → 7 active profiles, **0 duplicate groups**. Orphan for `rovane@dursodesign.com` removed in prior session.

**Note:** Two profiles with `company_name: Agent7even` (Melissa vs Rovane) are **separate paying accounts** — do not merge.

**Tooling shipped:** `scripts/list-duplicate-profiles.ts`, `scripts/merge-duplicate-profiles.ts`, `PROFILE_MERGE_RUNBOOK.md`.

---

## 4. Foundation Intelligence — Guardian checkpoint

**Observer:** v0 writes + v0.5 reads (agents + Maya) — live since `34f17ac` / `b053922`.

**Guardian:** v0 batch — `run-foundation-guardian.ts`, `verify-foundation-guardian.ts`, `foundation_proposals` table.

**Human checkpoint (July 4):** 5 changelog rows → 5 proposals; **1 surfaced** (4-row campaign-builder cluster). Thresholds in `lib/foundation/guardian/guardianConfig.ts` held at ≥3/≥4 — **do not lower until more organic signal**.

**Process note:** Guardian shipped same commit as Observer v0.5 — checkpoint was run manually after, not a hard gate before coding. Safe because Guardian was batch-only until §5 UI.

---

## 5. Proposal surface + layers v0 (Build Sequence items 3–4)

**Purpose:** Surface Guardian-verified proposals in Foundation Hub; user approves to create evolution layers on Phase 1.

| Piece | Notes |
|-------|--------|
| `36_foundation_proposal_decisions.sql` | `user_decision`, `decided_at`, `decision_note` on proposals |
| `37_foundation_layers.sql` | Approved layer rows |
| API | `GET /api/foundation/proposals`, `POST …/decide` |
| UI | `FoundationProposalsPanel.tsx` — Approve / Not now / Dismiss |
| Context | `loadFoundationLayers` → agents + Maya |

**Ops:** Run migrations `36` + `37` in Supabase before using UI.

**Not in scope yet:** Reject cooldown, defer resurface cron, full proposal UI in Approvals queue.

---

## Known open items

| Item | Notes |
|------|--------|
| Run `36` + `37` SQL | Required for proposal UI + approve flow |
| Guardian threshold tuning | Hold until more organic changelog signal |
| Observer reject cooldown | Vision open question |
| Zernio DPA tenant isolation | Unchanged from CONTEXTV22 §8 |

---

## 6. July 5 addendum — team workspace critical hardening

**Branch:** `cursor/critical-bug-investigation-8f63`.

**Fixed:**
- Team invite acceptance now requires the signed-in Clerk user to match the invited existing profile/email before `profiles.account_id` is changed.
- Team invite API responses no longer expose `invite_token`; the token is only used in the email link.
- Assignment starts atomically claim pending tasks before dispatch, preventing duplicate runs/credit deductions from double submits.
- Approval queue list/approve/reject/bulk APIs and `/dashboard/agents/approvals` are owner-only, matching `TEAM_WORKSPACE_SPEC.md`'s conservative approval rule.

**Validated:** `npx tsc --noEmit` and `npm run build` passed on July 5.

---

## Do not revert

- All CONTEXTV23 “do not revert” items (run sub-pages, canonical profile, GA OAuth save, credits copy).
- Transactional email on-brand template across migrated routes.
- Guardian `reject_internal` for clusters below threshold.
- Proposal surface — user must approve before layers enter agent context.
- Owner-only approval gates and authenticated invite acceptance from the July 5 addendum.

---

## Related docs

| Doc | Role |
|-----|------|
| `CONTEXTV23.md` | July 3 handoff (profile resolution, Agents UX, GA fix) |
| `SESSION_2026-07-04.md` | This session log + changelog/proposal review |
| `SESSION_2026-07-05.md` | Critical team workspace hardening addendum |
| `FOUNDATION_GUARDIAN_HANDOFF.md` | Observer + Guardian build spec |
| `foundation_intelligence_vision.md` | Vision + build sequence |
| `AGENTS.md` | Product rules + deploy |

---

*End CONTEXTV24 — July 5 addendum*
