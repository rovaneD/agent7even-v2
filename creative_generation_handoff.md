# Creative Generation Handoff — Image Generation (v1)
*Maya generates the visual, grounded in Foundation — first expression of the hard-floor gate*

**Status:** **v1 shipped** (`634c53a`, June 20, 2026). **v1.1 shipped** (`f300349`, June 21, 2026) — Assets library, session/edit/download, brief QA hardening. See §13 and `CONTEXTV19.md`.
**Sits downstream of:** `foundation_intelligence_vision.md` (June 19, 2026) — read it first.
**Supersedes one line in:** `post_media_expansion_handoff.md` — image generation was an
explicit non-goal there (§0, §10, §11). **This document changes that.** Generation is now
in scope as a separate, gated capability. The post-media non-goal language for generation is
retired; everything else in that handoff stands.
**Technical baseline:** `CONTEXTV19.md` (latest), `CONTEXTV18.md`, `CONTEXTV15.md` §2 (image-context v1).
**Product rules:** `MAYA_CONTEXT_V10.md` (latest) / `MAYA_CONTEXT_V09.md` for non-generation rules.

Read `foundation_intelligence_vision.md`, `MAYA_CONTEXT_V06.md`, `CONTEXTV15.md`, and
`post_media_expansion_handoff.md` §1–2 before any code.
Confirm `git remote -v` shows **`agent7even-v2`**, NEVER `agent7even-app`.

---

## 0. What the spike proved (do not re-litigate)

Spike: `spikes/foundation-creative-ab/`. Decided rubric before viewing results. Real
Foundation, real models, A/B vs shallow URL extraction.

| Finding | Verdict | Consequence for this build |
|---------|---------|----------------------------|
| Foundation-grounded briefs beat shallow extraction | **3/3** | The differentiator is real and is the thing to build |
| Image generation capability | **CONDITIONAL GO** | Ship — but text QA is a hard gate (below) |
| Text inside generated images (typos, wrong brand) | **Blocks auto-post** | Human review mandatory; QA gate before queue |
| Video generation | **NO-GO** | Model quality ceiling — not a Maya gap. Recheck when models improve. Out of scope here. |

**The core thesis the spike validated:** Maya's value is **not** running an image model — that
is commodity. The value is **translating Foundation + user assets into the structured model
input** (reference + scene direction + format) the model needs. The brief composition is the
product. The model call is a dependency. Build the composition; buy the model (OpenRouter,
per build/buy discipline).

---

## 1. Architecture decision — generation is a PRE-QUEUE COMPOSE STEP (settled)

Verified against the live repo (2026-06-19). The decision is not open:

**The approval queue is a flat disposition surface.** Items enter already resolved, as
`agent_outputs.status = 'pending_approval'`, with the parent `agent_tasks.status = 'completed'`
and `approved_at` / `rejected_at` both null. There is **no** `draft` / `generating` / `ready`
state on the approval path (no DB enum; values are app-enforced: `pending_approval` | `approved`
| `rejected`). The queue surfaces completed, unreviewed work for a human yes/no. It does not hold
in-progress items.

**Therefore generation cannot be a multi-state queue item.** The compose work
(brief → options → pick → QA) happens **during the agent run**, before insert. Only one
QA-passed, user-picked candidate is inserted into `agent_outputs`, at `pending_approval`. The
existing approve/reject path is unchanged and needs no modification.

```
AGENT RUN (the compose step — all of this is "running", pre-queue)
  Foundation-strength gate (server-enforced — §3)
    → compose grounded brief from Foundation + user assets
      → model call: generate 3 options
        → user picks 1
          → TEXT-QA GATE (§2c) — fail → regenerate or surface error; NEVER inserts
            → caption composed with chosen image in context (§2d)
  ── run completes ──
        │
        ▼
  agent_outputs INSERT  status = 'pending_approval'   ← one clean item enters the queue
  agent_tasks   UPDATE  status = 'completed'
        │
        ▼
  EXISTING APPROVAL FLOW (unchanged): approve / reject → optional Zernio publish
```

**Why this is the right build, not just the cheap one:** it matches the Foundation Intelligence
vision's governing principle — the queue is the universal "Maya proposes, user disposes" surface,
and you do not compose inside a disposition surface. A QA-failed generation must never reach the
queue (it would be noise in a surface meant for decisions). Pre-queue compose is the only build
where the QA gate has a natural enforcement point.

