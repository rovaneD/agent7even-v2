# Step 2 Handoff — Translation layer (Creative Direction object)
*Maps `FOUNDATION_CREATIVE_DIRECTION_PLAN.md` Step 2 to live code — June 22, 2026*

**Goal:** Build `lib/agents/foundationCreativeDirection.ts` — one LLM call that
reads Foundation (answers primary, documents enrich, scores for weakSignals) and
returns a validated `CreativeDirection` JSON object.

**Critical rule:** Do **not** wire this into `briefCompose.ts`, `briefComposeVideo.ts`,
or any API route until the isolation checkpoint passes on your own Foundation.

**The checkpoint:** Run the verify script against the Agent7even profile. Read the
output. If it sounds like your business, proceed to Step 3. If generic, fix Foundation
data (including Step 1 visual fields) — not the pipeline.

---

## Inputs today (live code)

| Source | Loader | Used how |
|--------|--------|----------|
| `profiles.foundation_answers` | `loadFoundationContext()` | All keys → strings; arrays joined CSV |
| `foundation_documents` (5 types) | same | Enrichment only — append trimmed excerpts |
| `foundation_field_scores` | `loadFieldScores()` in `sectionStrength.ts` | Build `weakSignals` for sections 70–85 |
| Brand Kit | **Not in v1** | Optional later; Step 2 uses Foundation only |
| Post form | **Not in v1** | Per-post context stays in composers (Step 3) |

**Important:** `loadFoundationContext` comment says "Documents are canonical."
For translation, invert priority in the **prompt**, not the loader:

1. Structured **answers** block first (including Step 1 visual keys)
2. **Documents** block labeled "enrichment — do not override explicit answers"
3. **Field scores** block for weakSignals only

---

## Output spec — `CreativeDirection`

Create `lib/agents/foundationCreativeDirection/types.ts` (or inline in module):

```typescript
export interface CreativeDirection {
  voiceProfile: {
    toneDo: string[]
    toneDont: string[]
    voiceSummary: string
  }
  customerPain: string
  headlineAngles: string[]
  product: {
    category: string
    keyNouns: string[]
    mustNotDepict: string[]
  }
  visualDirection: {
    aesthetic: string
    lighting: string
    casting: string
    paletteWords: string[]
    forbiddenVisuals: string[]
  }
  weakSignals?: string[]
}
```

Validate with `zod` (pattern used elsewhere in agents) before returning.

---

## Module API

```typescript
// lib/agents/foundationCreativeDirection.ts

export function creativeDirectionModel(): string {
  return process.env.CREATIVE_DIRECTION_MODEL ?? 'anthropic/claude-sonnet-4'
}

/** Build prompt payload from live Foundation — no side effects. */
export function buildCreativeDirectionInput(ctx: FoundationContext, fieldScores: Record<string, FieldScore>): string

/** The checkpoint entry point — one LLM call, validated JSON out. */
export async function translateFoundationToCreativeDirection(opts: {
  profileId: string
  companyName: string
}): Promise<CreativeDirection>
```

Implementation sketch:

1. `loadFoundationContext(profileId)` + `loadFieldScores(profileId)`
2. `buildCreativeDirectionInput()` — format answers as labeled sections (Business,
   Customer, Position, Voice, **Visual**, Plan); append document excerpts capped
   (~4k chars total enrichment); append weak field list
3. `openRouterComplete()` with temperature **0.3** (lower than brief compose 0.6 —
   extraction not creative writing)
4. Parse JSON from response; `CreativeDirectionSchema.parse()`
5. On failure: throw with first 400 chars of raw response (same pattern as `briefCompose.ts`)

---

## System prompt (starting point)

```
You are a brand strategist translating onboarding data into structured creative direction.
Output ONLY valid JSON matching the CreativeDirection schema. No markdown fences.

Rules:
- PRIMARY source: the owner's raw Foundation answers (especially visual* fields).
- SECONDARY: generated documents — use only to fill gaps; never contradict explicit answers.
- voiceProfile.toneDo / toneDont: derive from toneTraits, neverSoundLike, brandsAdmired.
- customerPain: one sharp sentence — who hurts and why — not a paragraph.
- headlineAngles: 3-5 distinct angles grounded in pain + differentiator + transformation.
- product.category: plain language ("AI marketing platform for solo operators").
- product.keyNouns: concrete nouns safe to depict (from visualHeroSubjects + businessDescription).
- product.mustNotDepict: merge visualMustNotDepict with neverSoundLike visual equivalents.
- visualDirection: descriptive language only — NO hex codes, NO font names.
- weakSignals: for each gated section (customer, position, voice) with average score 70-84,
  one actionable warning string using field feedback when present.
- If visual answers are empty, infer cautiously from voice/brandsAdmired and add a weakSignal
  noting thin visual identity.
```

