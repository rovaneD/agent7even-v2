# Team Workspace Spec
*Agent7even v2 — multi-seat shared company operations*
*Draft: July 4, 2026 · Status: design authority for Phase 1–4 implementation*

This spec defines how **multiple people work on one company account** — not just access control (V5 seats), but shared data, coordination, owner visibility, and Maya awareness.

**Related code today:** `lib/profiles/workspaceProfile.ts`, `lib/teamPermissions.ts`, `team_members`, `loadDashboardSession`, `resolveWorkspaceClerkProfile`.

**Does not replace:** `CONTEXTV24.md` (session handoff). Update this spec when team behavior ships.

---

## 1. Problem statement

V5 shipped **team seats**: invite, permissions, billing. Users can log in and see modules based on `team_members.permissions`.

What is **not** yet a coherent product:

- Company data (campaigns, agents, posts, Foundation) is sometimes read/written under the **member profile ID** instead of the **workspace (owner) profile ID**.
- Work created by a team member can land in a **silent parallel bucket** the owner never sees.
- The account owner has **no activity feed** for team actions.
- **Maya** treats each login as a solo user (empty Foundation for members; no “who’s doing what”).
- There is **no assignment or handoff** model — only self-serve agent runs.
- **Posting/scheduling** must use one Zernio/GA tenant (owner) with clear approval rules; members must not connect or publish into personal scopes.

Goal: **One marketing operating system per company, many hands, owner oversight, Maya as coordinator.**

---

## 2. Core principles

1. **One workspace, one brain** — Single Foundation, Brand Kit, approval queue, calendar/post pipeline, analytics connections, credit pool (scoped to owner `profiles.id`).
2. **Two IDs on every mutation** — `workspace_id` (owner profile, data tenancy) + `actor_profile_id` (who did it, audit).
3. **Publish gates through approval** — Members draft/run; owner (or delegated role) approves anything that publishes or spends.
4. **Coordinate on the work** — Assignments, approval notes, workspace notifications — not a general team chat in v1.
5. **Maya coordinates; humans approve** — Maya may suggest assignments; owner confirms. Maya never bypasses permission or approval rules.
6. **Owner visibility by default** — Multi-seat accounts get a Team Activity surface; not optional for ProAgent/Growth teams.

---

## 3. Terminology

| Term | Meaning |
|------|---------|
| **Account owner** | `profiles.is_account_owner !== false`, owns billing, invites team, full permissions |
| **Team member** | `is_account_owner === false`, `account_id` → owner’s `profiles.id` |
| **Workspace ID** | Owner’s `profiles.id` — canonical key for all company data |
| **Actor ID** | Logged-in user’s `profiles.id` — attribution only |
| **Workspace profile** | Row loaded via `resolveWorkspaceProfileId()` / `resolveWorkspaceClerkProfile()` |
| **Member profile** | Row for the signed-in Clerk user — permissions + audit only |

**Rule:** Reads/writes of company data use **workspace ID**. Permission checks and audit use **member profile ID**.

---

## 4. Current state (July 4, 2026)

### Shipped

| Area | Behavior |
|------|----------|
| Invites / seats | `team_members`, Stripe seat line items, accept + Clerk webhook |
| Module permissions | `getTeamPermissions`, page redirects, nav filtering |
| Dashboard (partial) | `loadDashboardSession` — workspace counts, team join UX |
| Analytics (partial) | `resolveWorkspaceClerkProfile` — live GA/Zernio for members; connect owner-only |
| Maya sessions (layout) | Sessions listed by workspace ID |
| Foundation proposals/changelog | Workspace-scoped via `resolveWorkspaceProfileId` |

### Known gaps (must fix in Phase 1)

| Surface | Issue |
|---------|--------|
| Agents Command Center | Queries `profile.id` from Clerk user, not workspace |
| Agent task create/API | `user_id` = member ID → split bucket |
| Campaigns / Calendar | Same |
| Posts / scheduling | Member profile → demo/empty Zernio |
| Maya chat | Foundation loaded from member ID → empty context for members |
| Brand Kit APIs | Mixed member vs workspace writes |
| Credits / digests | Mixed |
| Notifications | Per member `user_id`, not workspace fan-out |
| Activity log | Per profile, no owner rollup |

---

## 5. Data model

### 5.1 Existing columns (keep)

- `profiles.account_id`, `profiles.is_account_owner`
- `team_members`: `account_id`, `member_profile_id`, `role`, `permissions`, `status`, `invited_email`

### 5.2 Semantic rule for `user_id` on domain tables

**Target state:** `user_id` on workspace-owned tables = **workspace ID** (owner).

Tables include (non-exhaustive): `campaigns`, `agent_tasks`, `agent_outputs`, `agent_schedules`, `brand_kit_*`, `foundation_documents`, `foundation_answers` (on owner profile row), `credit_balances`, `daily_digests`, `orders`, `maya_sessions` (already workspace in layout).

**Do not** duplicate rows per team member for the same company artifact.

