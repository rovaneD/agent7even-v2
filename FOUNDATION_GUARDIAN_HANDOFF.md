# Foundation Guardian v0 — Build Handoff
*Build Sequence item 2 · July 2026*

Read `foundation_intelligence_vision.md` and `32_foundation_changelog.sql` before starting.
Confirm `git remote -v` shows `rovaneD/agent7even-v2`.

**Prerequisite:** Observer v0.5 live — changelog writes (v0) and reads back into agents + Maya (v0.5).

---

## Purpose

Guardian is the **verification agent**. It receives **candidate proposals** from Observer (formalized patterns), checks each against **Phase 1 only**, assigns a state, and decides what may reach the user.

Guardian does **not** learn from Observer observations. Its reference frame updates **only** when the user approves a surfaced proposal (future proposal UI).

No user-facing UI in v0 — batch job + verify script + stored proposal rows.

---

## What Guardian is NOT

- Not a second copy of Observer
- Not allowed to rewrite Phase 1
- Not a chat surface
- Not performance analytics (Zernio / EnsembleData) — decision-signal only for v0

---

## Inputs

| Source | Content |
|--------|---------|
| `foundation_changelog` | Recent rows per workspace profile (Observer summaries) |
| `profiles.foundation_answers` + `foundation_documents` | Phase 1 bedrock (read-only for Guardian) |
| Formalization output | Structured candidate proposals from Observer step 1b (not built yet) |

**v0 shortcut:** Guardian v0 can operate on **batched changelog clusters** formalized by a single Guardian-prep prompt until Observer formalization ships. Do not skip verification logic — only shorten the upstream formalization path.

---

## Outputs

New table: `foundation_proposals` (name TBD — use in migration `33_foundation_proposals.sql`)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| profile_id | uuid | FK profiles |
| state | text | `consistent` \| `extending` \| `contradicting` |
| guardian_verdict | text | `surface` \| `hold` \| `reject_internal` |
| proposal_title | text | Short user-facing headline (future UI) |
| proposal_body | text | 2–4 sentences, plain language |
| phase1_excerpt | text | Quote/snippet Guardian checked against |
| signal_summary | text | Observer cluster that generated this |
| source_changelog_ids | uuid[] | Row ids |
| created_at | timestamptz | |

RLS: same pattern as `foundation_changelog` — tenant SELECT, service-role writes.

---

## The three Guardian states (from vision)

1. **Consistent** — proposal restates or sharpens Phase 1 with new evidence from decisions. Low friction → may surface.
2. **Extending** — adds nuance Phase 1 did not say but does not conflict (e.g. "user consistently softens CTAs" when Phase 1 says direct). Medium friction → surface with clear "extends your Foundation" label.
3. **Contradicting** — conflicts with Phase 1 (e.g. Phase 1 says premium positioning; pattern says discount-heavy). **Never surface silently.** Hold or require explicit user Phase 1 edit first.

**Threshold filter (v0 defaults — tune after human review):**

| State | Default verdict |
|-------|-----------------|
| consistent + ≥3 supporting changelog rows same theme | surface |
| extending + ≥4 supporting rows | surface |
| contradicting | hold (log only) |
| any state + <3 rows | reject_internal (noise) |

---

## Agent isolation (non-negotiable)

```
Observer prompt  → reads changelog + outputs, formalizes candidates
Guardian prompt  → reads Phase 1 + candidates ONLY (never Observer's raw reasoning chain)
User (later)     → approves/rejects surfaced proposals → creates layers
```

Separate system prompts. Separate model calls. Guardian must not receive Observer's full scratch work — only structured candidate JSON.

---

## Candidate schema (Observer → Guardian wire format)

```json
{
  "theme": "cta_softening",
  "statement": "User consistently changes CTAs from hard sell to learn-more language.",
  "supporting_summaries": ["...", "..."],
  "suggested_layer_hint": "Prefer educational CTAs in social and email.",
  "changelog_ids": ["uuid", "uuid"]
}
```

---

## Build steps (ordered)

### Step 1 — Schema
- `33_foundation_proposals.sql` as above
- Verify script: `scripts/verify-foundation-guardian.ts` (lists proposals + states for a profile)

### Step 2 — Guardian runner (no UI)
- `lib/foundation/guardian/runGuardianBatch.ts`
- Loads Phase 1 markdown bundle
- Loads formalized candidates (from Step 3 or manual fixture for first test)
- One LLM call per candidate with **Guardian-only** system prompt
- Persists rows with verdict

### Step 3 — Observer formalization (1b — can follow Guardian v0)
- `lib/foundation/observer/formalizeCandidates.ts`
- Clusters changelog by theme (embedding or rule-based v0: same agent + keyword overlap)
- Emits candidate JSON array
- Cron or on-demand: after N new changelog rows since last formalization

### Step 4 — Human checkpoint
- Run on Agent7even profile with real changelog
- Read proposals: do they feel like real business evolution or noise?
- Tune thresholds in config file — not hardcoded in prompt

---

## Guardian system prompt (outline)

- You are Foundation Guardian. Phase 1 is the only anchor.
- For each candidate: assign state (consistent | extending | contradicting).
- Assign verdict (surface | hold | reject_internal) using threshold rules.
- Output JSON only: `{ state, verdict, proposal_title, proposal_body, phase1_excerpt, rationale }`.
- Never propose silent Foundation edits. Never merge Observer speculation into Phase 1.

---

## Connection to proposal surface (Build Sequence item 3 — out of scope here)

Surfaced rows (`guardian_verdict = surface`) feed a future Approvals-like UI: Approve → creates `foundation_layers` row (item 4). Reject → cooldown signal back to Observer.

---

## Verification checklist

- [ ] Guardian run with empty changelog → 0 proposals
- [ ] Guardian run with 1 reject row → reject_internal (below threshold)
- [ ] Guardian run with 5+ CTA-edit rows → extending proposal, surface if Phase 1 allows
- [ ] Contradicting candidate never gets `surface`
- [ ] Phase 1 text unchanged after Guardian run
- [ ] Verify script prints readable proposal list

---

## Cross-refs

| Doc | Role |
|-----|------|
| `foundation_intelligence_vision.md` | Vision + dual-agent architecture |
| `32_foundation_changelog.sql` | Observer write table |
| `lib/foundation/changelogContext.ts` | Observer v0.5 read path |
| `FOUNDATION_V2_MEMORY_UPLOADS_HANDOFF.md` | Depth / Blaze-class intake (parallel track) |

*Guardian handoff — July 2026. Build after Observer v0.5 checkpoint passes on real summaries.*
