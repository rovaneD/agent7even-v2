# Foundation → Creative Direction — Architecture & Plan
*June 22, 2026. The crucial node: making Foundation output the right outcome.*

**The problem in one sentence:** The brief composer receives a 28,000-character
markdown dump of Foundation docs + raw answers and is told "ground in Voice,
Position, Customer." There is no structured extraction. The model infers
everything from unstructured prose, so a good brief and a generic brief come
from the *same* Foundation — the difference is whether the model happened to
extract the right things that run. That non-determinism is why output
"improves slowly, each test requires fixing."

**The fix in one sentence:** Move interpretation upstream and make it structured.
Translate Foundation into a structured **Creative Direction** object once, and
have every generator consume that object instead of inferring from a dump.

---

## Recon findings that drive the design (from live codebase, June 22)

1. **Strongest grounding today is the post form, not Foundation.** `postContext`
   (postGoal, offer, audience, mustInclude, mustAvoid) is structured and does
   more work than Foundation, which is just the markdown dump underneath.
   This is backwards — Foundation should be the brain.

2. **Scores and feedback are computed then ignored at compose time.**
   `foundation_field_scores` gates generation but the brief composer never reads
   it. Foundation knows Voice is weak (45%) but the composer doesn't know which
   field is weak or use the feedback.

3. **No visual identity data exists.** Foundation captures voice (text identity)
   but nothing about how the brand should *look* — no visual metaphors, hero
   product, forbidden visuals, casting. For an image/video product, structural hole.

4. **Documents + answers are redundant and unprioritized.** Same facts twice,
   in different shapes, no priority rules beyond a code comment.

---

## The Architecture — three layers, clean separation

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1 — FOUNDATION (source of truth)                       │
│ Identity: 16 existing fields (voice, position, customer...)  │
│ + NEW: small set of visual identity fields                   │
└────────────────────────┬────────────────────────────────────┘
                         │ (answers primary, documents enrich)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2 — TRANSLATION LAYER (the new core piece)             │
│ lib/agents/foundationCreativeDirection.ts                    │
│ One dedicated LLM call: Foundation in → structured JSON out  │
│ Output: the CREATIVE DIRECTION object (spec below)           │
│ Cached on Foundation; regenerated on Foundation change       │
└────────────────────────┬────────────────────────────────────┘
                         │ (structured object, NOT 28k dump)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3 — BRIEF COMPOSERS (image + video, simplified)        │
│ Receive Creative Direction + per-post form context           │
│ Job shrinks from "figure out the business" to "write a       │
│ great brief from clear direction"                            │
└────────────────────────┬────────────────────────────────────┘
                         ▼
            Image / Video models (unchanged)
```

**Why this is optimum, not just a fix:**
- Puts structure where Blaze has none (their brief is website-extraction prose).
  Structured Creative Direction is harder to replicate and is where Foundation
  depth becomes a real, defensible advantage.
- It's the natural home for the Observer later. The dual-agent intelligence
  layer doesn't rewrite Foundation prose — it proposes updates to the Creative
  Direction object; the Guardian validates them. **This translation layer IS
  the learning surface the intelligence layer will act on.** Not a throwaway.
- Clean separation of concerns: Foundation = identity, Translation =
  interpretation, Composer = creative writing, Generator = rendering. Each
  improves independently. Today everything is tangled in the composer, which
  is why every fix is whack-a-mole.

---

## The two design decisions (recommended answers)

**1. LLM call, not rule-based extraction.**
Foundation answers are freeform text written by non-marketers
("we're friendly, like a local shop"). That needs interpretation, not regex.
A small Claude call whose only job is to output structured JSON gives
interpretation while producing deterministic *shape*. Rule-based extraction
would be brittle against messy, literacy-varied input.

**2. Answers primary, documents as enrichment.**
Raw answers are atomic and closer to the user's actual words. The 5 generated
docs are already-interpreted prose; extracting from prose-of-prose compounds
drift. Answers-first keeps it grounded in what the user actually said.

**3. Cache on Foundation, regenerate on change.**
Don't recompute per image generation — wasteful, adds latency. Compute when
Foundation is created or meaningfully updated; store it; every generation reads
the cached object. Translation cost paid once per Foundation change, not per post.
(Also: this is exactly the object the Observer updates later.)

---

## The Creative Direction object — spec

Five must-have fields, mapped to the failure modes (generic layouts, wrong tone,
garbled fake text, off-brand visuals):

```typescript
interface CreativeDirection {
  // From toneTraits + neverSoundLike — explicit do/don't, not buried in prose
  voiceProfile: {
    toneDo: string[]        // ["direct", "warm", "confident"]
    toneDont: string[]      // ["corporate jargon", "hype", "fake urgency"]
    voiceSummary: string    // one sentence the model can act on
  }