User message: the formatted input from `buildCreativeDirectionInput()`.

---

## Files to create

| File | Purpose |
|------|---------|
| `lib/agents/foundationCreativeDirection/types.ts` | Interface + zod schema |
| `lib/agents/foundationCreativeDirection/buildInput.ts` | Prompt formatting (testable without LLM) |
| `lib/agents/foundationCreativeDirection/index.ts` | `translateFoundationToCreativeDirection` |
| `scripts/verify-creative-direction.ts` | Isolation checkpoint runner |

**Do not create in Step 2:**

- DB column for cached Creative Direction (Step 5)
- Changes to `briefCompose.ts` / `briefComposeVideo.ts` (Step 3–4)
- API route exposure (optional debug route behind admin only — not required)

---

## Verify script — `scripts/verify-creative-direction.ts`

Pattern: same lib helpers as image verify scripts (`verify-generate-images-lib.ts`).

```bash
npx --yes tsx --env-file=.env.local scripts/verify-creative-direction.ts
# Optional: target profile
CREATIVE_DIRECTION_PROFILE_ID=<uuid> npx --yes tsx --env-file=.env.local scripts/verify-creative-direction.ts
```

Script behavior:

1. Resolve profile (default: highest `foundation_score` with valid Clerk user, or env override)
2. Call `translateFoundationToCreativeDirection({ profileId, companyName })`
3. Print pretty JSON to stdout
4. Print human-readable summary blocks (voice, pain, angles, product, visual)
5. Run **automated smell checks** (fail exit 1 if any hit — tune list over time):

```typescript
const GENERIC_SMELLS = [
  /small business(es)?\s+(everywhere|owners? who want to grow)/i,
  /leading provider/i,
  /synergy|leverage|best-in-class/i,
  /stock photo handshake/i, // ok if in mustNotDepict — check context
]

const AGENT7EVEN_MUST_MENTION = [
  /marketing platform|agent7even|maya/i,  // at least one in category or keyNouns or pain
]
```

6. Print checklist for **human** go/no-go (script cannot replace reading it):

```
HUMAN CHECKPOINT — read the JSON:
[ ] customerPain names YOUR customer, not "small businesses everywhere"
[ ] headlineAngles sound like YOUR positioning, not template SaaS
[ ] product.keyNouns include things you would actually show in a post
[ ] visualDirection matches Step 1 visual fields (if filled)
[ ] weakSignals reflect real thin spots you know about
[ ] Nothing reads like it could apply to any random B2B startup

If 4+ boxes checked → GO to Step 3
If mostly generic → fix Foundation answers (Step 1 visual + voice/customer), re-run
```

---

## Self-checking loop (like video QA)

Run iteratively until human checkpoint passes:

```bash
# 1. Run translation
npx --yes tsx --env-file=.env.local scripts/verify-creative-direction.ts | tee /tmp/creative-direction.json

# 2. If generic — edit Foundation in hub (or SQL), re-score, re-run
# 3. Optionally log prompt input for debugging:
DEBUG_CREATIVE_DIRECTION_INPUT=1 npx --yes tsx --env-file=.env.local scripts/verify-creative-direction.ts
```

When tuning the system prompt, change prompt only — do not wire composers until
output stabilizes on Agent7even.

---

## Acceptance criteria (Step 2 complete)

| Criterion | Pass |
|-----------|------|
| Module returns valid `CreativeDirection` without throwing | Required |
| Agent7even run: `customerPain` mentions solo operators / marketing chaos (your words) | Required |
| Agent7even run: `product.category` is AI marketing platform (not "software company") | Required |
| `headlineAngles` are distinct, not five variants of "grow your business" | Required |
| `visualDirection` populated from Step 1 fields when filled | Required |
| `weakSignals` present when any gated section 70–84 | Expected |
| No wiring to image/video compose | Required |
| Rovane human read: "this understands Agent7even" | **The actual gate** |

---

## Known gaps to document in output (not blockers)

- Empty visual fields → translation must infer + flag in `weakSignals`
- `competitors` in answers vs documents may duplicate — prompt says answers win
- Maya memory / `foundation_knowledge` not consumed in Step 2 (future enrichment)

---

## After checkpoint passes

Step 3 handoff (not built yet):

- Replace `foundationMarkdown` arg in `composeImageBriefs()` with serialized
  Creative Direction block (~2k chars structured, not 28k dump)
- Keep `postContextBlock` — post form grounding stays
- Re-run `scripts/verify-generate-images-*` happy path

Step 5: persist object on `profiles` or `foundation_documents` type `creative_direction`
JSONB; regenerate on Foundation save / score completion.

---

## Scope reminders

- **No Observer/Guardian** — build the object they will later edit
- **No full Foundation restructure** — translation reveals if more schema is needed
- **Bet is tested here** — one module, one script, one human read
