# CONTEXTV26 — Team Phase 5 threads, Foundation classification, Zernio go-live
*Snapshot: July 9, 2026 — supersedes `CONTEXTV25.md` for logged-in product work*

---

## Repository state

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app
Branch: main
Latest remote: d285aca (approval threads + Foundation polish)
Prior handoff: CONTEXTV25 (July 6)
```

**Deploy workflow:** push to `main` → Vercel auto-deploys. Before push: `git remote -v` → `rovaneD/agent7even-v2`.

---

## What changed since CONTEXTV25 (index)

| Area | Doc |
|------|-----|
| Team Phase 5 Option A — assignment task notes | **§1** |
| Team Phase 5 Option B — approval discussion threads | **§2** |
| Team Activity feed note previews | **§3** |
| Foundation V2 Piece 2 — upload classification + backfill | **§4** |
| Clerk + Zernio resilience fixes | **§5** |
| Zernio go-live clearance + runbook | **§6** |

---

## 1. Team Phase 5 Option A — assignment notes

**Migration:** `42_team_task_notes.sql`

| Piece | Path |
|-------|------|
| CRUD + access | `lib/team/taskNotes.ts` |
| API | `GET/POST /api/agents/tasks/[id]/notes` |
| Notify | `lib/team/notifyTaskNote.ts` — types `task_note`, `task_note_mention` |
| UI | Team open assignments + `/dashboard/team/tasks/[taskId]` |

**Rules:** Any active team member can comment; all members notified on new note; `@mention` → separate notification type.

---

## 2. Team Phase 5 Option B — approval notes

**Migration:** `43_approval_task_notes.sql`

| Piece | Path |
|-------|------|
| CRUD + access | `lib/agents/approvalNotes.ts` |
| API | `GET/POST /api/agents/tasks/[id]/approval-notes` |
| Notify | `lib/agents/notifyApprovalNote.ts` — types `approval_note`, `approval_note_mention` |
| UI | `ApprovalsClient` + `ApprovalDiscussion` — thread on expand; optional approve note |

**Decision notes:** Approve/reject with text → `note_kind` `approved` / `rejected` in thread; submitter notified.

---

## 3. Team Activity feed — note previews

**Module:** `lib/team/workspaceActivity.ts`

Merges last-7-day rows from `team_task_notes` + `approval_task_notes` into owner **Team → Activity** tab.

- Event types: `task_note`, `approval_note`
- Shows quoted note preview + link to task discussion or Approvals deep link
- Fails soft if note tables missing (pre-migration)

---

## 4. Foundation V2 Piece 2 — classification

**Migration:** `41_foundation_knowledge_classification.sql`

| Piece | Path |
|-------|------|
| Classifier | `lib/foundation/classifyKnowledge.ts` |
| Ingest | `app/api/foundation/ingest/route.ts` — parallel classify on upload |
| Hub UI | purpose badges; amber **Needs classification** when null |
| Backfill | `scripts/backfill-knowledge-classification.ts` |

**Agent7even (Jul 9):** 8/8 legacy rows backfilled via script.

Piece 3 (knowledge in agent/Maya context) unchanged from CONTEXTV25 §4.

---

## 5. Resilience fixes (Jul 8–9)

| Fix | Path |
|-----|------|
| Clerk `currentUser()` fail-soft | `lib/clerk/sessionUser.ts` |
| Zernio lifecycle timeout / dev overlay | `lib/social/publisher.ts`, `lib/content/lifecycleCounts.ts` |
| Sidebar X on desktop | `DashboardShell.tsx` — only when mobile drawer open |

---

## 6. Zernio go-live

**Clearance (Jul 8, 2026):** `vendor/zernio/go_live_clearance_2026-07-08.md` — DPA done; **paying customers** may connect live social.

| Ops | Path |
|-----|------|
| Runbook | `vendor/zernio/go_live_runbook.md` |
| Readiness script | `scripts/verify-zernio-go-live-readiness.ts` |
| Tenant regression | `scripts/verify-zernio-tenant-fixes.ts` |
| Launch checklist | `PRODUCTION_GREENLIGHT.md` §9.2 (updated) |

**Still open:** written tenant-isolation / scoped-key answers in Zernio chat (non-blocking for first pilot).

---

## Migrations to apply (Supabase)

Run once if not already applied:

1. `41_foundation_knowledge_classification.sql`
2. `42_team_task_notes.sql`
3. `43_approval_task_notes.sql`

---

## Known open items

| Item | Notes |
|------|--------|
| Zernio tenant isolation write-up | Chat with Elean — not a launch blocker for first paying pilot |
| Hub rescore field-score refresh | Open since June |
| CONTEXT / SESSION hygiene | This doc replaces stale V25 open items for Phase 5 + Piece 2 |

---

## Do not revert

- All CONTEXTV25 “do not revert” items.
- Knowledge as reference-only layer in agents/Maya.
- Owner-only GA/Zernio connect.
- Workspace resolution for team data reads.
- Overall Foundation score = average of six section scores.
- Phase 5 note notifications (task + approval).

---

## Related docs

| Doc | Role |
|-----|------|
| `CONTEXTV25.md` | July 6 handoff (superseded for Phase 5 status) |
| `TEAM_PHASE5_SCOPING.md` | Option A/B/C decision log |
| `TEAM_WORKSPACE_SPEC.md` | Team workspace SSOT |
| `AGENTS.md` | Product rules + deploy |

---

*End CONTEXTV26 — July 9, 2026*