### 5.3 New columns (Phase 2)

Add nullable **`actor_profile_id`** (FK → `profiles.id`) on:

| Table | Purpose |
|-------|---------|
| `agent_tasks` | Who ran or was assigned the task |
| `agent_outputs` | Who produced output awaiting approval |
| `client_activity_log` | Optional; or keep `user_id` as actor and add `workspace_id` |
| Future: publish/schedule events | Who scheduled; who approved |

Migration pattern: backfill `actor_profile_id = user_id` where `user_id` was previously the actor on legacy rows; then repoint `user_id` to workspace where wrong.

### 5.4 Assignment fields (Phase 3)

On `agent_tasks` (or sibling `workspace_assignments` if preferred — prefer columns on existing table):

| Column | Type | Notes |
|--------|------|-------|
| `assigned_to_profile_id` | uuid nullable | Member responsible |
| `assigned_by_profile_id` | uuid nullable | Owner/admin who assigned |
| `assignment_note` | text nullable | Short handoff instruction |
| `assignment_due_at` | timestamptz nullable | Optional deadline |

Status flow for assigned work:

```
assigned → in_progress (member opens/runs) → approval_required → approved/rejected → completed
```

Self-serve runs: `assigned_to_profile_id` null, `actor_profile_id` set on create.

---

## 6. Role matrix

`team_members.role`: `member` | `admin` (permissions JSON remains source of module access).

| Capability | Owner | Admin | Member |
|------------|-------|-------|--------|
| Invite / remove team | ✓ | ✗ (v1) | ✗ |
| Manage billing / plan | ✓ | perm | ✗ |
| Connect GA / Zernio | ✓ | ✗ (v1) | ✗ |
| Edit Foundation (guarded) | ✓ | perm | ✗ or read-only |
| Edit Brand Kit | ✓ | perm | perm |
| Run agents | ✓ | perm | perm |
| Approve agent outputs | ✓ | TBD | ✗ (default) |
| Schedule / publish posts | ✓ | TBD | draft only → approval |
| View analytics | ✓ | perm | perm |
| Assign tasks to others | ✓ | TBD | ✗ |
| View Team Activity | ✓ | ✓ | own actions only (v1) |

**TBD** = product decision before Phase 3; default conservative (owner-only approve/publish/assign).

**Enforcement:** Server-side on every mutating API — UI hiding is not sufficient.

---

## 7. Coordination (no general chat in v1)

### In scope

1. **Workspace notifications** — Fan out to owner (+ relevant member) with `actor_profile_id`, `workspace_id`, typed events.
2. **Approval queue** — Single queue per workspace; show submitter name.
3. **Assignment + note** — Owner assigns agent task with one-line instruction.
4. **Team Activity tab** — Read-only feed on `/dashboard/team` for owner (Phase 2).

### Notification types (extend `notifications`)

| Type | Recipient | Trigger |
|------|-----------|---------|
| `team_member_joined` | Owner | Exists |
| `assignment_created` | Assignee | Owner assigns task |
| `assignment_submitted` | Owner | Member submits for review |
| `approval_pending` | Owner | Output awaits review (include actor) |
| `agent_completed` | Owner optional | Large teams |

Store `metadata.actor_profile_id`, `metadata.workspace_id` where applicable.

### Out of scope v1

- DMs, channels, @mention chat
- Real-time presence (“Melissa is online”)
- Slack/email bridge

### Revisit v2+

- Thread **on a task/approval** (comments array or small `workspace_task_notes` table)
- Maya-mediated message: owner says “ask Melissa to…” → creates assignment + notification

---

## 8. Maya team awareness

### 8.1 Workspace Team Context block

Inject into Maya chat + agent system prompts (when `account_id` set or owner):

```
WORKSPACE TEAM
- Company: {company_name} ({plan})
- You are speaking with: {actor_name} ({role}) — permissions: {summary}
- Account owner: {owner_name}
- Pending workspace approvals: {n} ({short list with actor names})
- Assigned to you: {n} ({titles})
- Recent team activity (7d): {compact lines}
```

Load from workspace ID + `team_members` + pending approvals + assignments + activity feed query.

### 8.2 Behavior rules

| Actor | Maya must |
|-------|-----------|
| Member | Use workspace Foundation/Brand Kit; never claim billing/connect access if denied; route publish to approval |
| Owner | Summarize team backlog; suggest assignments; reference who submitted pending items |
| Both | Never expose another user’s email/password; only work attribution |

### 8.3 Fixes required (Phase 1 + 4)

- Maya chat: resolve **workspace profile** for Foundation/documents (same as `loadFoundationContext(workspaceId)`).
- Page context: include team block on all dashboard pages for members, not only Team page.
- Credits: deduct from workspace pool; log actor.

---

## 9. Posting & scheduling

