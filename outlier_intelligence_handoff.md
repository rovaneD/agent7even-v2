# Outlier Intelligence + Idea Analysis — Build Handoff

> **STATUS (post-recon, June 2026): Stage 1 + Stage 3 are PARKED behind a
> data-source gate. Stage 2 is the only active build.**
>
> Recon (`outlier_recon_instruction.md`) returned **NO-GO** on outlier scoring:
> no integrated source returns per-post reach + history for channels the SMB
> does not own. Zernio analytics is OAuth-scoped to owned accounts; Exa returns
> web snippets, not reach; Competitor Watcher is LLM-narrative with no metrics
> behind it. This is a vendor-capability gate, same class as the Zernio DPA gate
> in `CONTEXTV16.md`. See the **Reality State** section below before reading the
> stage specs — several "already exists / for free" assumptions in the original
> draft were false.

---

*Drafted in planning session. Source of inspiration: Sandcastles (creator
research tool). This doc adapts two of its ideas — outlier-scored competitor
intelligence and structured idea decomposition — for Maya's SMB user.*

---

## READ BEFORE WRITING ANY CODE

This handoff describes intent. It does **not** describe the current code
accurately enough to edit from. Before writing anything:

1. `git remote -v` — confirm `rovaneD/agent7even-v2`, NOT `agent7even-app`.
2. Read `MAYA_CONTEXT_V07.md` + `CONTEXTV16.md` — these are the current source
   of truth. (`MAYA_CONTEXT.md` is legacy; do not treat it as authoritative.)
3. Read the **real** files for each system you are about to touch:
   - Competitor Watcher agent skill — find its row in the `agent_skills` table
     (do NOT hardcode prompts; follow the existing `agent_skills` pattern).
   - Performance Digest agent — `analytics_v2_spec.md` describes its
     `briefing + signals[]` JSON contract. Read the actual route + skill row,
     not just the spec.
   - Morning Digest — `app/api/digest/generate/route.ts`,
     `app/api/cron/morning-digest/route.ts`,
     `components/dashboard/MorningDigest.tsx`, `daily_digests` table.
   - Viral Hooks — `app/dashboard/services/ServicesClient.tsx`,
     `lib/services/saveViralHooksDeliverable.ts`, the Viral Hooks generator
     modal, and the `VIRAL_HOOKS_OUTPUT_MARKER` flow.
   - Foundation — `profiles.foundation_answers`, `foundation_documents`,
     and the competitor-reference layer.
   - Runner — `lib/agents/runner.ts` (cost tracking, credit deduction).
4. If anything below contradicts the real files, the real files win. Report
   the contradiction before proceeding.

**Do not build a crawler.** Channel discovery / semantic search is an Exa
buy, not a build (see Foundation Exa handoffs already in the project).

---

## Reality State (verified against repo by recon — this overrides the original draft)

The first draft of this doc assumed several things existed that do not. Corrected:

| Original draft claim | Verified reality |
|---|---|
| Read `MAYA_CONTEXT.md` | Legacy. Use `MAYA_CONTEXT_V07.md` + `CONTEXTV16.md`. |
| Performance Digest emits structured `signals[]` JSON | **Spec only** (`analytics_v2_spec.md`). Live skill emits markdown sections. |
| Outlier findings flow into Morning Digest "for free" | **False.** Morning Digest has no signals section; `digest/generate` only summarizes the last 24h of agent runs. |
| Structured signal contract already built | `analytics_briefings` table (with `signals jsonb`) was migrated but **zero routes consume it**. Dead table. `generate-briefing` route not implemented. |
| Competitor Watcher "monitors with engagement signals" | LLM narrative only — the skill asks for engagement signals *in prose*; it fetches no metrics. |
| Zernio gives post-level analytics usable for outlier math | Owned connected accounts only. No endpoint accepts an arbitrary third-party `@handle`. |
| Exa for competitor intelligence | `exaFindCompetitors()` is unused in production; returns `{url,title,highlights}`, no reach/time-series. |
| `/dashboard/feed`, `competitor_channel_baselines`, `idea_analysis` | None exist. |
| `competitorContext` in `flows.ts` = Foundation competitors | **Misleading name** — it loads prior Competitor Watcher *outputs*. Foundation competitors come via `buildAgentContext` → `loadFoundationContext` (`foundation_answers.competitors`). Do not build on the assumption that variable holds the competitor list. |

