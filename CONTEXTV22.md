# CONTEXTV22 — Product integrity, structured approvals, Phase C close-out
*Snapshot: July 4, 2026 — supersedes `CONTEXTV21.md` for logged-in product work; marketing hero/channel sections in V21 remain valid unless noted here*

Session log: `SESSION_2026-07-01.md` (+ July 2 vendor/compliance updates in §8), `SESSION_2026-07-04.md`.

---

## Repository state

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app
Branch: main
Latest commits: 5879ebd (Thread 3 lifecycle + Phase A crop, July 2, 2026)
Prior handoff: CONTEXTV21 (June 25 lab5 marketing)
```

Before every push: `git remote -v` must show `rovaneD/agent7even-v2`.

---

## What changed since CONTEXTV21 (index)

| Area | Commits / handoffs | Doc |
|------|-------------------|-----|
| Phase C dashboard cold-open | `4164c3b` | `phaseC_dashboard_cold_open_handoff.md` |
| IA regroup + lifecycle + grounding | `9aabc6c` … `822f429` | `phaseC_ia_regroup_handoff.md`, `phaseC_asset_lifecycle_handoff.md`, `phaseC_situational_grounding_handoff.md` |
| Media credits + services clarity | `2936a92` | `phaseC_credits_services_clarity_handoff.md` |
| Explainability + inbox | `ec0031f` … `1acdb62` | `phaseC_explainability_handoff.md`, `zernio_inbox_phase_b_plan.md` |
| Thread 7 Layer 2 (Apply gate) | `1e03e90` | `phaseC_dashboard_cold_open_handoff.md` § Maya write-path |
| SEO + marketing expansion | `8d6d936` … `abb8351` | Marketing routes under `app/` (blog, use-cases, company) |
| Business sizing + admin | `95a2001` | Settings fields; admin client card |
| Marketing polish (post-V21) | `dcc964c`, `059c7bb`, `c949a77` | Footer CTA width, How It Works cards, hero/nav tweaks |
| **Structured agent output views** | `c0c6911`, `9482a9d` | **This file §1** |
| **AI Toolkit trial limits** | `c0c6911` | **This file §2** |
| **Foundation competitors array** | `df774f2` | **This file §3** |
| **Sidebar progress sync** | `2822a3b` | **This file §4** |
| **Approval count SSOT** | `b889cc6` | **This file §5** |
| **Thread 3 lifecycle v1 + crop** | `5879ebd` | **This file §7** |
| **Zernio DPA + compliance** | Jul 2, 2026 (vendor) | **This file §8** |
| **GA OAuth callback profile hardening** | `b99867a` | **This file §9**, `SESSION_2026-07-04.md` |

---

## 1. Structured agent output views (Approvals + archive)

**Problem:** Campaign Builder, Ad Variations, and Email Sequence outputs rendered as raw markdown walls in the approval queue and output detail — hard to scan, easy to miss compliance blocks.

**Shipped:**

| Agent | Parser | View component | Surfaces |
|-------|--------|----------------|----------|
| Ad Variations | `lib/agents/adVariationsParse.ts` | `components/agents/AdVariationsOutputView.tsx` | `ApprovalsClient`, `AgentOutputDetail` |
| Campaign Builder | `lib/agents/campaignParse.ts` | `components/agents/CampaignOutputView.tsx` | same |
| Email Sequence | — (markdown body) | `components/agents/EmailSequenceOutputView.tsx` | ReactMarkdown on body copy |

**Follow-on (`9482a9d`):** Ad Variations compliance + trailing sections use ReactMarkdown; parser stops at document footers; Missing Inputs and Testing Recommendation render as structured cards.

**Do not revert:** Card-based structured views for these agents in approval/detail — keep parsers in `lib/agents/*Parse.ts`, not inline in client components.

---

## 2. AI Toolkit trial limits (Starter 5-run cap)

**Source of truth:** `lib/ai/toolkitPlanLimits.ts`

- Starter trial: **5 total AI Toolkit runs** (matches AGENTS.md trial rule).
- Paid plans: per-plan limits from shared helpers.
- UI: `AIToolkitClient.tsx` + `app/dashboard/ai-toolkit/page.tsx` — banner and disabled state when cap hit.

**Related:** Open Canvas flow model field fix in `components/campaigns/OpenCanvasFlow.tsx` (same commit).

---

## 3. Foundation competitors — comma-split bug

**Root cause:** `competitors` shared a comma-split `toArray()` helper with chips/channels. Prose containing commas (e.g. "Acme, Inc.") fragmented across three competitor slots.

**Fix:** `lib/foundation/competitorsArray.ts` — dedicated `string[]` hydration/formatting end-to-end.

**Touched:** Foundation Hub, page, editor, save-answers API, generate/regenerate routes, `loadFoundationContext.ts`.

**Verification:** `scripts/check-foundation-competitors.ts` — checks `foundation_answers.competitors` JSON shape in DB.

---

## 4. Sidebar progress bars

| Surface | Fix | File |
|---------|-----|------|
| Foundation score | Hub `rescoreAnswers()` now dispatches `foundation:rescored` (sidebar was listening but Hub never fired) | `FoundationHub.tsx`, `DashboardShell.tsx` |
| Brand Kit % | Red below 50%, blue 50–99%, green at 100% | `DashboardShell.tsx`, `BrandKitView.tsx` |

---

## 5. Approval / review count — single source of truth

**Bug (live Jul 1):** Same account showed **5** pending in Maya's brief (header, APPROVALS card, NEEDS REVIEW list) and **0** in Content Pipeline → REVIEW, Agents snapshot, and "Queue is clear" banner.

**Root cause:**

1. `MorningDigest` used `Math.max(stale digest.approvals.length, liveCount)` — cached `daily_digests.approvals` JSON could inflate the count after items were already approved.
2. Different read-points used `agent_tasks` (completed + `requires_approval` + no approve/reject timestamps) vs digest JSON — not aligned on output lifecycle.

**Fix:** `lib/agents/pendingApprovals.ts`

| Export | Purpose |
|--------|---------|
| `getPendingApprovalCount()` | Count `agent_outputs` where `status = 'pending_approval'` |
| `listPendingApprovalDigestItems()` | Maya brief + digest generate rows |
| `listPendingApprovalTasks()` | Approvals queue (tasks with pending outputs only) |

**All six read-points** now use this helper:

1. Dashboard header / APPROVALS stat / NEEDS REVIEW — live props from `page.tsx` (not stale digest)
2. Content Pipeline → REVIEW — `getContentLifecycleCounts`
3. Sidebar Agents badge — `layout.tsx`
4. Agents OPERATING SNAPSHOT → APPROVALS — `agents/page.tsx`
5. "Queue is clear" banner — `AgentCommandCenter.tsx` (`pendingApprovals.length`)
6. Digest generation — `/api/digest/generate`

**Also:** `digestStale` when cached digest approval count ≠ live count; Command Center realtime removes items on approve/reject or output leaving `pending_approval`.

**Thread 3 note (Jul 1):** Count surfacing was fixed before lifecycle v1 shipped (`5879ebd`). Lifecycle spine is now on `agent_outputs.lifecycle_stage` — see §6.

---

## 6. Phase C execution status (audit spine)

Update for `site_audit_master.md` §6 tracker:

| Phase C slice | Status |
|---------------|--------|
| Dashboard cold-open (Maya's brief) | **Shipped** (`4164c3b` + follow-ons) |
| IA regroup (7 groups) | **Shipped** |
| Asset lifecycle surfacing | **Shipped** — Thread 3 v1: `lifecycle_stage` + Approved pipeline stage (`30_content_lifecycle_unification.sql`) |
| Credits + services clarity | **Shipped** |
| Explainability pass | **Shipped** |
| Situational grounding L1 | **Shipped** |
| Thread 7 Layer 2 (Apply gate) | **Shipped** |
| Stale digest refresh | **Shipped** |
| Approval count consistency | **Shipped** (`b889cc6`) |
| Structured approval output views | **Shipped** (`c0c6911`, `9482a9d`) |
| **Remaining Phase C** | IA polish only · situational grounding depth (Thread 7 write-path extensions) |

---

## Do not revert

- `agent_outputs.pending_approval` as approval-queue count SSOT (`lib/agents/pendingApprovals.ts`).
- Live pending count/list on dashboard brief — no `Math.max` with digest JSON.
- Foundation `competitors` as `string[]` via `competitorsArray.ts`.
- Structured output views for Campaign Builder, Ad Variations, Email Sequence in approvals.
- Starter trial 5-run cap for AI Toolkit.
- `agent_outputs.lifecycle_stage` + `zernio_post_id` as content pipeline SSOT (Thread 3 v1).

---

## 7. Thread 3 — Content lifecycle unification (v1)

**Problem:** Three parallel models (agent outputs, tasks, Zernio posts) with no explicit **Approved** stage between Review and Draft.

**Shipped:**

- Migration `30_content_lifecycle_unification.sql` — columns + backfill
- `lib/content/agentOutputLifecycle.ts` — stage helpers, Zernio link/sync
- Pipeline bar: Review → **Approved** → Draft → Scheduled → Published
- Write paths: runner insert, approve/reject/bulk, publish bridge, posts PATCH sync
- Output archive labels read `lifecycle_stage` when set

**Not in v1:** Calendar as fourth source of truth; bulk approve → auto Zernio publish; webhook-driven lifecycle from Zernio push events.

---

## 8. Zernio vendor gates — DPA + compliance (July 2, 2026)

**Prior state (`CONTEXTV18.md`):** Q4 data-handling/DPA **OPEN**; real client social accounts gated.

**Current state:**

| Item | Status | Notes |
|------|--------|-------|
| **DPA** (`Data-Processing-Agreement-ARBICHAT.pdf`) | **Signed by Agent7even; sent to Zernio** | Rovane Durso Bezerra, CEO. §13 filled: **California law, Los Angeles County** jurisdiction. Zernio pre-signed Miquel Palet 20/03/2026. **Await written confirmation / fully executed copy from Zernio.** |
| **Processing schedule annex** | Optional follow-up | 6-page DPA has no attached Schedule; SOC 2 + trust center partially cover sub-processors |
| **Trust-center NDA** | **Signed** 15 Jun 2026 | Rovane Durso — access to confidential compliance docs (not a DPA) |
| **SOC 2 Type II** | **On file** (NDA) | ARBICHAT d.b.a. Zernio; **Jan 20 – Apr 20, 2026**; Securance Pro; **unqualified** opinion (Security, Confidentiality, Availability); subservice orgs include Google Cloud, Vercel |
| **GDPR attestation** | **On file** | DPLMC International; issued **Feb 2, 2026**, expires **Feb 2, 2027** |
| **Tenant isolation (scoped keys)** | **Still open** | See `CONTEXTV18.md` — Phase 2 scoped-key question pending written answer from Zernio |
| **Meta OAuth branding** | **Mitigation shipped** | Shared Zernio app shows "Social Media Connector"; disclosure in connect flow — separate from DPA |

**Operational gate:**

- **OK now:** owner/test accounts; paying customers on other product surfaces (Stripe live, Clerk live on `.ai` per readiness script).
- **Client social connect:** proceed once Zernio confirms DPA fully executed (or legal comfort with signed copy returned). Optional env: `ZERNIO_CLIENT_ACCOUNTS_ENABLED=true` (`PRODUCTION_LAUNCH_SESSION.md`).
- **Still not OK without Zernio:** assuming BYOK Meta; orphan profile on disconnect (`DELETE /profiles/{id}` fail-soft) — monitor for DPA deletion commitment.

**Vendor files (local, do not commit):** `~/Volumes/Black 10TB/Agent7even Update/Zernio/` — Signed DPA, NDA, SOC 2 report, GDPR certificate.

**Cross-refs updated:** `zernio_social_evaluation_backlog.md` Q4, `PRODUCTION_LAUNCH_SESSION.md` §3, `PRODUCTION_GREENLIGHT.md` §9.2, `AGENTS.md`.

---

## 9. GA OAuth callback profile hardening (July 4, 2026)

**Bug fixed:** PR #13 moved GA OAuth token saves to canonical profile rows, but the callback still passed the selected Google OAuth account email into the profile-resolution fallback. Because OAuth lets the user pick any Google account, that email is not an Agent7even tenant identity.

**Impact:** If the nonce-bound Clerk user had no row linked by `clerk_user_id`, callback fallback could update another active profile whose Agent7even account email matched the selected Google account email, storing the wrong tenant's Google refresh token.

**Fix:** `app/api/analytics/ga-callback/route.ts` now uses `currentUser()` only when `currentUser().id` matches the nonce-bound Clerk ID from `oauth_states`, then passes that Clerk email to `saveGaOAuthTokensForClerkUser()`. `lib/analytics/gaOAuthProfile.ts` no longer falls back to `tokens.oauthEmail` for profile resolution; Google email is saved only as `ga_oauth_email` metadata.

**Do not regress:** OAuth callback writes must resolve canonical `profiles.id` from the nonce-bound Clerk identity. Never use Google OAuth userinfo email as a `profiles` lookup key.

---

## Related docs

| Doc | Role |
|-----|------|
| `SESSION_2026-07-04.md` | GA OAuth callback profile hardening |
| `CONTEXTV21.md` | Lab5 marketing hero, FAQ channels, mockups (still valid for marketing) |
| `CONTEXTV20.md` | Content Posting 3-step UX |
| `phaseC_dashboard_cold_open_handoff.md` | Cold-open + digest + approval count detail |
| `phaseC_asset_lifecycle_handoff.md` | Lifecycle bar (Review stage) |
| `a2_capability_ledger.md` | §6 Thread 3 scope — parallel lifecycle models |
| `zernio_social_evaluation_backlog.md` | Zernio vendor gates + support log |
| `PRODUCTION_LAUNCH_SESSION.md` | Clerk/Stripe/DPA launch steps |
| `PRODUCTION_GREENLIGHT.md` | Full production checklist |
| `per_screen_registry.md` | Screen-by-screen Phase C status |
| `site_audit_master.md` | Audit spine + Phase C tracker |

---

*End CONTEXTV22 — July 4, 2026*
