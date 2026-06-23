# Step 1 Handoff — Visual identity fields on Foundation
*Maps `FOUNDATION_CREATIVE_DIRECTION_PLAN.md` Step 1 to live code — June 22, 2026*

**Goal:** Add a small set of visual-identity answers to `profiles.foundation_answers`
so the translation layer (Step 2) can populate `CreativeDirection.visualDirection`
and `product.keyNouns` / `mustNotDepict` from user-owned data — not inference alone.

**Out of scope:** Generation gate changes, document generation changes, Brand Kit
schema changes, Observer/Guardian, full Foundation restructure.

---

## Why these fields (tie to Creative Direction spec)

| Creative Direction field | Foundation source (new) |
|--------------------------|-------------------------|
| `visualDirection.aesthetic` | `visualAesthetic` |
| `visualDirection.lighting` | inferred by translation from aesthetic + brandsAdmired; optional `visualLighting` if user sets it |
| `visualDirection.casting` | `visualCasting` |
| `visualDirection.paletteWords` | `visualPaletteWords` (comma-separated chips or textarea) |
| `visualDirection.forbiddenVisuals` | `visualMustNotDepict` |
| `product.keyNouns` | `visualHeroSubjects` (what to show: product UI, team, customers, etc.) |

Five new keys on existing JSONB — no migration required if keys are optional.

---

## Proposed field keys

Add to `foundation_answers` JSONB (all optional strings unless noted):

```typescript
visualAesthetic: string       // "Clean SaaS dashboard energy, not stock corporate"
visualCasting: string         // "Solo founders at laptop, candid" | "No people — product UI only"
visualHeroSubjects: string    // "Maya dashboard, approval queue, campaign calendar"
visualPaletteWords: string    // "electric blue accent, soft gray, white surfaces" — NOT hex
visualMustNotDepict: string   // "handshakes, generic office, coffee shop networking"
```

**Labels (UI):**

| key | Hub label | placeholder hint |
|-----|-----------|------------------|
| `visualAesthetic` | How should your brand look? | Warm and human, not corporate stock photos |
| `visualCasting` | People in your visuals | Real small-business owners, mid-action — or "no people" |
| `visualHeroSubjects` | What should show up in imagery | Your product, your team, your customers — be specific |
| `visualPaletteWords` | Colors in words (no hex codes) | Soft blue accent, warm white, deep charcoal |
| `visualMustNotDepict` | Never show in visuals | Stock handshakes, fake dashboards, competitor logos |

---

## Files to touch (in order)

### 1. Type + defaults — answers shape

| File | Change |
|------|--------|
| `app/dashboard/foundation/FoundationHub.tsx` | Extend `Answers` type + `emptyAnswers()` defaults with five visual keys |
| `app/dashboard/foundation/FoundationEditor.tsx` | Same `Answers` + `FIELD_LABELS` + `normalizeAnswers()` empty defaults |
| `lib/foundation/score.ts` | Add `FIELD_EXPECTATIONS` entries (low weight — informational, not gated) |

Suggested scoring weights (do not add to generation gate):

```typescript
visualAesthetic:      { label: 'Visual aesthetic',       minWords: 5,  weight: 4 },
visualCasting:        { label: 'Visual casting',         minWords: 3,  weight: 3 },
visualHeroSubjects:   { label: 'Hero visual subjects',   minWords: 3,  weight: 4 },
visualPaletteWords:   { label: 'Palette in words',       minWords: 0,  weight: 2 },
visualMustNotDepict:  { label: 'Forbidden visuals',      minWords: 0,  weight: 3 },
```

### 2. Hub UI — new section

| File | Change |
|------|--------|
| `lib/foundation/sections.ts` | Add `'visual'` to `FoundationScoredSectionKey`; map fields in `FOUNDATION_SECTION_KEY_FIELDS` |
| `app/dashboard/foundation/FoundationHub.tsx` | New `SECTIONS` entry after `voice`:

