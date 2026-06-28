# Per-Screen Registry — Agent7even v2

**Status:** Phase C reference doc (June 10, 2026)  
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
| Dashboard (cold open) | `/dashboard` | P0 | T2 T3 T7 | Cold-open brief · lifecycle bar · plan usage callout · canonical profile | Digest section subtitles shipped |

---

## Logged-in — Intelligence

| Screen | Route | Priority | Threads | Phase C shipped | Remaining |
|--------|-------|----------|---------|-----------------|-----------|
| Agents Command Center | `/dashboard/agents` | P0 | T4 T7 | Agent setup form grounding (Layer 1) | Layer 2 actuation — blocked on chat write-path |
| Approvals | `/dashboard/agents/approvals` | P1 | T3 T7 | Maya context · lifecycle → Review link · draft-post banner | — |
| Agent outputs archive | `/dashboard/agents/[id]/outputs` | P2 | T3 | Maya context | Tie outputs to lifecycle stages |
| Analytics | `/dashboard/analytics` | P1 | T7 | Tab activeView · connect panel/modal grounding | Inbox reply management (product gap) |
| Inbox | `/dashboard/inbox` | P2 | T7 | Maya context | Zernio inbox depth / reply UX |

---

## Logged-in — Brand

| Screen | Route | Priority | Threads | Phase C shipped | Remaining |
|--------|-------|----------|---------|-----------------|-----------|
| Foundation Hub | `/dashboard/foundation` | P0 | T7 | Tab + section edit form grounding · ingest success messaging | — |
| Foundation Editor (legacy) | `/dashboard/foundation` (flag off) | P2 | T7 | Editor form grounding | Retire when V2 flag universal |
| Brand Kit | `/dashboard/brand-kit` | P1 | T1 T7 | Tab activeView · media credit + ProAgent premium callout | — |

---

## Logged-in — Campaigns

| Screen | Route | Priority | Threads | Phase C shipped | Remaining |
|--------|-------|----------|---------|-----------------|-----------|
| Campaigns list | `/dashboard/campaigns` | P1 | T3 | Maya list context · artifact preview on cards | — |
| New campaign — guided | `/dashboard/campaigns/new` | P1 | T7 | Step form grounding (Layer 1) | Layer 2 actuation |
| New campaign — open canvas | `/dashboard/campaigns/new?mode=open` | P1 | T7 | Chat + draft input grounding | — |
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
| Services | `/dashboard/services` | P0 | T2 | Hero · plan callout · order status hints | Order ↔ support linking in UI |
| Service inquiry (scoped) | `/dashboard/services/inquiry` | P1 | T2 T7 | Full 3-step form grounding (Layer 1) | — |
| Deliverables | `/dashboard/deliverables` | P2 | T2 | Maya context | Upload → agent context loop |
| Support | `/dashboard/support` | P2 | T2 | Maya context | Ticket ↔ service order linking in UI |

---

## Logged-in — Settings (account)

| Screen | Route | Priority | Threads | Phase C shipped | Remaining |
|--------|-------|----------|---------|-----------------|-----------|
| Notifications | `/dashboard/notifications` | P2 | — | Maya context | — |
| Team | `/dashboard/team` | P2 | T2 | Maya context · seat limits in context | Extra seat checkout inline |
| Billing | `/dashboard/billing` | P0 | T2 | Media credits copy · plan bullets · top-up wording | Flagged pricing decisions only |
| Settings | `/dashboard/settings` | P1 | T7 | Live form grounding (company, URL, IG, prefs) | — |

---

## Secondary / legacy routes (not in IA regroup nav)

| Screen | Route | Priority | Notes |
|--------|-------|----------|-------|
| AI Toolkit | `/dashboard/ai-toolkit` | P2 | Route exists; removed from sidebar IA. Trial run limits vs unlimited agents messaging. |
| Content posting flows | `/dashboard/agents/content-posting/*` | P2 | Agent-specific posting subflows |

---

## Phase C slice index (for agents)

| Slice | Handoff | Screens touched |
|-------|---------|-----------------|
| Dashboard cold-open | `phaseC_dashboard_cold_open_handoff.md` | Dashboard |
| IA regroup (7 groups) | `phaseC_ia_regroup_handoff.md` | All sidebar routes |
| Asset lifecycle | `phaseC_asset_lifecycle_handoff.md` | Dashboard, Posts |
| Credits + services clarity | `phaseC_credits_services_clarity_handoff.md` | Dashboard, Services, Billing, MorningDigest |
| Situational grounding L1 | `phaseC_situational_grounding_handoff.md` | Agents, Foundation, Posts, Settings, Analytics, Campaigns new, Service inquiry |
| Explainability pass | `phaseC_explainability_handoff.md` | Dashboard brief, Campaigns, Approvals, Posts, Services |

---

## Explicitly out of scope here

- **Admin console** (`/admin/*`) — separate operator UX; not Phase C client retention work
- **Flagged product decisions** — ProAgent rename, trial-on-all-plans, Starter→Growth non-volume lever
- **Thread 7 Layer 2** — Maya form actuation via chat; requires new API design

---

## Verification

When editing a screen, check:
1. Route listed above with correct Phase C status
2. `useMayaContext` / server `CanvasContextDispatcher` payload includes `activeView` when a form or modal is open
3. Credit copy says **media credits** on user-facing surfaces (T2)
4. Lifecycle stages link to Approvals or Posts filters (T3)