---

## 2. Feature spec — image generation v1

### 2a. Where it lives
Inside the **content/posting flow** (Option A), not a standalone creative studio. A standalone
studio recenters the product on model-running (the commodity) and contradicts the maestro
framing in the vision doc ("Foundation-as-intelligence is the product; agents are how it acts").
Generation is an expression of the intelligence in service of shipping a post — not a separate
capability surface. Revisit a dedicated asset surface only if cross-post asset reuse becomes a
real, validated user need (post-v1 widening, not a v1 decision).

### 2b. The flow (brief → 3 options → pick → QA → approval → publish)

| Step | What happens | Notes |
|------|--------------|-------|
| Gate | Foundation-strength check (§3) | Server-enforced. Block is specific + actionable. |
| Brief | Maya composes a grounded brief from Foundation (Voice + Position + Customer) + any user-supplied reference/scene direction | This is the differentiator. Reuses the brief-composition pattern proven in the spike. |
| Generate | Model returns **3 options** | OpenRouter (Gemini image models per CONTEXTV stack). 3 is the spike default — tune. |
| Pick | User selects 1 | Selection is a compose action, correctly **before** the queue. |
| QA gate | Automated text-QA on the picked image (§2c) | Fail → regenerate or error. Never inserts a failed image. |
| Caption | Caption composed **with the chosen image in context** (§2d) | Converges generation with the image-context caption loop. |
| Insert | One `agent_outputs` row, `pending_approval` | Media in `content` jsonb — no schema change (§2e). |
| Approve | Existing human approve/reject | Unchanged. |
| Publish | Existing `publishApprovedOutput` → Zernio | Unchanged. Gated on Zernio Q4 for live client accounts. |

### 2c. The text-QA gate (the spike's blocker — non-negotiable)
The spike's CONDITIONAL was conditional on **this**. Generated images fail on text: typos,
garbled words, wrong brand name baked into the image. This blocks auto-post. The gate:

- Runs on the **user-picked** candidate, inside the agent run, **before** insert.
- Checks generated text against: known brand name(s) from Foundation, basic spelling/garble
  detection, presence of unintended text artifacts.
- **Implementation options to reconcile at build:** (a) vision-model read-back of the generated
  image asking "transcribe any text; flag misspellings or non-dictionary words" then compare to
  Foundation brand tokens; (b) OCR pass + dictionary/brand check. Prefer (a) — the vision
  pattern already exists (`lib/agents/visionCaption.ts`, `foundation/ingest`) and avoids new OCR infra.
- **On fail:** regenerate (bounded retries, e.g. 2) or surface a specific compose-step error.
  A QA-failed image is **never** inserted to `agent_outputs`. It does not reach the queue.
- This gate is **why human review stays mandatory** even after automated QA — QA reduces, does
  not eliminate, text risk. Approval queue is the backstop. Do not enable any auto-post path for
  generated images in v1.

### 2d. Caption-with-image-in-context (convergence point)
Generation and the caption-blind-publishing problem are the **same wiring**. v1 image-context
captions already let Maya read an attached image and write a matching caption
(`image_caption_mode` flag, `media_storage_path` in `content` jsonb). Generation produces the
image, then the caption is composed **with that image in context** in the same compose step.
This closes the caption-blind gap for generated posts at no extra architectural cost — the
vision read-back from the QA gate can feed caption composition. Name this convergence explicitly
so it isn't built as two separate jobs.

### 2e. Schema — NO new table, NO new column
Generated image reuses the existing media path (confirmed against live repo + 
`post_media_expansion_handoff.md` §1):

```json
// agent_outputs.content jsonb
{
  "raw": "...caption text...",
  "media_storage_path": "post-assets/{profileId}/uuid-file.jpg",
  "media_mime": "image/jpeg",
  "image_caption_mode": true,
  "generated": {
    "model": "gemini-...",
    "brief_id": "...",
    "options_count": 3,
    "picked_index": 1,
    "qa_passed": true,
    "qa_method": "vision_readback"
  }
}
```
`generated` is optional metadata for analytics/debug/learning-signal — not required for publish.
Approval preview already resolves signed URLs from `media_storage_path` server-side
(`approvals/page.tsx`) — generated images render in the existing preview with zero approval-side work.