```typescript
{
  key: 'visual',
  title: 'Your Look',
  icon: Palette, // from lucide-react
  editable: true,
  keyFields: FOUNDATION_SECTION_KEY_FIELDS.visual,
  editFields: [
    { key: 'visualAesthetic',     label: 'How should your brand look?', type: 'textarea' },
    { key: 'visualCasting',       label: 'People in your visuals',      type: 'textarea' },
    { key: 'visualHeroSubjects',  label: 'What should show in imagery', type: 'textarea' },
    { key: 'visualPaletteWords',  label: 'Colors in words (no hex)',    type: 'textarea' },
    { key: 'visualMustNotDepict', label: 'Never show in visuals',       type: 'textarea' },
  ],
  affectedDocs: [], // documents don't cover visual yet — answers-only
  emptyText: 'Tell Maya how your brand should look in photos and graphics — not just how it sounds.',
  agents: agentsForSection('visual'),
}
```

**Generation gate:** Do **not** add `visual` to `GENERATION_GATED_SECTIONS`. Image
generation still gates on Customer / Position / Voice only (`sectionStrength.ts`).

**Agent connections tab:** Extend `FoundationSectionKey` in `lib/agents/registry.ts`
to include `'visual'`. Add `'visual'` to `foundationSections` for image/video-related
agents (e.g. post image generation) so the hub Connections view stays accurate.

### 3. Scoring route sync

| File | Change |
|------|--------|
| `app/api/foundation/score/route.ts` | Already iterates `FIELD_EXPECTATIONS` — no structural change once score.ts updated |
| `app/dashboard/foundation/FoundationEditor.tsx` | Keep `FIELD_LABELS` in sync with `FIELD_EXPECTATIONS` (comment at line 56) |

### 4. Save path (unchanged pattern)

Answers save via existing Foundation hub PATCH — `profiles.foundation_answers`
JSONB merge. Confirm no allowlist blocks unknown keys (grep `foundation_answers`
write paths; today writes full answers object from client).

### 5. Optional pre-fill (defer if slow)

Plan mentions confirm-and-edit from website/Brand Kit. **v1 minimum:** empty fields
+ good placeholders. **v1.1:** when Brand Kit colors exist, suggest
`visualPaletteWords` from color role names (not hex) in a "Suggest from Brand Kit"
link — read `lib/agents/imageGeneration/brandKitSnapshot.ts` for color shape.

Do **not** block Step 2 on pre-fill.

---

## What NOT to change in Step 1

- `lib/agents/loadFoundationContext.ts` — already passes all answer keys through
- `lib/agents/imageGeneration/foundationSnapshot.ts` — still used until Step 3
- `lib/agents/imageGeneration/briefCompose.ts` — no wiring yet
- `foundation_documents` generate route — visual fields are answers-only for now

---

## Verification checklist

1. **Hub:** New "Your Look" section appears; five fields save and reload.
2. **Scoring:** Save triggers score API; new fields get scores in `foundation_field_scores`.
3. **Gate:** Image generation floor unchanged — visual section empty does not block.
4. **Snapshot:** Run dev, save visual fields, confirm they appear under `## Raw answers`
   in the markdown snapshot (proves Step 2 input will see them).
5. **Agent7even account:** Fill all five fields with real Agent7even-specific copy
   (not generic SaaS). This is prerequisite input for the Step 2 checkpoint.

### Agent7even seed copy (for your own Foundation)

Use when testing Step 2 — adjust to taste:

- **visualAesthetic:** Clean product UI, confident blue accents, white cards — premium SaaS without sterile corporate stock
- **visualCasting:** Solo founders and small teams at real desks; candid, mid-work — not models in suits
- **visualHeroSubjects:** Maya command center, approval queue, campaign calendar, AI toolkit runs
- **visualPaletteWords:** electric blue accent, soft gray surfaces, white cards, restrained pink for logo only
- **visualMustNotDepict:** handshake stock photos, generic coffee-shop networking, fake analytics dashboards, competitor SaaS clones

---

## Definition of done

- [ ] Five visual keys in `Answers` type + empty defaults in Hub and Editor
- [ ] `FIELD_EXPECTATIONS` includes all five (scored, not gated)
- [ ] "Your Look" hub section editable and persisted
- [ ] `sections.ts` includes `visual` for hub health display only
- [ ] Agent7even production/staging Foundation filled with specific visual answers
- [ ] No changes to brief compose or translation module (that's Step 2)

---

## Next

When Step 1 is done on your account, proceed to
`FOUNDATION_CREATIVE_DIRECTION_STEP2_HANDOFF.md` — build and run the translation
module in isolation before touching `briefCompose.ts`.
