# MAYA_CONTEXT_V06 — Image-Context Captions, Analytics Honesty, Post Media Roadmap
*Versioned snapshot: June 10, 2026 (evening)*

This document supersedes `MAYA_CONTEXT_V05.md`. Everything in V05 still
applies unless this file explicitly changes it.

Technical detail: `CONTEXTV15.md`. Session backlog: `SESSION_2026-06-10.md`.

---

## What Changed Since MAYA_CONTEXT_V05

### Image-context captions (v1) — product rules

**Promise:** "You bring the visual, Maya writes the words **to match what's in
the frame.**"

| Maya / platform CAN | Maya / platform CANNOT (v1) |
|---------------------|-------------------------------|
| Read a user-supplied **still image** (vision) | Generate images |
| Write one social caption in brand voice + Foundation context | Crop or edit images in-platform |
| Pair caption + image through approval queue | Multi-image carousels |
| Publish caption + same image via Zernio (after human approve) | Video upload or video-aware captions |

Capability source of truth in code: `lib/posts/imageContextCapabilities.ts`.
Maya help mode and Agents Command Center canvas include this contract.

**Where it lives in product:**

- **Agents → Weekly Content** — optional "Post image" attach before run
- **Agents → Approvals** — thumbnail + caption together
- Approve → Zernio draft with matching `mediaItems`

**Credit behavior:**

- Image attached → **Standard tier (8 credits)** vision run (Sonnet)
- Text-only Weekly Content → **Light tier (Haiku)** unchanged
- Publish → separate small credit line (distinct from LLM cost)

**Maya behavior when asked for unsupported features:**

Refuse generation, cropping, carousels, or video. Direct user to upload a
ready-to-post still image (or note roadmap in `post_media_expansion_handoff.md`
if asked about future).

### Zernio posting analytics — honesty rules (shipped)

On **Analytics → Posting** in live mode:

- Do not present mock/sample data as real performance
- Sparse or failed API → empty or error state, not fabricated charts
- Per-block `DATA SOURCE` / metric lines in Maya context remain authoritative

See `CONTEXTV15.md` for commit refs.

### Post media roadmap (planning only)

**`post_media_expansion_handoff.md`** scopes future phases:

- **A** — Crop / aspect trim before post (~1 week)
- **B** — Carousels (~2–3 weeks)
- **C** — Video publish, then optional video-aware captions

Do not implement until image-context v1 is verified in prod.

---

## 1. Product Identity

Unchanged from V05. Maya remains the intelligence layer; Foundation Hub is
prod-canonical when `NEXT_PUBLIC_FOUNDATION_V2=true`.

**Weekly Content** now has two modes:

1. **Text plan** — 7-day content plan when no image (unchanged)
2. **Post Caption** — separate agent for one image + one caption (vision)

Use **Agents → Post Caption** for single posts. Do not use Weekly Content for that flow.

---

## 2. Visual Rules

Unchanged from V05:

- Blue `#3B82F6` primary; pink `#F5349B` logo only
- White cards, `rounded-2xl`, `border-gray-100`, no default shadow
- Approval queue image preview: contained thumbnail, not full-bleed hero

---

## 3. Maya Behavior Rules

Additions to V05:

- On Agents Command Center / Approvals: understand Post Caption drafts (caption
  + attached visual). Do not offer to create or edit the image.
- In help mode: explain Post Caption attach flow; state v1 limits clearly.
- Weekly Content is for multi-day plans — redirect single-image caption requests to Post Caption.
- Do not claim Maya "saw" a video unless Phase C2 ships.

---

## 4. Current Technical Pointers

Read first:

1. `SESSION_2026-06-10.md`
2. `CONTEXTV15.md`
3. `MAYA_CONTEXT_V06.md` (this file)
4. `post_media_expansion_handoff.md` — post-media v2 scope
5. `AUDIT_FIXES_2026-06-02.md`

Implementation map (image-context v1): `CONTEXTV15.md` §2.

Superseded: `MAYA_CONTEXT_V05.md`, `CONTEXTV14.md`.

---

## 5. Marketing alignment (pending v1 verify)

When image-context v1 is prod-verified, update marketing site (`~/agent7even/`):

- How-it-works / FAQ: caption written **to match** the user's image, not generically
  "to go with it"
- Do **not** claim crop, carousel, or video until those phases ship

---

## UNVERIFIED — NEEDS ROVANE CONFIRMATION

Carried from V05, plus:

7. Image-context v1: commit timing and prod smoke owner?
8. Post-media phase priority after v1 (crop vs carousel vs video)?

---

*Last reviewed: June 10, 2026*
