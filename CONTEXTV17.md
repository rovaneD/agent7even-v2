# CONTEXTV17 — Zernio Inbox, Stage 2 Idea Analysis, Viral Hooks UX
*Snapshot: June 14, 2026*

This document supersedes `CONTEXTV16.md`. Everything in V16 still applies
unless this file explicitly changes it.

Prior session logs unchanged: `SESSION_2026-06-11.md` (Foundation safety),
`SESSION_2026-06-12.md` (Content Posting + Zernio analytics merge).

---

## Repository State

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app
Branch: main
Latest commits (June 14, 2026):
  caf79c3 — Stage 2 Idea Analysis → Viral Hooks
  59b5bc0 — Zernio inbox Phase A (live analytics) + Phase B (workspace)
Prior: e04a62c (Email Sequence UX), 37f1e2e (Content Posting + Zernio analytics)
```

Before every push: `git remote -v` must show `rovaneD/agent7even-v2`.

---

## What Shipped on `main` (June 14, 2026)

### Zernio inbox — Phase A (live analytics)

| Area | Summary |
|------|---------|
| **Parser** | `lib/social/zernioInboxParse.ts` — maps volume + comments + conversation analytics → UI shape |
| **Publisher** | `getInboxSummary`, `listInboxComments`, `getInboxConversationAnalytics` |
| **API** | `GET /api/analytics/zernio/inbox` — multi-profile fan-out + merge |
| **UI** | Analytics → **Inbox analytics** tab uses live data (no mock bleed when `dataState === 'live'`) |
| **Maya** | `lib/maya/summaries/analyticsContext.ts` — live inbox metrics on connected accounts |

**Verified (test account `@rovanedurso`, 30d):** ~3 comments, ~25 DMs, ~28% response rate
(not mock 47/23/68). Volume API uses `received`/`sent`/`read`; UI composes
comments-vs-DMs split from volume + `/inbox/comments` + conversation analytics.

### Zernio inbox — Phase B (workspace)

| Area | Summary |
|------|---------|
| **Publisher** | `listInboxConversations`, `getInboxThread`, `sendInboxReply` |
| **Tenancy** | `lib/social/requireZernioProfile.ts` — shared Clerk → Supabase profile resolution |
| **Parsers** | `lib/social/zernioInboxWorkspace.ts` — normalized conversation/message/comment types |
| **API routes** | `GET /api/inbox/conversations`, `GET/POST /api/inbox/conversations/[id]/messages`, `GET /api/inbox/comments` |
| **UI** | `/dashboard/inbox` — two-pane DMs (read + reply) + post comments (read-only + platform link) |
| **Nav** | Sidebar **Inbox** after Analytics; Analytics inbox tab **Open inbox →** link |
| **Maya** | `lib/maya/summaries/inboxContext.ts` |
| **Plan** | `zernio_inbox_phase_b_plan.md` (acceptance checked — B4 draft-reply still open) |

**Not built:** Maya draft-reply in composer (B4.1). In-app post-comment replies
(deferred until Zernio exposes per-comment thread API).

### Stage 2 — Idea Analysis → Viral Hooks

| Area | Summary |
|------|---------|
| **Skill SQL** | `18_idea_analysis_skill.sql` — run in Supabase if not applied |
| **Agent** | `lib/agents/ideaAnalysis.ts`, registry + flows wiring |
| **Output UI** | `components/agents/IdeaAnalysisOutputView.tsx` — structured cards + **Draft my version** CTA |
| **Mapper** | `lib/services/viralHooks.ts` — `buildViralHooksBrief()`, Wire 1 + Wire 2 helpers |
| **Wire 1** | Trusted source (`outlier_id:`) → one-click POST order → Services deliverable |
| **Wire 2** | User source (`pasted_url:` / `user_topic:`) → pre-filled Viral Hooks modal |
| **Approvals** | `ApprovalsClient.tsx` — audience from `ideal_customer`; Edit & approve hidden for `idea_analysis` |
| **Digest fix** | `lib/agents/agentOutputText.ts` + `app/api/digest/generate/route.ts` — handles `{ raw: string }` content |
| **Plan** | `stage2_idea_analysis_plan.md` (acceptance checked) |

### Viral Hooks deliverables UX

| Area | Summary |
|------|---------|
| **Parser** | `lib/services/viralHooksParse.ts` — families + hooks from generated markdown |
| **UI** | `components/agents/ViralHooksOutputView.tsx` — cards, per-hook copy, usage guide |
| **Services** | `ServicesClient.tsx` — structured view instead of raw pre-wrap string |

---

## SQL migrations — run in Supabase

| File | Purpose | Status |
|------|---------|--------|
| `11_foundation_answers_snapshot.sql` | Foundation undo columns | **Applied** |
| `12_post_assets_bucket.sql` | post-assets bucket | **Applied** |
| `14_content_posting_agent_skill.sql` | Content Posting skill | **Applied** |
| `16_prevent_duplicate_client_emails.sql` | Unique active client email | **Applied** |
| `17_email_sequence_builder_skill.sql` | Email Sequence Builder skill | Verify in prod |
| **`18_idea_analysis_skill.sql`** | **Idea Analysis agent skill** | **Run if not applied** |

---

## Key paths (quick reference)

| Domain | Paths |
|--------|-------|
| Inbox analytics | `lib/social/zernioInboxParse.ts`, `app/api/analytics/zernio/inbox/route.ts`, Analytics → Inbox tab |
| Inbox workspace | `app/dashboard/inbox/`, `app/api/inbox/`, `lib/social/zernioInboxWorkspace.ts` |
| Idea Analysis | `lib/agents/ideaAnalysis.ts`, `components/agents/IdeaAnalysisOutputView.tsx` |
| Viral Hooks | `lib/services/viralHooks.ts`, `lib/services/viralHooksParse.ts`, `ViralHooksOutputView.tsx` |
| Zernio client | `lib/social/publisher.ts`, `lib/social/requireZernioProfile.ts` |
| Prior (V16) | Foundation safety, Content Posting, posting analytics — see `CONTEXTV16.md` |

---

## Open backlog

1. **Zernio Q4 DPA** — real client social accounts gated until data-handling/DPA cleared; FREE tier / test accounts only.
2. **Inbox B4.1** — Maya draft-reply in `/dashboard/inbox` composer (optional).
3. **In-app comment replies** — blocked on Zernio per-comment thread API; comments tab is read-only + platform link today.
4. **Competitor post-level metrics (CONDITIONAL GO)** — Stage 1/3 parked; see `backlog_gate_competitor_reach.md`.
5. **Zernio native publish → analytics** — confirm sync before trusting best-post for composer publishes.
6. **Engagement cron** — `GET /api/cron/calculate-engagement` with `CRON_SECRET` (never ran in v2).
7. **Post media Phases A–C** — gated on `post_media_expansion_handoff.md`.
8. **Port to agent7even-app** — separate repo; live Stripe, crons, full QA.
9. **Show the artifact, not the description** (marketing site + product UI principle): when communicating what Maya produces, surface the actual deliverable in context (approved post, brief, report, analytics view) rather than describing it in prose. Borrowed from Viktor ([viktor.com](https://viktor.com)) — their Slack-thread mockups show real .xlsx/.pdf outputs landing, making "ships real work, not text" instantly credible. Competitor reference only; not Foundation.

**Closed (June 14):** Stage 2 Idea Analysis → Viral Hooks. Zernio inbox Phase A + B (core).

---

## Current docs to read first

| Priority | Doc |
|----------|-----|
| Technical state | `CONTEXTV17.md` (this file) |
| Prior technical | `CONTEXTV16.md` |
| Maya product rules | `MAYA_CONTEXT_V08.md` |
| Inbox build record | `zernio_inbox_phase_b_plan.md` |
| Stage 2 build record | `stage2_idea_analysis_plan.md` |
| Analytics spec | `analytics_v2_spec.md` (Phase 5 done) |
| Foundation safety | `SESSION_2026-06-11.md` |
| June 14 session | `SESSION_2026-06-14.md` |
| Audit ledger | `AUDIT_FIXES_2026-06-02.md` |

Superseded: `CONTEXTV16.md` (for latest state), `MAYA_CONTEXT_V07.md`.

---

*Last reviewed: June 14, 2026*
