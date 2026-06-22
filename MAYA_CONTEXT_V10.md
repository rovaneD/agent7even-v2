# MAYA_CONTEXT_V10 — Image generation UX, Assets library, brief safety
*Versioned snapshot: June 21, 2026*

This document supersedes `MAYA_CONTEXT_V09.md` for **creative image generation and Assets**.
Everything in V09 still applies unless this file explicitly changes it.

Technical detail: `CONTEXTV19.md`.

---

## What changed since MAYA_CONTEXT_V09

### Image generation (flagged — `NEXT_PUBLIC_IMAGE_GENERATION`)

Generation lives in **Agents → Single post**, not a standalone studio. Flow:

1. Set **Post goal** in the form above the generate block
2. **Brand** — optional Brand Kit + optional logo on post
3. **Image model** — Balanced / Sharp text / Photoreal / Latest Gemini
4. **Generate 3 options** → pick one → optional **edit** → text QA → submit for approval

| Model | When to use | Maya/UI expectation |
|-------|-------------|---------------------|
| **Balanced** | Default social posts | One short headline OK |
| **Sharp text** | Headline-forward layouts | Best for readable type; still run text QA |
| **Photoreal** | Photo-real or abstract metaphor | **No charts, infographics, or design-token text** — message in caption |
| **Latest Gemini** | Newer Google image preview | Minimal on-image text |

**Photoreal rule (product):** Do not brief or expect bar charts, pillar diagrams, stat dashboards, or hex/color-name labels on the image. If a user asks for a “data viz post,” suggest Sharp text or Balanced for layout + headline, or Photoreal for a **photographic metaphor** with copy in the caption.

### Brief composition — never leak design specs

Brief strings are sent **directly to the image model**. Maya’s brief composer must **not** include in brief text:

- Hex codes (`#10B981`) or bare hex tokens
- Brand Kit color names (`Growth Green`, `Strategic Slate`)
- Font specs (`Inter weight 700`)

Describe palette as “warm green accent”, “deep slate background”. Describe type as “bold sans headline” with **marketing words only** in quotes for on-image copy.

Enforced in code: `briefValidation.ts`, `modelBriefRules.ts`, post-gen QA in `generateOptions.ts`.

### Assets library (`/dashboard/assets`)

- Saved generations persist metadata (model, brief excerpt, post context)
- Folders for organization (requires SQL `21_creative_asset_folders.sql`)
- **Use for post** → Agents with pre-loaded image
- Download at save time, on Assets, and on Posts

### Session persistence

Generation session (options, pick, QA state) survives **Agents ↔ Assets** until discard or submit. Banner: *“Your last generation session was restored…”*

### Edit modes

| Mode | User expectation |
|------|------------------|
| **Fix text only** | Recraft re-render; layout may shift slightly; headline should stay legible |
| **Change visual** | Gemini img2img when available; scene/subject changes |

Edited images are **new storage paths** — Save checkbox resets until saved again.

### Errors — never expose providers

If OpenRouter credits fail or the provider errors, users see friendly copy only — never `OpenRouter error 402`, JSON, or `openrouter.ai` URLs. See `sanitizeProviderError.ts`.

---

## Unchanged from V09 (still in force)

- Scheduling vs Maya FAQ positioning
- Marketing homepage show-the-artifact cards
- Auth pages match lab5
- Inbox, Stage 2 Idea Analysis, Foundation safety, Content Posting flows
- Visual rules: blue `#3B82F6` primary; pink `#F5349B` logo/Maya moments; white cards `rounded-2xl`

---

## Current technical pointers

Read first:

1. `CONTEXTV19.md`
2. `MAYA_CONTEXT_V10.md` (this file)
3. `creative_generation_handoff.md`
4. `SESSION_2026-06-21.md`
5. `MAYA_CONTEXT_V09.md` (homepage / analytics / inbox baseline)

Superseded for image-gen UX: `MAYA_CONTEXT_V09.md` alone.

---

*Last reviewed: June 21, 2026*