**Net effect on the plan:**
- **Stage 2 (Idea Analysis → Viral Hooks)** — unblocked, ships independently.
- **Phase B (structured signals → digest)** — unblocked but a real 5-file build;
  **NOT part of Stage 2** and deliberately deferred (see below).
- **Stage 1 (outlier scoring) + Stage 3 (feed)** — PARKED behind the
  competitor-reach data gate. Tracked as a backlog gate, not a footnote.

---

## Why this exists (the one-paragraph version)

Sandcastles' back half — persona, scripts, automations, exports — Maya
already has. What's worth taking is its *front half*: an **outlier score**
that surfaces which competitor content broke pattern, and a **structured
decomposition** that turns one piece of content into a reusable idea object.
The mistake to avoid: Sandcastles serves a creator who *wants to browse 40
ranked videos and decide*. Maya serves an SMB owner who came to Maya to
**stop** deciding. So we keep the engine and kill the browse-pile: Maya
curates a tiny shortlist, briefs the top one, and every card terminates in a
draft — not a transcript.

---

## What already exists (do not rebuild)

| Need | Already built | Implication |
|---|---|---|
| Briefing surface | Morning Digest (table + cron + widget, 3 sections, inline approve/reject) | Outlier findings render as a digest signal source — but ONLY after the structured signal contract exists (see Stage 0). NOT free. |
| Structured signal contract | **Spec only.** `analytics_v2_spec.md` defines `signals[] = {text, cta_label, cta_route, priority}`, but the LIVE Performance Digest skill still outputs markdown sections, not this shape. | Must be BUILT (Stage 0) before outlier findings can flow into the digest. Do not assume it exists. |
| Competitor monitoring | Competitor Watcher agent (in registry) | EXTEND this agent to compute outlier score. Do not create a new agent. |
| Decomposition → output | Viral Hooks generator (topic/audience/goal/format/tone/notes) | Idea Analysis pre-populates this. Do not build a new generator. |
| Cost tracking | `lib/agents/runner.ts`, `credit_ledger` | All new runs go through the runner. Never bypass it. |

The only genuinely net-new pieces are: (a) per-channel view baselines,
(b) the `idea_analysis` object, (c) the feed surface.

---

## Stage 0 — Prerequisites (build/verify BEFORE Stage 1; flagged in review)

These are not optional and they are not "free." They were incorrectly assumed
to already exist in an earlier draft.

### 0a. Structured signal contract (BUILD — prerequisite for digest ingest)

The live Performance Digest skill outputs **markdown sections**, not the
structured `{text, cta_label, cta_route, priority}` shape. That shape exists
only as a spec in `analytics_v2_spec.md`. Before any outlier finding can flow
into the morning digest:

- Update the Performance Digest (or Competitor Watcher) skill to emit strict
  JSON `signals[]` per the analytics_v2 contract.
- Build the ingest path that writes those signals into `daily_digests`
  sections so `MorningDigest.tsx` renders them.
- This is real work. "Outlier findings reach the digest for free" was wrong.

### 0b. Fix `digest/generate` object-vs-string bug (FIX — sequencing gate)

`app/api/digest/generate/route.ts` throws `slice is not a function` when
`output.content` is an object rather than a string. New signal sources route
through this path — fix the bug FIRST or the new source trips it.

### 0c. Competitor post-level metrics — GATE: CONDITIONAL GO (was NO-GO)

**Recon (June 2026):** no integrated source at that time. **Spike (2026-06-14):**
EnsembleData live API confirms IG per-post **views** + timestamps for non-owned
handles (`detailed-info`, `user/reels`). Cost ~50 units/tenant/weekly refresh
(~$0.27/tenant/mo at Bronze). See `ensembledata_verification_findings.md`.

**Still blocked for production until:**
- EnsembleData ToS / legal confirms **derived outlier insights** (not raw payloads)
  may be shown to Maya end-customers, AND
- public-scraped-data risk accepted alongside the Zernio DPA gate.

**Alternate unblock:** Zernio third-party channel analytics (DPA ticket channel).

Outlier scoring uses **views/engagement**, not private reach.

Discovery (Exa) ≠ metrics. Do not conflate.

**Do not ship customer-facing competitor metrics until Q3 closes.** Dev/design
for Stage 1 + Stage 3 may proceed behind a feature flag.

