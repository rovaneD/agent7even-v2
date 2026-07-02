# Per-Screen Registry — Agent7even v2

**Status:** Phase C reference doc (updated July 1, 2026)  
**Repo:** `rovaneD/agent7even-v2`  
**Sources:** `site_audit_master.md` (571-page logged-in audit + 4 marketing pages), Phase C handoffs, live route recon

This is the durable screen-by-screen reference for product/UX work. Scores for marketing pages come from the marketing audit; logged-in screens use audit **themes** and Phase C fix status where individual scores were not transcribed from the 571-page PDF.

---

## How to read this doc

| Column | Meaning |
|--------|---------|
| **Score** | Marketing audit score where available; logged-in = theme severity (P0/P1/P2) |
| **Threads** | Cross-cutting threads from `site_audit_master.md` §3 |
| **Phase C** | Shipped fix slices affecting this screen |
| **Remaining** | Next UX work — not flagged product decisions |

**Thread key:** T1 creative legibility · T2 credits/services · T3 artifact/lifecycle · T4 agent architecture · T5 social proof · T6 two-ICP · T7 situational grounding

---

## Marketing site (Phase B)

| Screen | Route | Score | Priority | Threads | Phase status | Remaining |
|--------|-------|-------|----------|---------|--------------|-----------|
| Homepage | `/` | 7.0–7.5 | P1 | T1 T4 T6 | Phase B shipped (`7b4c15f`) | Show real output artifacts (T3) when A2 ledger locked |
| Agents | `/agents` | 8.5 | P2 | T1 T4 | Phase B shipped | Strongest page — keep as architecture anchor |
| Use Cases | `/lab5/use-cases` | 6.0 | P1 | T6 | Startups slice shipped (`ef28bac`) | Vertical differentiation by agent emphasis |
| Pricing | `/pricing` | 5.2 | P0 | T2 T1 | Media credits framing shipped (`96e5955`) | Flagged: trial structure, Starter→Growth lever — **decisions pending** |

---

## Logged-in — Maya

| Screen | Route | Priority | Threads | Phase C shipped | Remaining |
|--------|-------|----------|---------|-----------------|-----------|
| Dashboard (cold open) | `/dashboard` | P0 | T2 T3 T7 | Cold-open brief · lifecycle bar · plan usage callout · approval count SSOT · stale digest refresh | Thread 3 unified lifecycle (not surfacing-only) |

---

## Logged-in — Intelligence

| Screen | Route | Priority | Threads | Phase C shipped | Remaining |
|--------|-------|----------|---------|-----------------|-----------|
| Agents Command Center | `/dashboard/agents` | P0 | T4 T7 | Agent setup form grounding (Layer 1) · Layer 2 form actuation · approval snapshot matches dashboard | — |
| Approvals | `/dashboard/agents/approvals` | P1 | T3 T7 | Maya context · lifecycle → Review link · draft-post banner · structured output views (Campaign, Ad Variations, Email) | — |
| Agent outputs archive | `/dashboard/agents/[id]/outputs` | P2 | T3 | Maya context · lifecycle stage labels · structured detail views | — |
| Analytics | `/dashboard/analytics` | P1 | T7 | Tab activeView · connect panel/modal grounding | — |
| Inbox | `/dashboard/inbox` | P2 | T7 | Maya context · DM + comment reply · Maya draft-reply | — |

---

## Logged-in — Brand

| Screen | Route | Priority | Threads | Phase C shipped | Remaining |
|--------|-------|----------|---------|-----------------|-----------|
| Foundation Hub | `/dashboard/foundation` | P0 | T7 | Tab + section edit form grounding · ingest success messaging · competitors string[] · sidebar rescore sync | — |
| Foundation Editor (legacy) | `/dashboard/foundation` (flag off) | P2 | T7 | Editor form grounding | Retire when V2 flag universal |
| Brand Kit | `/dashboard/brand-kit` | P1 | T1 T7 | Tab activeView · media credit + ProAgent premium callout · progress bar color thresholds | — |

---

## Logged-in — Campaigns

| Screen | Route | Priority | Threads | Phase C shipped | Remaining |
|--------|-------|----------|---------|-----------------|-----------|
| Campaigns list | `/dashboard/campaigns` | P1 | T3 | Maya list context · artifact preview on cards | — |
| New campaign — guided | `/dashboard/campaigns/new` | P1 | T7 | Step form grounding (Layer 1) · Layer 2 form actuation | — |
| New campaign — open canvas | `/dashboard/campaigns/new?mode=open` | P1 | T7 | Chat + draft input grounding · Layer 2 form actuation | — |
| Campaign detail | `/dashboard/campaigns/[id]` | P1 | T3 T7 | Detail Maya context · do-this-today explainer | — |

