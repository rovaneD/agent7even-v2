# Backlog Gate — Competitor Post-Level Reach (blocks Outlier Intelligence)

**Add this line to the CONTEXTV16 backlog, alongside the Zernio DPA gate.**

---

**GATE (CONDITIONAL GO): Competitor post-level metrics.** Outlier Intelligence
(Stage 1 scoring + Stage 3 `/dashboard/feed`) was blocked by recon (NO-GO) because
no integrated source returned per-post metrics + history for channels the SMB does
**not** own — Zernio analytics is OAuth-scoped to owned accounts; Exa returns web
snippets, not metrics; Competitor Watcher is LLM-narrative with no metrics. Same
severity class as the DPA gate.

**Unblock condition (either):**
1. Zernio confirms third-party channel post analytics (escalate via the DPA
   ticket channel), OR
2. a deliberate metrics integration is chosen (vendor/API returning per-post
   metrics + historical posts for arbitrary public handles).

**CANDIDATE UNBLOCK PATH — EnsembleData** (option 2). A public-data scraping API
with the right shape on all three axes that killed every prior candidate:
- **Capability:** per-post view/engagement + recent posts for arbitrary public
  handles, no OAuth. TikTok `statistics.play_count` confirmed in prep; IG live in
  spike (`video_view_count`, `play_count`, timestamps via `detailed-info` + `reels`).
- **Cost model:** consumption units, daily reset. ~50 units/tenant/weekly refresh
  confirmed in spike → hundreds of tenants on $100-200/mo at published tiers.
- **Metric caveat:** delivers VIEWS/engagement, not private REACH. Correct metric
  for outlier scoring anyway — reach is owner-only across all legitimate sources.

**Spike completed (2026-06-14): CONDITIONAL GO** — `ensembledata_verification_findings.md`
- **Q1:** IG data shape confirmed for non-owned handles.
- **Q2:** ~50 units/tenant/weekly refresh; ~$0.27/tenant/mo at Bronze.
- **Q3:** ToS **unclear** on derived-insight redistribution to Maya end-users —
  vendor/legal confirmation required **before production**.

Stage 1/3 may proceed in design/dev behind a flag. **Do not ship customer-facing
competitor metrics until Q3 closes.** Public-scraped-data risk must be accepted
as a deliberate decision (parallel to Zernio DPA, not a substitute).

**Note:** Discovery (who the competitors are) is a separate, cheaper Exa
question — does NOT unblock metrics. Do not conflate.

**Unaffected:** Stage 2 (Idea Analysis → Viral Hooks) ships independently.
Phase B (structured digest signals) is unblocked but deferred.

---

## BUILD CONSTRAINT — stagger competitor refreshes across the week

When Stage 1 dev proceeds, the refresh job MUST stagger tenant refreshes across
days, not batch them. EnsembleData tiers are a **daily** unit ceiling that resets
at 00:00 UTC — cost is set by peak-day load, not monthly total. Spreading is free
(it's just cron scheduling) and the difference is large:

At 1,000 users × ~50 units/tenant/weekly refresh:
- **Staggered across 7 days** → ~7,150 units/day peak → Silver tier → **$400/mo**
- **All on one day** → ~50,000 units/day → Platinum tier → **$1,400/mo**

Same users, same data, $1,000/mo difference — purely from scheduling. Trivial to
build in upfront, annoying to retrofit.

Two related levers (both raise cost proportionally if changed):
- **Cadence:** weekly is the baseline. Daily refresh = 7× units = jumps tiers.
  Keep refresh weekly-or-slower unless there's a real reason to go faster.
- **Depth:** the ~50 units/tenant figure assumes the lean `detailed-info` path
  (~10 units/competitor, 12 recent posts). Deep `reels` pulls cost more per call.

Cost-per-user actually DROPS with scale on published tiers (~$0.40/user/mo at
1k, ~$0.20 at 7k) since each tier ~doubles capacity for less-than-double price.
Above ~7k users → Diamond/"contact us" custom pricing. Cost is never the gate;
Q3 (resale ToS) is.

Refs: `outlier_intelligence_handoff.md` (Reality State + gate 0c),
`outlier_recon_instruction.md` (NO-GO verdict),
`ensembledata_verification_spike.md`, `ensembledata_verification_findings.md`,
`docs/ensembledata-openapi.json`, `stage2_idea_analysis_plan.md` (active build).