**Until production gate clears, do not expose:** live baselines, outlier feed,
or scored Competitor Watcher outputs to tenants.

---

## Stage 1 — Extend Competitor Watcher to compute outlier score  ⛔ PARKED (gate 0c NO-GO)

**Outlier score = a post's reach ÷ that channel's recent baseline reach.**
A 7.5M-view post at 2001x normal is a bigger signal than a 7.5M-view post
from a channel that always hits 7M. This is the asset worth taking.

### 1a. Baseline storage (the real cost — scope deliberately)

You cannot compute "20x normal" without storing "normal." New table:

```
competitor_channel_baselines
  id
  account_id              -- Maya account (tenant scope; derive from auth())
  channel_handle
  platform                -- instagram | tiktok | youtube
  rolling_avg_reach       -- trailing N-post mean
  rolling_sample_size
  last_computed_at
```

Decisions to make explicitly (do not guess silently):
- Trailing window: N posts vs N days. Recommend N=last 12 posts per channel.
- Refresh cadence: piggyback on the Competitor Watcher cron, not a new cron.
- Cold start: a channel with < sample_size posts is **ineligible** for the
  feed (no baseline = no trustworthy outlier score). Confidence-gate it.

### 1b. The monitored set comes from Foundation, not a user watchlist

The SMB does not build a watchlist (that's the creator's job in Sandcastles).
Maya seeds the monitored set from Foundation: the SMB's actual competitors +
3–5 high-performing accounts in their category. User confirms; never types a
niche into a search box as the primary path.

This shares a primitive with the parked **Website Audit Agent**: grounded
parallel checks via `Promise.allSettled`, confidence-gated findings. Treat
reference-radar + website-audit as one intelligence service, two output
shapes — do not build two crawlers.

### 1c. Output contract — reuse, don't invent

Competitor Watcher emits the existing Performance Digest signal shape:

```
signals: [
  {
    text: "A competitor broke pattern — this post is at 20x their normal reach.",
    cta_label: "Draft my version",
    cta_route: "/dashboard/feed/<outlier_id>",   // or direct to analysis
    priority: "high"
  }
]
```

Top outlier → high-priority signal → flows into the morning digest with zero
new briefing code. This is the "Maya briefs the top one" behavior, for free.

---

## Stage 2 — Idea Analysis schema (the decomposition each card runs)

A fixed, Foundation-grounded object that turns one piece of content into a
reusable idea. Stored prompt in `agent_skills` (editable without deploys).

```
idea_analysis
  topic
  idea_seed
  unique_angle
  belief_to_challenge      -- the creative payload
  contrarian_reality       -- the creative payload
  supporting_evidence[]    -- 3 concrete directions
  source_ref               -- outlier_id | pasted_url | user_topic
```

Two SMB adaptations (this is what Sandcastles structurally CANNOT do, because
it has no foundation):

- **Ground every field in Foundation.** `belief_to_challenge` must be a belief
  held by *this SMB's actual customers*, pulled from `foundation_answers` —
  not a generic content-creator belief.
- **`supporting_evidence[]` → 3 directions maps to the approval queue.**
  Surface three angles; SMB approves one; that one runs. Mid-chain approval,
  consistent with existing agent constraints + approval-queue pattern.

### THEATER GATE (non-negotiable)

The six fields must **flow into** Viral Hooks — auto-populate topic / angle /
belief into the generator prompt. If the fields render in a pretty card and
the user re-types everything into Viral Hooks, this is performance theater and
the feature has failed. Wire "Create hooks" / "Draft my version" live to every
field, exactly as Sandcastles wires "Create script."

`idea_analysis` → Viral Hooks generator (existing) → Deliverables (existing).

---

## Stage 3 — The feed surface (the only net-new screen)  ⛔ PARKED (depends on Stage 1)

Route: `/dashboard/feed` (confirm naming against existing nav before building).

### Default state — curated, disciplined

- **Max 5 cards. Hard cap. No exceptions in the default surface.**
- **No filter panel in v1.** Do NOT port the Sandcastles 8-control filter
  sidebar into the default view. That is the creator's tool.
- Maya selects: top outliers by score, category-filtered against Foundation,
  baseline-eligible only.
- Each card shows: the outlier signal (what broke pattern + one-line angle)
  and ONE primary button: **"Draft my version."**
- Card → `idea_analysis` → Viral Hooks. The full analysis can live *behind*
  the card for the curious; the default path is card → draft.