### 2f. Credits
New line item via `deductCredits()` (never direct SDK). Generation is a distinct, heavier action
than vision captioning.

**The number is NOT empirically grounded yet.** `lib/agents/cost.ts` already defines
`CREDIT_COST = { light: 2, standard: 8, deep: 25 }`. Today `deep` (25) is used for orchestrations
with 5+ subagents — it is the right *tier slot* for a heavy compose run, but 25 was not derived
from image cost. The spike (`spikes/foundation-creative-ab/run.ts`) does not log per-image
OpenRouter cost (it downloads PNGs; only video tracked `usage.cost`), so there is no in-repo number
to anchor against. **Reuse the existing Deep constant as the slot; calibrate the real number from a
logged staging run before enabling the flag.**

**Bill as ONE bundled charge, not two.** Per the convergence point in §2d, generation and
caption-with-image are the **same compose run** — one `deductCredits()` call, one ledger line.
Do NOT wire a separate `+8` caption charge on top of the generation charge; that double-charges the
same run. If caption is ever split into its own `executeAgentRun`, it gets its own line — but v1
convergence is one run, one charge.

| Action | Tier slot | Credits | Note |
|--------|-----------|---------|------|
| Image generation bundle (brief + 3 options + QA + caption, one run) | Deep | 25 | Existing constant. **Calibrate from logged OpenRouter `usage.cost` before flag-on.** Consider a dedicated `GENERATION_CREDIT_COST` constant if the bundle cost diverges from generic Deep. |
| Social publish (any media) | Flat | 1 | Unchanged |

Cost shape (for calibration): 1 brief compose (text, pennies) + **3× Gemini image calls (dominant
cost)** + 1 QA vision read-back (~Standard-equivalent) + caption (folded into the same run). The
3-options default is the main cost lever — drop to 2 if cost/quality allows.

---

## 3. The Foundation-strength gate (hard floor — lifted from the vision doc)

Per `foundation_intelligence_vision.md` §"Generation is the hard-floor exception." Generation is
the **first implementation** of the relevance gradient's hard floor. A bad reel/image is not
"preview quality the user can edit" — it is embarrassing and worse than nothing. The floor:

- **Empirical, not hardcoded.** Calibrate during build: generate across Foundations of varying
  strength, find where output quality drops, set the floor there. Do not guess a number.
- **Per-relevant-section, not global.** Gate on **Voice + Position + Customer**, not overall
  Foundation score. A user can be 80 overall with weak Voice — and Voice is what makes creative
  output on-brand. Global score would let weak-Voice users through.
- **Server-enforced.** The generation route checks section strength server-side. Not UI-hidden.
  A determined user cannot bypass via direct API call.
- **Specific + actionable on block.** Not "improve your Foundation." Instead:
  *"Generation needs a stronger Voice profile. Your Voice is at 45% — strengthen it here →
  [Intelligence tab, Voice section]."* Route directly to the section editor.
- **Applies even in trial.** Trial is otherwise deliberately ungated explore mode (preview
  quality). Generation is the exception — the floor holds in trial too, because a bad generated
  asset is worse than no asset, and "preview quality" framing doesn't apply to images that get
  published.

### 3a. Prerequisite — the per-section server read is NET-NEW (do not assume it exists)

Verified against the live repo (2026-06-19). **Field-level scoring exists; the section-level
server read for gate enforcement does NOT.** Do not treat this as done.

| Layer | Status |
|-------|--------|
| Per-field scores in DB (`foundation_field_scores`: `field_key`, `score`, `feedback`) | **Exists** — written by `POST /api/foundation/score` |
| Server-side field-score read | **Exists** — `foundation/page.tsx` loads them for the hub |
| Per-section aggregate (Voice / Position / Customer) | **Client-only** — `sectionScore()` in `FoundationHub.tsx` |
| **Server util for gate checks** | **DOES NOT EXIST — this is the prerequisite build** |

**Minimum prerequisite build (this is §9 step 1 — net-new, ~half a day):**
```
lib/foundation/sections.ts          // NEW — single source of truth for section→field mapping
lib/foundation/sectionStrength.ts
  - loadFieldScores(profileId)                  // from foundation_field_scores
  - getSectionScore('customer'|'position'|'voice')  // uses sections.ts keyFields
  - assertGenerationFloor(profileId)
      → { ok: true }
      | { blocked: true, section, score, route, message }   // message uses field_key + feedback from DB
```

