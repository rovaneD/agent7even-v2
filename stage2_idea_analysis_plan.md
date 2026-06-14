# Stage 2 — Idea Analysis → Viral Hooks: Implementation Plan

**Status: SHIPPED — June 14, 2026** (`caf79c3` on `main`). Run
`18_idea_analysis_skill.sql` in Supabase if not already applied.

*The only unblocked, active build from the outlier-intelligence work. Stage 1
(outlier scoring) and Stage 3 (feed) are PARKED behind a data-source gate — see
`outlier_intelligence_handoff.md` Reality State. This plan does not touch them.*

**Goal:** turn a piece of content (pasted URL, user topic, or a Maya-grounded
analysis) into a structured `idea_analysis` object, then let the user fire
"Draft my version" → Viral Hooks → Deliverables, with NO re-typing.

---

## READ BEFORE WRITING CODE

1. `git remote -v` → confirm `rovaneD/agent7even-v2`.
2. Source of truth: `MAYA_CONTEXT_V08.md` + `CONTEXTV17.md`. (`MAYA_CONTEXT.md`
   is legacy.)
3. Read the real files, not this plan's summary of them:
   - `lib/services/viralHooks.ts` — `VIRAL_HOOKS_FRAMEWORK`,
     `VIRAL_HOOKS_OUTPUT_MARKER`, `extractViralHooksGeneratedOutput()`.
   - `app/dashboard/services/ServicesClient.tsx` — `ViralHooksGeneratorModal`,
     its 6 fields, `handleSubmit`, `handleRequest`.
   - `app/api/orders/create/route.ts` — sync generation + marker + deliverable.
   - `lib/services/saveViralHooksDeliverable.ts` — Deliverables write.
   - `lib/agents/flows.ts` + `seed-agent-skills.sql` — agent_skills pattern,
     `outputText()` helper (reuse for the digest bug fix).
   - `lib/agents/buildAgentContext.ts` → `loadFoundationContext.ts` — how to
     pull Foundation (`foundation_answers`) for grounding. NOTE: do NOT use
     `competitorContext` from flows.ts for Foundation data — it holds prior
     Competitor Watcher outputs, not Foundation competitors.
4. If the real files contradict this plan, the files win. Report and stop.

---

## Phase 0 — prerequisite fix (XS, do first)

`app/api/digest/generate/route.ts` throws `slice is not a function` when
`output.content` is `{ raw: string }` (an object) rather than a string.

- Lines ~56–57 cast `o.content` as string; `executeAgentRun.ts` (~line 145)
  stores `{ raw: string }`.
- Lines ~86 and ~117 call `.slice()` on it → TypeError.

Fix: extract text before slicing, mirroring `outputText()` in `flows.ts`:
```ts
const text = typeof c === 'string' ? c : (c?.raw ?? '')
```
One helper, two call sites. Do this first because Phase A stores structured
output through related paths and you don't want to build on a route that throws.

---

## Phase A — Stage 2 build

### A1. The `idea_analysis` agent skill (agent_skills row — NOT hardcoded)

Add a skill row following the existing `seed-agent-skills.sql` pattern. Output
is strict JSON (validate on completion in the runner):

```
idea_analysis {
  topic
  idea_seed
  unique_angle
  belief_to_challenge     // MUST be a belief held by THIS SMB's customers
  contrarian_reality
  supporting_evidence[]   // 3 concrete directions
  source_ref              // pasted_url | user_topic | (later) outlier_id
}
```

**Foundation grounding is the differentiator.** `belief_to_challenge` and
`unique_angle` must be derived from `foundation_answers` (ideal customer,
positioning), not generic content-creator beliefs. Pull Foundation via
`buildAgentContext` / `loadFoundationContext`. This is what Sandcastles
structurally cannot do.

Run through `lib/agents/runner.ts` — cost tracked, credits deducted. Never
import a model SDK directly.

### A2. Structured output storage

Store the parsed object so the renderer and the brief mapper can both read it:
- Simplest: `agent_outputs.content.parsed` (JSON) alongside the existing
  markdown. Confirm `executeAgentRun` can persist a parsed field without
  breaking existing markdown consumers.
- If that's lossy, a small `idea_analyses` table keyed by `account_id`
  (tenant-scoped from `auth()`, never from request body).

### A3. `buildViralHooksBrief(analysis)` mapper — the shared core

One function in `lib/services/viralHooks.ts` maps `idea_analysis` →
the Viral Hooks brief string. Field mapping:

| idea_analysis | Viral Hooks field |
|---|---|
| `topic` / `idea_seed` | topic |
| Foundation ideal_customer (or analysis audience) | audience |
| derived CTA intent | goal |
| source platform (Reel / TikTok / …) | format |
| brand voice default (Foundation) | tone |
| `belief_to_challenge` + `contrarian_reality` + `supporting_evidence[]` | notes |

This mapper is the single source of truth for BOTH wires below. Build it once.

### A4. Two terminals on the mapper (build both — same core, different last step)

The two paths exist because the *source* differs in trust level:

**Wire 1 — one-click (trusted source: grounded analysis / future feed card)**
- `buildViralHooksBrief(analysis)` → append `VIRAL_HOOKS_FRAMEWORK` →
  POST `/api/orders/create` directly. No modal.
- User lands on the generated order in Services. Zero re-type.
- Use when Maya already grounded the analysis in Foundation — re-typing would
  be pure friction.

**Wire 2 — pre-filled modal (less-certain source: pasted URL / user topic)**
- Open `ViralHooksGeneratorModal` with a new `initialValues?: Partial<…>` prop;
  set the 6 fields on mount from the mapped analysis.
- User glances, optionally adjusts, clicks Generate once.
- Use when the source is user-supplied and a human check is worth one click.

Both call the SAME `buildViralHooksBrief`. The divergence is only the terminal:
direct POST vs. populate `initialValues`. Do not fork the mapper.

### A5. The "Draft my version" CTA (theater gate)

Wherever an `idea_analysis` is rendered, the primary button is **"Draft my
version"**, wired live:
- trusted context → Wire 1
- user-supplied context → Wire 2

**HARD GATE:** the analysis fields must FLOW into the generator. A rendered
analysis card with no live connection to Viral Hooks is performance theater and
fails acceptance. The fields auto-populate; the user never re-types them.

---

## Acceptance checks (Stage 2)

- [x] Phase 0 digest bug fixed; `digest/generate` handles object `content`.
- [x] `idea_analysis` skill lives in `agent_skills`, emits validated JSON.
- [x] `belief_to_challenge` references a Foundation-derived customer belief,
      not a generic one.
- [x] `buildViralHooksBrief()` is the single mapper feeding both wires.
- [x] Wire 1 (one-click) POSTs a complete brief; no modal, no re-type.
- [x] Wire 2 (pre-filled modal) populates all 6 fields from the analysis.
- [x] "Draft my version" terminates in a generated Viral Hooks order →
      Deliverables (existing path), never a dead-end card.
- [x] All runs go through `lib/agents/runner.ts`. No direct SDK imports.
- [x] Tenant scope (`account_id`) derived from `auth()`, never request body.
- [x] No `competitor_channel_baselines`, no `/dashboard/feed`, no outlier
      scoring touched — those are parked.

---

## Explicitly OUT of scope for this slice

- Outlier scoring / baselines (Stage 1 — parked behind data gate).
- `/dashboard/feed` (Stage 3 — parked).
- Structured digest signals (Phase B — unblocked but deferred; do NOT fold in).
- Any competitor reach fetching. Stage 2 needs none of it.