  // The single sharpest articulation of who hurts and why
  customerPain: string      // "Solo operators who have no time and can't
                            //  see what's working in their marketing"

  // 3-5 on-brand message angles from pain + offer + positioning
  // Stops the model inventing generic copy
  headlineAngles: string[]  // ["Marketing that runs while you run the business",
                            //  "See what's actually working, finally", ...]

  // What the thing actually is + visual anti-patterns
  product: {
    category: string        // "dog walking service" / "AI marketing platform"
    keyNouns: string[]      // concrete things that can appear in imagery
    mustNotDepict: string[] // ["stock-photo handshakes", "generic office",
                            //  "competitor brand colors"]
  }

  // THE MISSING PIECE — brand aesthetic as scene/lighting/casting language
  // Requires the Layer 1 visual fields. No hex codes — descriptive language.
  visualDirection: {
    aesthetic: string       // "warm, outdoorsy, real-not-corporate"
    lighting: string        // "natural daylight, golden hour"
    casting: string         // "real people, candid, mid-action" or "no people"
    paletteWords: string[]  // ["warm terracotta", "deep slate"] — words not hex
    forbiddenVisuals: string[] // brand-specific visual no-gos
  }

  // Optional: surfaced from foundation_field_scores when 70-85
  // "Voice profile is thin — briefs may lean generic on tone"
  weakSignals?: string[]
}
```

Notes:
- `weakSignals` closes the gap where scores/feedback are computed then ignored.
  When a gated section is 70–85 (passing but thin), surface it so the composer
  knows to lean on stronger signals.
- `visualDirection` is why Layer 1 needs the visual-field addition — the
  translation layer can't output what Foundation doesn't hold.

---

## Plan of Action — sequenced, solo-founder realistic

| Step | What | Handoff doc |
|------|------|-------------|
| **1** | Add visual identity fields to Foundation | `FOUNDATION_CREATIVE_DIRECTION_STEP1_HANDOFF.md` |
| **2** | Build translation layer in isolation | `FOUNDATION_CREATIVE_DIRECTION_STEP2_HANDOFF.md` |
| **3** | Wire image brief composer | (after Step 2 checkpoint passes) |
| **4** | Wire video brief composer | repeat of Step 3 |
| **5** | Cache + regenerate-on-change | optimization last |

### Step 1 — Add visual identity fields to Foundation
Smallest piece, do first — everything visual depends on it.

### Step 2 — Build the translation layer as a standalone module
**This is the checkpoint that proves or kills the bet.** Do not wire to anything
until the object reads right in isolation.

### Step 3–5 — Extension (not now)
See full step descriptions in original plan sections above.

---

## The checkpoint that de-risks everything

Step 2 makes the core bet testable in isolation BEFORE wiring anything.
Generate the Creative Direction object for your own business and look at it:

- **Reads like it deeply understands your business** → bet is live, build Steps 3–5
- **Reads generic** → problem is upstream in Foundation's data, not translation.
  Fix Foundation's inputs before sinking time into wiring.

---

## Scope discipline

- Steps 1–3 are the crucial node.
- Do NOT build the Observer/Guardian loop now.
- Do NOT restructure all of Foundation. Add visual fields only.
- The bet is proven at Step 2 in isolation before any wiring.

---

*Recon source: live codebase June 22 (briefCompose.ts, foundationSnapshot.ts,*
*sections.ts, sectionStrength.ts, loadFoundationContext.ts)*
*Handoff docs: STEP1 + STEP2 against live code — June 22, 2026*