| Action | Who | Rule |
|--------|-----|------|
| Connect social / GA | Owner only | Already enforced in analytics UI |
| Draft post / run content agent | Member with permission | Task under workspace ID |
| Approve caption/media | Owner (default) | Existing approval queue |
| Schedule/publish via Zernio | After approval | Uses owner’s `zernio_profile_id` |
| Calendar view | All with access | Campaigns scoped to workspace ID |

**Attribution on publish:** `scheduled_by`, `approved_by` profile IDs on output or publish log (Phase 2/3).

---

## 10. Implementation phases

### Phase 1 — Workspace SSOT sweep *(prerequisite)*

**Objective:** Every company read/write uses workspace ID; no split buckets.

**Pattern:**

```ts
const member = await resolveClerkProfile(supabase, clerkUserId, 'id', email)
await activateTeamInviteForProfile(supabase, member.id, email) // if needed
const workspaceId = await resolveWorkspaceProfileId(supabase, member.id)
// queries: .eq('user_id', workspaceId)
// mutations: user_id: workspaceId, actor_profile_id: member.id (Phase 2)
```

**Priority files (audit checklist):**

- `app/dashboard/agents/page.tsx`
- `app/dashboard/campaigns/**`
- `app/dashboard/calendar/page.tsx`
- `app/dashboard/posts/page.tsx`
- `app/api/agents/**`
- `app/api/maya/chat/route.ts`
- `lib/agents/buildAgentContext.ts` (pass workspaceId)
- `app/dashboard/brand-kit/**` + brand API routes
- `lib/credits/**` (workspace balance)
- `app/api/digest/**`, `app/dashboard/notifications/**`

**Exit criteria:** Team member sees same campaigns, agents, approvals, posts data as owner; new agent runs appear in owner’s queue.

---

### Phase 2 — Attribution + owner visibility

- SQL migration: `actor_profile_id` (+ optional `workspace_id` on activity log)
- Backfill script for mis-keyed rows where feasible
- Team page → **Activity** tab (owner): agent runs, approvals, joins, assignments
- Notifications include actor name
- Approval UI: “Submitted by {name}”

**Exit criteria:** Owner answers “what did my team do this week?” from product UI.

---

### Phase 3 — Assignment + handoffs

- Assignment columns on `agent_tasks`
- Owner UI: assign from Agents or Team
- Member UI: “Assigned to you” on dashboard
- Notification on assign + on submit for review
- Optional `assignment_note` display in agent run modal

**Exit criteria:** Owner assigns competitor watch to member; member completes; owner approves in shared queue.

---

### Phase 4 — Maya workspace team brain

- `lib/maya/summaries/workspaceTeamContext.ts` (new)
- Wire into `app/api/maya/chat/route.ts` and `buildAgentContext`
- Permission-aware affordances in system prompt
- Owner prompts: “What’s my team working on?” Member: “What’s assigned to me?”

**Exit criteria:** Maya correctly refuses connect/billing for member; cites team pending work for owner.

---

### Phase 5 — Evaluate task threads / chat

Only after Phase 1–4 shipped and user feedback collected.

---

## 11. API conventions (for implementers)

1. **Resolve session once per request:** member profile + workspace ID + team permissions.
2. **Permission check** on member profile; **data access** on workspace ID.
3. **Owner-only mutations** return `403` with clear error code (`owner_required`, `connect_owner_only`).
4. **Never** use `.eq('clerk_user_id').single()` for domain data when duplicates or team members exist — use `resolveClerkProfile` / `loadDashboardSession`.
5. **Integrations** (GA OAuth, Zernio connect): read/write tokens on workspace profile only.

---

## 12. Testing checklist (manual)

Use two accounts: owner (ProAgent) + invited member with analytics + agents permissions.

- [ ] Member dashboard shows owner campaigns/agent counts (not 0/5 onboarding)
- [ ] Member runs agent → appears in owner Agents list and approval queue
- [ ] Member analytics: live data, no Connect button
- [ ] Member Maya: knows company Foundation, not empty
- [ ] Owner sees Team Activity after Phase 2
- [ ] Member cannot connect Zernio via API (403)
- [ ] Remove member → loses access; workspace data unchanged

---

## 13. Explicit non-goals (this spec)

- Per-member Foundation or Brand Kit copies
- Separate billing/subscription per seat (seats are add-ons to owner subscription)
- Cross-workspace users (one person in two companies) — future account switcher, not now
- Full project management (Kanban, Gantt, time tracking)
- Replacing Support tickets (Agent7even ↔ client) with internal team chat

---

## 14. Open product decisions

| # | Question | Default if unset |
|---|----------|------------------|
| 1 | Can `admin` role approve publishes? | No — owner only |
| 2 | Can `admin` invite/remove members? | No — owner only |
| 3 | Member view of Team Activity | Own actions only |
| 4 | Credit limits per member vs shared pool | Shared pool (owner) |
| 5 | Maya sessions shared or per-user | Shared workspace sessions (current layout) |

Resolve in chat before Phase 3 UI work.

---

## 15. Document history

| Date | Change |
|------|--------|
| 2026-07-04 | Initial spec from team invite UX fixes + architecture review |
