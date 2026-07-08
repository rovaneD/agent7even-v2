# Team Phase 5 — Task Threads / Shared Chat (Scoping)
*July 8, 2026 · Evaluate after Phase 1–4 shipped*

Read `TEAM_WORKSPACE_SPEC.md` §Phase 5 before building.

---

## Phase 4 exit criteria — status (Agent7even test workspace)

| Check | Result |
|-------|--------|
| Member dashboard shows owner counts | Pass |
| Member agent run → owner approval queue | Pass (Test C, `50f5142`) |
| Member analytics live, no Connect | Pass |
| Member Maya: company Foundation + team roster | Pass |
| Member Posts + Assets workspace data | Pass (`3b774e5`) |
| Owner-only Zernio/GA connect | Pass |

**Verdict:** Phase 4 feedback is sufficient to **evaluate** Phase 5 — not yet to build without product decision.

---

## What Phase 5 would add

Per spec: **task threads / shared chat** on assignments and approval work — coordinate on the work, not a general Slack replacement.

Today:
- Assignments exist (`team_task_assignments`, notifications)
- Approvals queue is owner-visible with member attribution
- Maya knows team roster + pending work (`workspaceTeamContext.ts`)
- No threaded discussion on a task or approval item

---

## Options (pick one in chat)

### Option A — Lightweight task notes (recommended first)
- Thread = `agent_tasks.id` or `agent_outputs.id`
- Plain-text notes, `@mention` optional later
- Owner + assignee + watchers only
- **Effort:** ~1 week · **Risk:** low

### Option B — Approval comment thread
- Extend existing approve/reject flow with required/optional comment
- Surfaces in owner Approvals UI only
- **Effort:** ~3 days · **Risk:** low · Does not replace full task threads

### Option C — Shared Maya session per assignment
- One Maya chat bound to `team_task_assignments.id`
- Member + owner see same transcript
- **Effort:** ~2 weeks · **Risk:** medium (session tenancy, credit attribution)

### Option D — Defer
- Phase 4 covers coordination via assignments + notifications + Maya context
- Revisit when customers ask for in-app discussion

---

## Default recommendation

**Ship Option B first** if anything — approval comments unblock owner/member handoff without new tables.

**Option A** is the right Phase 5 if you want visible collaboration on ongoing work.

**Do not build Option C** until A or B proves insufficient — highest complexity for lowest immediate ROI.

---

## Non-goals (unchanged from spec)

- General team chat / Slack replacement
- Per-member Foundation or separate post pipelines
- Cross-workspace users

---

## Open decisions before build

1. Who can comment on a task — assignee only, or any team member with `agents` permission?
2. Do comments notify the owner always, or only on `@owner`?
3. Are threads visible in Team Activity feed (Phase 2 surface) or only on task detail?

Resolve in chat before implementation.