Refactor `FoundationHub.tsx` to import section keyFields from `lib/foundation/sections.ts` so
the hub score and the gate score **cannot drift**.

**Empty/stale score behavior (gate MUST define this):**
- **No `foundation_field_scores` rows** (user completed Foundation but never re-scored): the UI
  falls back to a fill-check (`sectionHealth`), not scores. The gate must pick one: block with
  *"Re-score your Foundation before generating"* (cheap, recommended) vs. compute scores on the fly
  (expensive — a scoring run inside the gate). **Recommend block-and-route-to-rescore**; do not run
  scoring synchronously inside the generation gate.
- **Stale scores after edits** (scores exist but predate recent Foundation edits): acceptable for
  v1 — gate on last-known scores. Note the staleness; do not block on it.

### 3b. Section field mapping — v1 decision (settled)

Other scored fields (`transformation`, `customerTriedBefore`, `customerBuyingTrigger`,
`neverSoundLike`, `differentiatorOwn`) exist in `foundation_field_scores` but are **not** in the
current Foundation hub section averages. Widening the gate without updating the hub would produce
block messages that disagree with what the user sees ("Voice 62% in hub, blocked at 45%").

**v1 rule: gate uses the exact same section→field mapping as the hub — no widening.**

Extract once to `lib/foundation/sections.ts`:

| Section | `keyFields` (v1) |
|---------|------------------|
| **Customer** | `customerWho`, `customerFrustration` |
| **Position** | `differentiator`, `competitors` |
| **Voice** | `toneTraits`, `brandsAdmired` |

Section score = average of scored fields present in `foundation_field_scores` for that section
(same algorithm as `sectionScore()` in `FoundationHub.tsx` today).

**Not in the gate floor, but still in the brief:** `neverSoundLike`, `transformation`, and other
Foundation answers feed brief composition regardless — thin inputs produce weaker briefs, but the
hard floor only blocks on the three hub-visible section scores above.

**Post-v1 (Foundation Intelligence):** revisit widening Voice to include `neverSoundLike` and
Customer to include `transformation` — but only when the hub section definitions change globally,
not gate-only.

### 3c. Calibration depends on scores existing
The empirical floor (§3 intro) can only be calibrated across users who **have** scores. Calibration
set = Foundations with populated `foundation_field_scores`. Users without scores are handled by the
empty-score rule above, not by the floor threshold.

This gate is the seam where this handoff touches the Foundation Intelligence build. The relevance
gradient (vision doc §"Build Sequence" item 5) starts here and expands to other agents later.

---

## 4. The relevance gradient connection

Generation is the **hard-floor end** of the gradient described in `foundation_intelligence_vision.md`.
Most agents degrade *gracefully* on thin Foundation (more generic output, Maya says so). Generation
does **not** degrade gracefully — it gates. This is deliberate and is the defining example of why
the gradient is per-agent, not a single global rule:

- Identity-dependent + high-stakes-output (generation): **hard floor**, server-enforced.
- Identity-dependent + editable-output (content writing): **graceful degradation** + visible dial.
- Identity-independent (competitor watcher, trend spotter): **no floor**, run regardless.

The generation gate is the proof-of-concept for the whole gradient. Build it here; generalize it
into the per-agent dependency model afterward.

---

## 5. The 100-video format library — Meaning 1 (future enhancement, not v1)

Per the vision doc and prior scoping: the 100-viral-video library is **Meaning 1** — distilled
**format patterns** Maya composes briefs from, stored in the `agent_skills` / `prompt_library`
architecture. It is **prompt composition, not model fine-tuning** (see §7).

- It enhances **Agent 1's (the brief-composer's) output quality** — richer, format-aware briefs.
- It feeds the **Observer's** brief-composition capability (vision doc §"Connection"); the
  Guardian's job does not change.
- It is a **future enhancement** to brief quality, not part of image-gen v1. v1 ships with
  Foundation-grounded briefs alone (already proven sufficient in the spike). The library makes
  good briefs better; it is not a prerequisite.

Do not build the library into v1. Note the integration point (brief composition) and move on.

---

## 6. Video NO-GO — recorded decision