---

## Logged-in — Content

| Screen | Route | Priority | Threads | Phase C shipped | Remaining |
|--------|-------|----------|---------|-----------------|-----------|
| Content Calendar | `/dashboard/calendar` | P2 | T3 | IA regroup · lifecycle bar · execution hints on entries | — |
| Posts | `/dashboard/posts` | P0 | T1 T3 T7 | Compose grounding · lifecycle bar · approval bridge copy | — |
| Assets | `/dashboard/assets` | P2 | T3 | Maya context · Posts + workflow links | — |

---

## Logged-in — Services

| Screen | Route | Priority | Threads | Phase C shipped | Remaining |
|--------|-------|----------|---------|-----------------|-----------|
| Services | `/dashboard/services` | P0 | T2 | Hero · plan callout · order status hints · order ↔ support linking | — |
| Service inquiry (scoped) | `/dashboard/services/inquiry` | P1 | T2 T7 | Full 3-step form grounding (Layer 1) | — |
| Deliverables | `/dashboard/deliverables` | P2 | T2 | Maya context · upload → agent context callout | — |
| Support | `/dashboard/support` | P2 | T2 | Maya context · ticket ↔ service order linking | — |

---

## Logged-in — Settings (account)

| Screen | Route | Priority | Threads | Phase C shipped | Remaining |
|--------|-------|----------|---------|-----------------|-----------|
| Notifications | `/dashboard/notifications` | P2 | — | Maya context | — |
| Team | `/dashboard/team` | P2 | T2 | Maya context · seat limits in context · extra seat confirm step | — |
| Billing | `/dashboard/billing` | P0 | T2 | Media credits copy · plan bullets · top-up wording | Flagged pricing decisions only |
| Settings | `/dashboard/settings` | P1 | T7 | Live form grounding (company, URL, IG, team size, revenue, prefs) | — |

---

## Secondary / legacy routes (not in IA regroup nav)

| Screen | Route | Priority | Notes |
|--------|-------|----------|-------|
| AI Toolkit | `/dashboard/ai-toolkit` | P2 | Trial vs paid run limits in UI (`lib/ai/toolkitPlanLimits.ts`); removed from sidebar IA |
| Content posting flows | `/dashboard/agents/content-posting/*` | P2 | Agent-specific posting subflows |

---

## Phase C slice index (for agents)

| Slice | Handoff | Screens touched |
|-------|---------|-----------------|
| Dashboard cold-open | `phaseC_dashboard_cold_open_handoff.md` | Dashboard |
| Approval count SSOT | `CONTEXTV22.md` §5 · `lib/agents/pendingApprovals.ts` | Dashboard, Agents, Approvals, layout, digest |
| Structured output views | `CONTEXTV22.md` §1 | Approvals, agent output detail |
| IA regroup (7 groups) | `phaseC_ia_regroup_handoff.md` | All sidebar routes |
| Asset lifecycle | `phaseC_asset_lifecycle_handoff.md` | Dashboard, Posts |
| Credits + services clarity | `phaseC_credits_services_clarity_handoff.md` | Dashboard, Services, Billing, MorningDigest |
| Situational grounding L1 | `phaseC_situational_grounding_handoff.md` | Agents, Foundation, Posts, Settings, Analytics, Campaigns new, Service inquiry |
| Explainability pass | `phaseC_explainability_handoff.md` | Dashboard brief, Campaigns, Approvals, Posts, Services |

---

## Explicitly out of scope here

- **Admin console** (`/admin/*`) — separate operator UX; not Phase C client retention work
- **Flagged product decisions** — ProAgent rename, trial-on-all-plans, Starter→Growth non-volume lever
- **Thread 7 Layer 2** — form actuation via Apply gate shipped (Settings, Posts compose, Open canvas, agents, guided campaign)
- **AI Toolkit** (`/dashboard/ai-toolkit`) — trial vs paid run limits surfaced in UI; route removed from sidebar IA

---

## Verification

When editing a screen, check:
1. Route listed above with correct Phase C status
2. `useMayaContext` / server `CanvasContextDispatcher` payload includes `activeView` when a form or modal is open
3. Credit copy says **media credits** on user-facing surfaces (T2)
4. Lifecycle stages link to Approvals or Posts filters (T3)
