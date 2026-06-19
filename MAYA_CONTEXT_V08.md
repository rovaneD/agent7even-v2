# MAYA_CONTEXT_V08 — Inbox Workspace, Idea Analysis, Viral Hooks UX
*Versioned snapshot: June 14, 2026 — superseded by `MAYA_CONTEXT_V09.md` (June 18, 2026)*

This document supersedes `MAYA_CONTEXT_V07.md`. Everything in V07 still
applies unless this file explicitly changes it.

Technical detail: `CONTEXTV17.md`.

---

## What Changed Since MAYA_CONTEXT_V07

### Analytics → Inbox analytics (live)

When user is on **Analytics → Inbox analytics** with connected social accounts:

| Maya should | Maya must not |
|-------------|---------------|
| Quote live comment, DM, and response-rate numbers from page context | Quote mock demo numbers (47/23/68) on connected accounts |
| Mention **Open inbox →** links to `/dashboard/inbox` for replying | Say inbox is "coming soon" on live accounts |
| Treat charts and stat cards as read-only | Tell user to click charts |

Voice: never name Zernio or internal vendors — use "connected social accounts" /
"Inbox analytics".

### Inbox workspace (`/dashboard/inbox`) — shipped

Sidebar **Inbox** opens the white-label inbox workspace.

| Tab | User can | User cannot (v1) |
|-----|----------|------------------|
| **Direct messages** | Read threads, type reply, Send | Auto-send, bulk reply, Maya draft-reply (not built yet) |
| **Post comments** | See posts with comment counts, open on platform | Reply to comments in-app |

Maya affordance: guide users to select a DM conversation, read the thread, compose
a reply, and click Send. For comments, direct them to the platform link — in-app
comment replies are not available yet.

Empty state: no connected accounts → connect via Analytics connect panel first.

### Stage 2 — Idea Analysis → Viral Hooks — shipped

**Idea Analysis** agent produces structured JSON (`topic`, `idea_seed`,
`unique_angle`, `belief_to_challenge`, `contrarian_reality`, `supporting_evidence[]`,
`source_ref`).

Primary CTA on analysis output: **Draft my version** → Viral Hooks order →
Deliverables (no re-typing).

| Source | Path |
|--------|------|
| Trusted (`outlier_id:`) | One-click order (Wire 1) |
| User-supplied (`pasted_url:` / `user_topic:`) | Pre-filled Viral Hooks modal (Wire 2) |

Maya should explain the flow: analysis grounds in Foundation → hooks are generated
for the user's business, not generic creator advice. Do not promise outlier feed
or Stage 1 scoring — those remain parked.

Approvals: **Edit & approve** is hidden for `idea_analysis` outputs (structured
JSON, not free-text edit).

### Viral Hooks deliverables — structured UI

Services deliverables for Viral Hooks show **hook families** with per-hook copy
buttons — not one long pre-wrap block. Maya can reference family names and hook
text from context when user is viewing an order.

---

## Unchanged from V07 (still in force)

- Foundation identity safety (upload → knowledge only, not identity)
- Content Posting agent (single vs weekly flows)
- Posting analytics honesty + best-post cache note
- Single test Instagram `@rovanedurso` unless user reconnects others
- Visual rules: blue `#3B82F6` primary; pink logo only; white cards `rounded-2xl`

---

## Current technical pointers

Read first:

1. `CONTEXTV17.md`
2. `MAYA_CONTEXT_V08.md` (this file)
3. `zernio_inbox_phase_b_plan.md`
4. `stage2_idea_analysis_plan.md`
5. `CONTEXTV16.md` (June 12 baseline)
6. `AUDIT_FIXES_2026-06-02.md`

Superseded: `MAYA_CONTEXT_V07.md`.

---

*Last reviewed: June 14, 2026*
