# CONTEXTV23 — Profile resolution, Agents UX, Foundation site snapshot, GA OAuth fix
*Snapshot: July 4, 2026 — supersedes `CONTEXTV22.md` for logged-in product work*

Session logs: `SESSION_2026-07-03.md`, `SESSION_2026-07-04.md`.

---

## Repository state

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app
Branch: main (plus PR #15: `cursor/critical-bug-investigation-6516`)
Latest commits: fe5bae7 (critical auth/snapshot/agent regressions, PR #15) · 5a2a2c1 (GA OAuth canonical save, July 4 merge) · 7002bb6 (Agents UX + site snapshot, July 3)
Prior handoff: CONTEXTV22 (July 2 lifecycle + Zernio DPA)
```

**Deploy workflow:** push directly to `main` → Vercel auto-deploys. PRs only when a change genuinely needs review.

Before every push: `git remote -v` must show `rovaneD/agent7even-v2`.

---

## What changed since CONTEXTV22 (index)

| Area | Commits | Doc |
|------|---------|-----|
| Foundation Observer v0.5 + Guardian v0 | `34f17ac`, `b053922` | `FOUNDATION_GUARDIAN_HANDOFF.md` |
| Agent run sub-pages + Command Center UX | `7002bb6` | **This file §1** |
| Foundation site snapshot slice | `7002bb6` | **This file §2** · `34_foundation_site_snapshot.sql` |
| On-brand transactional email | `7002bb6` | **This file §3** |
| Duplicate profile / plan drift fix | `0a212f9`, `d18032b` | **This file §4** |
| GA OAuth canonical token save | `00f5b1d`, `5a2a2c1` | **This file §5** |
| Credits ledger UX clarity | `7002bb6` | **This file §6** |
| Critical bug investigation hardening | `fe5bae7` / PR #15 | **This file §7** · `SESSION_2026-07-04.md` |

---

## 1. Agents Command Center — run sub-pages (not modals)

**Problem:** Guided agent setup in modals conflicted with Maya chat surface rules; hub was overloaded.

**Shipped:**

| Piece | Path / module |
|-------|----------------|
| Run route | `app/dashboard/agents/[agentId]/run/page.tsx` |
| Shell + client | `components/agents/AgentRunShell.tsx`, `AgentRunClient.tsx`, `AgentRunStatusBanner.tsx` |
| Config + hrefs | `lib/agents/guidedSetup.ts`, `lib/agents/agentRunUi.ts` |
| Hub slim-down | `AgentCommandCenter.tsx` — cards navigate to run pages |

**UX additions (same commit):**

- Output status pills: Approved (green), Rejected (red), In review (amber)
- Live activity: collapsible **Completed today** and **Recent runs**
- Agent scorecard: full-row link to `/dashboard/agents/{id}/outputs` with hover + `ExternalLink`
- Section explainers under Live activity and Agent scorecard

**Do not revert:** Agent guided setup on dedicated sub-pages (Content Posting pattern), not modals on the hub.

---

## 2. Foundation site snapshot (v0 slice)

**Purpose:** User-reviewed website-derived strategic snapshot — separate from guarded Phase 1 `foundation_answers`.

**Shipped:**

| Piece | Notes |
|-------|--------|
| Migration | `34_foundation_site_snapshot.sql` — `site_snapshot`, `site_snapshot_enabled`, timestamps, source URL on `profiles` |
| Enrich pipeline | `lib/foundation/enrichFromWebsite.ts`, `fetchWebsiteContent.ts`, `siteSnapshot.ts` |
| API | `app/api/foundation/site-snapshot/route.ts`, `app/api/foundation/changelog/route.ts` |
| UI | `components/foundation/SiteSnapshotCard.tsx`, `ObserverChangelogPanel.tsx` in `FoundationHub.tsx` |
| Agent context | `buildAgentContext.ts` reads snapshot when `site_snapshot_enabled` |

**Ops:** Run `34_foundation_site_snapshot.sql` in Supabase if not applied.

**Fix in session:** `enrichFromWebsite.ts` — `fetchedAt` always server timestamp (never client-supplied).

---

## 3. Transactional email — on-brand template

**Problem:** Approval notification email used old dark/terracotta template and `@agent7even.com`.

**Shipped:** `lib/email/transactionalTemplate.ts` — white card, blue `#3B82F6` CTA, pink `#F5349B` wordmark, `support@agent7even.ai`, from `hello@agent7even.ai` (override via `RESEND_FROM`).

**Wired:** `lib/createNotification.ts` for approval-pending emails.

**Not migrated yet:** welcome email, support routes, team invite (still legacy `.com` / terracotta).

---

## 4. Duplicate `profiles` rows — canonical resolution

**Problem:** Same Clerk user could have multiple `profiles` rows. Billing used `pickCanonicalProfile` (Stripe/plan row); Analytics and many API routes used `.eq('clerk_user_id').single()` → wrong row (no plan → demo analytics; Zernio/GA "Profile not found").

**Shipped:**

| Helper | Role |
|--------|------|
| `lib/profiles/resolveClerkProfile.ts` | Generic canonical picker (clerk id, then email) |
| `lib/profiles/getAnalyticsProfile.ts` | Analytics page SSR |
| `lib/profiles/getBillingProfile.ts` | Already existed — billing SSOT |
| `lib/profiles/getDashboardProfile.ts` | Layout / dashboard SSOT |

**API routes updated (`0a212f9`):** Zernio connect/callback/accounts/disconnect; analytics zernio social/inbox/ads; GA connect/properties/data/connect.

**Diagnostic:** `scripts/check-profile-plan.ts <email>` — lists all profile rows for an email.

**Still open:** Merge duplicate Agent7even owner rows in Supabase (two IDs documented in session). Canonical picker is a code-side mitigation, not DB cleanup.

---

## 5. Google Analytics OAuth — token save on canonical profile

**Problem:** After PR #11 (`d18032b`), GA OAuth callback still saved refresh tokens via `.eq('clerk_user_id')` without verifying the **canonical** billing row was updated. Reconnect revoked the old token on canonical; new token could land elsewhere → **"Token refresh failed"** in property selector immediately after "Google Connected".

**Shipped (`00f5b1d` / merge `5a2a2c1`):**

| Module | Role |
|--------|------|
| `lib/analytics/gaOAuthProfile.ts` | `getGaProfileForClerkUser`, `saveGaOAuthTokensForClerkUser`, `refreshGaAccessTokenForClerkUser` (sibling token migrate) |
| `app/api/analytics/ga-callback/route.ts` | Save tokens on canonical profile by `id` |
| `ga-properties`, `ga-data`, `ga-connect`, `disconnect` | Use shared GA profile helpers |
| `lib/googleOAuth.ts` | `refreshGoogleAccessToken` returns `{ accessToken, error, errorCode }` |
| `AnalyticsClient.tsx` | Property selector + GA tab surface reconnect/errors (no infinite spinner) |

**Verified:** Production reconnect after `5a2a2c1` — GA property selection and data load working.

**Reconnect procedure after bad token state:** Disconnect GA → Connect → select property (old revoked tokens do not self-heal).

---

## 6. Credits ledger UX (Plan and credits)

**Problem:** "0 / 1,000 used" + "No usage this month yet" beside June ledger rows looked broken at month boundary.

**Clarifications (`7002bb6`):**

- "No usage in {month} yet. Recent transactions below are from earlier billing periods." when prior-month activity exists
- Allocation line: `{N} spendable now · {M} refreshes {date}` when balance &lt; plan remaining
- Section renamed **Recent ledger**

**Not a bug:** 340 spendable vs 1,000/mo plan = carryover after June usage; meter resets on calendar month.

---

## 7. Critical bug investigation hardening (PR #15)

**Bug pass:** July 4 high-severity review of recent GA OAuth, Foundation site snapshot, and Agents run-page changes.

**Shipped in PR #15 (`fe5bae7`):**

| Area | Guardrail |
|------|-----------|
| GA OAuth callback | Consumed OAuth state must match the active Clerk session before token save; profile resolution uses nonce-bound Clerk ID + Clerk email, never Google OAuth email fallback. |
| Foundation website fetch | `fetchWebsiteContent.ts` validates public HTTP(S) URLs, rejects private/internal DNS/IP targets, follows redirects manually with the same validation, and caps direct HTML buffering. |
| Site snapshot storage | `SiteSnapshotSchema` caps strings/arrays to prevent multi-MB JSON from being stored and injected into agent prompts. |
| Workspace site snapshot | Site snapshot GET/POST/PATCH and `buildAgentContext` resolve canonical actor profile, then workspace owner profile, so team-seat reads and writes match. |
| Agent run pages/APIs | Agents hub/run pages and task/constraint/list APIs use `getDashboardProfileForClerkUser` plus `resolveWorkspaceProfileId`; no duplicate-sensitive `.single()` profile reads on these run paths. |
| Duplicate task submits | Guided agent and Content Posting run buttons use a synchronous in-flight ref guard before `fetch('/api/agents/tasks/create')`. |

**Verified:** `npx tsc --noEmit`, `npm run build`.

---

## Known open items

| Item | Notes |
|------|--------|
| Duplicate `profiles` rows | Run `check-profile-plan.ts`; merge orphans when ready |
| `notifications_type_check` | In-app insert fails for `approval_pending` — email still sends |
| Transactional email migration | Welcome, support, team invite still legacy template |
| `34_foundation_site_snapshot.sql` | Apply in Supabase prod if not done |
| Zernio DPA confirmation | Unchanged from CONTEXTV22 §8 |

---

## Do not revert

- Agent run sub-pages (`/dashboard/agents/[agentId]/run`) — no modal guided setup on hub.
- `resolveClerkProfile` / canonical profile helpers on integration and analytics API routes.
- `saveGaOAuthTokensForClerkUser` — GA tokens on canonical profile **by id**, not blind `clerk_user_id` update.
- GA OAuth callback must verify active Clerk session matches consumed OAuth state; never use Google OAuth email as a profile lookup fallback.
- Foundation site snapshot direct fetches must keep public URL/DNS/redirect validation and body-size caps before buffering.
- Agent run/task APIs must keep canonical profile + workspace owner resolution for workspace-scoped data.
- Credits month-boundary copy (don't show misleading "0 used" without prior-period context).
- On-brand transactional template for new notification emails.

---

## Related docs

| Doc | Role |
|-----|------|
| `CONTEXTV22.md` | Lifecycle v1, Zernio DPA, structured approvals |
| `FOUNDATION_GUARDIAN_HANDOFF.md` | Observer v0.5 + Guardian v0 |
| `FOUNDATION_V2_MEMORY_UPLOADS_HANDOFF.md` | Foundation memory/uploads slice |
| `SESSION_2026-07-04.md` | Critical bug investigation / PR #15 |
| `SESSION_2026-07-03.md` | This session commit log |
| `AGENTS.md` | Product rules + deploy + doc index |

---

*End CONTEXTV23 — July 4, 2026*