Video generation is **NO-GO**, recorded, with a specific reason: **model quality ceiling, not a
Maya capability gap.** Maya's brief-composition would work for video; the models can't yet render
acceptable output. This is a **dependency limitation**, so:

- Do not build video generation in v1.
- Do not treat NO-GO as permanent — it is **recheck-when-models-improve**, not abandoned.
- The translation-layer thesis (Foundation → structured input) applies identically to video the
  day models clear the bar. The architecture here (pre-queue compose, hard-floor gate, QA gate)
  extends to video generation unchanged when revisited.
- Video **publishing** (user-supplied video) is a separate, live track — see
  `post_media_expansion_handoff.md` Phase C. Not affected by this NO-GO.

---

## 7. What NOT to build (guardrails against the obvious wrong moves)

- **Not a standalone creative studio.** Generation lives in the posting flow. A studio recenters
  on the commodity (model-running) and adds surface area before the core loop is proven.
- **Not a multi-state queue item.** The queue is flat disposition. Compose pre-queue; insert one
  resolved candidate. Do not add `draft`/`generating` states to the approval path.
- **Not auto-post of generated images.** Human approval mandatory in v1. QA gate reduces text
  risk; it does not eliminate it. No autonomy ramp to Auto for generation in v1.
- **Not model fine-tuning.** Learning is prompt-composition + retrieval (vision doc §"What This
  Is Not"). No training, no ML infra. On-architecture with `agent_skills` / `prompt_library`.
- **Not a global Foundation-score gate.** Per-section (Voice + Position + Customer). Global score
  lets weak-Voice users produce off-brand visuals.
- **Not a new media table or column.** Reuse `agent_outputs.content` jsonb. The media path is
  already wired through approval preview and publish.
- **Not generation that bypasses the ledger or calls the model SDK directly.** Through the runner
  + `deductCredits()` only.
- **Not building the 100-video library into v1.** Note the brief-composition integration point;
  ship Foundation-grounded briefs alone (spike-proven sufficient).
- **Not live client publish before Zernio DPA confirmation.** Test accounts only, same gate as all publishing (`CONTEXTV22.md` §8).

---

## 8. Connection to the Foundation Intelligence vision

Generation is the **first concrete expression of the hard-floor gate** from
`foundation_intelligence_vision.md`. The vision is mostly about Foundation *learning* (Observer +
Guardian, accreting layers). This handoff is the first place the vision's **relevance gradient**
becomes real code — specifically its hard-floor exception. Sequencing:

- This handoff can ship **before** the full Observer/Guardian learning loop. It needs only the
  Foundation-strength *read* (per-section scoring), not the *write* path (proposals/layers) which
  is the larger Foundation Intelligence build. **Caveat (see §3a):** the per-section *server* read
  is itself net-new — field-level scores exist, but the section-level server util for gate
  enforcement does not. That util (`lib/foundation/sectionStrength.ts` + `sections.ts`) is the
  real prerequisite and is §9 step 1. It is small (~half a day), but it is not done.
- When the learning loop ships, generation outcomes (which options users pick, which get approved,
  which get edited) become **Observer signal** — feeding richer future briefs. That is the
  bidirectional loop, but it is a later enrichment, not a v1 dependency.
- The QA gate and the hard floor are the two patterns this build contributes back to the broader
  vision: a server-enforced quality floor, and a never-auto-insert quality check. Both generalize.

---

## 9. Build order (v1)

**Status:** Steps 1–9 shipped June 20 (`634c53a`). v1.1 extensions June 21 (`f300349`) — see §13.

```
1. **Foundation-strength server read — NET-NEW, prerequisite.** Build
   `lib/foundation/sections.ts` (shared keyFields) +
   `lib/foundation/sectionStrength.ts` (`loadFieldScores` + `getSectionScore(customer|position|
   voice)` + `assertGenerationFloor(profileId)`). Refactor `FoundationHub.tsx` to import
   keyFields from sections.ts. Define empty-score behavior (block + route to re-score, per §3a).
   Section mapping per §3b — no widening. This does not exist today.
2. Generation route — gate check → brief compose → model call (3 options) → return options
3. Pick UI (in posting flow) — select 1 of 3
4. Text-QA gate — vision read-back on picked image → pass/regenerate/error
5. Caption-with-image-in-context — reuse visionCaption pattern
6. Insert one resolved candidate to agent_outputs (pending_approval) — verify it lands in
   existing approval queue with correct preview
7. One bundled credit ledger line (Deep tier slot) via single deductCredits() call
8. Calibrate the empirical floor (generate across Foundation strengths; set threshold)
9. Feature flag: NEXT_PUBLIC_IMAGE_GENERATION
```

Each step verified against live files before writing (diagnose-before-fix). Ship behind flag.

---

## 10. Verification gates (must pass before enabling)

- Weak-Voice Foundation (below floor) → generation **blocked server-side** with the specific
  actionable message + correct route. Direct API call also blocked.
- Strong Foundation → 3 grounded options returned; options reflect Voice/Position/Customer, not
  generic stock-style output (the spike's A/B difference must be visible).
- Generated image with deliberate bad text → **QA gate catches it**, image does not reach queue.
- QA-passed pick → lands in approval queue as one `pending_approval` item with image preview
  rendering from `media_storage_path`.
- Caption references what's actually in the generated image (not brief-only).
- **One** `credit_ledger` row after the bundled compose run (Deep tier slot, correct `profile_id` + task).
- Approve → existing publish path → Zernio test account draft matches preview.
- Text-only and user-uploaded-image paths (v1 image-context) still work unchanged.

---

## 11. Session checklist for implementing agent

1. Read `foundation_intelligence_vision.md`, `MAYA_CONTEXT_V06.md`, `CONTEXTV15.md`, this file
2. `git remote -v` → `agent7even-v2`
3. Reconcile every signature against live files (runner.ts insert paths, content jsonb shape,
   approvals page preview, deductCredits) — do not trust this doc over the code
4. **Build the per-section server read first** (`lib/foundation/sections.ts` +
   `lib/foundation/sectionStrength.ts`) — net-new, NOT a confirm-it-exists step. Field scores
   exist in `foundation_field_scores`; section-level server util does not. Mapping per §3b;
   empty/stale behavior per §3a.
5. Build the gate first — nothing generates until the floor is enforced
6. One step at a time per §9; commit before the next
7. `npx tsc --noEmit` + manual flow (block case, QA-fail case, happy path) before push
8. Do not update marketing site until gates pass on staging

---

## 12. Parked — unrelated bugs (NOT this build, but you'll encounter them)

These are real but out of scope for generation. Capture, do not fix inline:

- **Admin per-field display likely broken.** `app/admin/clients/[id]/page.tsx` selects
  `field_name`, but the column is `field_key`. You may hit this while testing Foundation scores in
  admin. Separate fix.
- **Stale digest query.** `app/api/digest/generate/route.ts` filters pending approvals with
  `agent_tasks.status = 'approval_required'`, a value never written to `agent_tasks.status`
  (review state lives in `approved_at` / `rejected_at`). That query returns empty permanently.
  Unrelated to generation — generation items land correctly via the existing approvals query
  regardless. Backlog the digest fix separately.

---

## 13. v1.1 addendum — shipped June 21, 2026 (`f300349`)

Extends v1 without changing the pre-queue compose architecture (§1) or approval insert shape (§2e).

| Area | Shipped |
|------|---------|
| **Assets library** | `/dashboard/assets` — save options, folders, preview, delete, use-for-post |
| **Session persistence** | Client session survives Agents ↔ Assets until discard/submit |
| **Edit** | Fix text only (Recraft) / Change visual (img2img); `edit-option` API |
| **Download** | Picker, Assets, Posts |
| **Brief safety** | `briefValidation.ts` — no hex/token/font specs in briefs; Photoreal infographics replaced |
| **Post-gen QA** | Vision QA on all 3 options before UI; auto-regen once per fail |
| **Provider errors** | `sanitizeProviderError.ts` — no raw OpenRouter text in UI |

**SQL (Supabase):** `19_creative_assets.sql`, `20_creative_assets_extend.sql`, `21_creative_asset_folders.sql`

**Full file map + API list:** `CONTEXTV19.md`

**Still gated:** ~~Production enablement~~ — flag **ON** in Production as of June 22, 2026. Real publish still gated on Zernio DPA.

---

*Creative Generation Handoff v1 — June 19, 2026; v1.1 addendum June 21, 2026.*
*Downstream of Foundation Intelligence Vision. Supersedes the image-generation non-goal in
post_media_expansion_handoff.md. Video generation NO-GO recorded, recheck-when-models-improve.*