### Expansion — the door (user-initiated only)

The user gets the power to expand, but pays the cost of digging themselves.
Three explicit actions:

1. **"Watch another account"** — adds a handle to the monitored set
   (`competitor_channel_baselines`). Next cycle its outliers are eligible.
2. **"Analyze this post"** — paste any URL; run `idea_analysis` immediately.
   Highest-intent path (reactive to something the user actually saw).
3. **"Show more"** — reveals the next handful AND only here do the
   Sandcastles-style filter controls (outlier range, views, engagement,
   recency, platform) appear. Progressive disclosure.

### The relocated cap rule (write this into the spec verbatim)

> The default surface is hard-capped at 5 cards and is filterless.
> Expansion is uncapped and is unlocked only by explicit user action.

The named risk: 5 → 10 → 40 creep, and "one filter for power users" walking
the default back toward the creator tool. The cap is a hard constraint on the
default, not a tunable default value.

---

## Build order (corrected by recon)

```
Phase 0 — prerequisite (XS)
  └─ Fix digest/generate content-extraction bug (object vs string).
     Pattern already exists: outputText() in lib/agents/flows.ts.

Phase A — Stage 2 only (UNBLOCKED — the active build)
  └─ idea_analysis agent skill (agent_skills row, not hardcoded)
  └─ structured output storage (agent_outputs.content.parsed or new table)
  └─ buildViralHooksBrief(analysis) mapper
  └─ TWO terminals on the same mapper:
       • one-click  → POST /api/orders/create (trusted source: feed/grounded analysis)
       • pre-filled → modal initialValues, user clicks Generate once (pasted URL / topic)
  └─ CTA "Draft my version" → Viral Hooks → Deliverables (existing path)

Phase B — structured signals → digest (UNBLOCKED, but DEFERRED; NOT part of Stage 2)
  └─ Performance Digest skill → JSON signals[]
  └─ runner JSON parse/validate on completion
  └─ daily_digests signals section + MorningDigest.tsx render
  └─ (optional) /api/analytics/generate-briefing → analytics_briefings (dead table today)
  ⚠ Do NOT fold into Stage 2. Stage 2 ships without touching the digest.

PARKED behind data gate 0c (NO-GO)
  └─ Stage 1: competitor_channel_baselines + outlier scoring
  └─ Stage 3: /dashboard/feed
```

The full Sandcastles 40-card browse feed is explicitly NOT being built.

---

## Acceptance checks (theater + scope gates)

- [ ] **Stage 0c verified**: a post-level reach source for competitor channels
      is confirmed BEFORE any baseline code is written.
- [ ] **Stage 0a built**: structured `signals[]` JSON contract emitted + ingest
      path into `daily_digests`. (It did NOT exist; it was spec-only.)
- [ ] **Stage 0b fixed**: `digest/generate` handles object `output.content`
      without `slice is not a function`.
- [ ] Every feed card terminates in a draft action, never a dead-end view.
- [ ] Idea Analysis fields auto-populate Viral Hooks (no re-typing).
- [ ] `belief_to_challenge` references a Foundation-derived customer belief,
      not a generic one.
- [ ] Default feed never exceeds 5 cards and shows no filter panel.
- [ ] Filters appear only after explicit "Show more."
- [ ] Channels without a sufficient baseline are excluded (confidence gate).
- [ ] Outlier findings reach the user via the EXISTING morning digest signal
      path — no parallel briefing system was built.
- [ ] Competitor Watcher was extended; no duplicate competitor agent created.
- [ ] All runs go through `lib/agents/runner.ts` (cost tracked, credits
      deducted). Nothing imports a model SDK directly.
- [ ] Prompts live in `agent_skills`, not hardcoded in routes.

---

## Design tokens (from analytics_v2_spec — confirm against live tokens)

- Primary blue `#3B82F6` (CTAs, Maya-generated left border 4px — Maya content only)
- Success green `#10B981`, warning amber `#F59E0B`, danger red `#EF4444` (sparingly)
- Page bg `#FCFCFC`; card: white, rounded-2xl, `border border-gray-100`, no default shadow
- Canvas: `mx-auto max-w-[1240px] px-8 py-6`
- No pink except Maya avatar. No old orange `#c8522a` anywhere. No emoji.
- 15px minimum body text. Desktop-first.
