# MAYA_CONTEXT_V07 — Content Posting, Analytics Honesty, Single-Account Zernio
*Versioned snapshot: June 12, 2026 — superseded by `MAYA_CONTEXT_V08.md` (June 14, 2026)*

This document supersedes `MAYA_CONTEXT_V06.md`. Everything in V06 still
applies unless this file explicitly changes it.

Technical detail: `CONTEXTV16.md`. Session logs: `SESSION_2026-06-11.md`
(Foundation safety), `SESSION_2026-06-12.md`.

---

## What Changed Since MAYA_CONTEXT_V06

### Foundation identity safety (June 11 — guardrails for Maya)

Upload Review Findings **must not** write into Foundation identity. Approved
extractions go to `foundation_knowledge.confirmed_fields` only.

| Maya should | Maya must not |
|-------------|---------------|
| Treat `foundation_answers` + generated docs as the user's business identity | Treat uploaded knowledge / competitor extractions as identity (even if saved to knowledge library) |
| Tell users Intelligence tab edits are identity; Knowledge uploads are references | Claim Maya reads uploaded knowledge files for content generation (not wired yet) |
| Mention "Restore previous version" exists after deliberate identity edits (if snapshot present) | Suggest re-saving upload findings to "apply to Foundation" |

Reference-layer retrieval (Maya reads knowledge on demand) is **Pieces 2+3** —
not built. See `SESSION_2026-06-11.md`.

### Content Posting agent (shipped)

**Agents → Content Posting** is the primary tile for:

1. **Single post** (`contentFlow=single`) — user attaches a still image; Maya
   writes one caption from vision (Standard tier). Flows through Approvals →
   Zernio draft in Posts → publish.
2. **Weekly plan** (`contentFlow=weekly`) — 7-day content plan only; no image
   attach; no auto-publish to Zernio.

Legacy **Post Caption** / **Weekly Content** registry entries may still exist
for old task rows; direct users to **Content Posting** for new runs.

**Maya CAN / CANNOT (v1)** — unchanged from V06:

| CAN | CANNOT |
|-----|--------|
| Read user-supplied still image (vision) | Generate images |
| Write caption to match the frame | Crop, carousel, video |
| Explain approval → Posts → publish path | Claim video understanding |

Source: `lib/posts/imageContextCapabilities.ts`.

### Analytics — honesty + best post (shipped)

Live **Analytics → Posting**:

- No mock data as real performance
- Best post: caption, engagement count, `@username` — from server-resolved Zernio row
- **View** link opens Instagram permalink (correct when browser cache is fresh)

If user reports wrong post on link: suggest hard refresh or incognito — Chrome
may cache pre-fix API responses.

Maya must not invent post URLs or claim posts exist when analytics API returns
empty post lists.

### Zernio scope (June 12)

Test cleanup: single Instagram account `@rovanedurso` on profile
`6a26ee48ff84dc2d54c98d56`. Do not reference Lumina / second profile in
product answers unless user reconnects another account.

---

## Visual rules

Unchanged from V06:

- Blue `#3B82F6` primary; pink `#F5349B` logo only
- White cards, `rounded-2xl`, `border-gray-100`, no default shadow
- Approval queue: contained image thumbnail, not full-bleed hero

---

## Maya behavior rules

Additions to V06:

- **Content Posting** replaces separate Post Caption / Weekly Content guidance
  for new runs.
- Single-image caption requests → Content Posting (single flow), not Weekly.
- Weekly multi-day plans → Content Posting (weekly flow), not single caption.
- On analytics: if only one post in period, best post is expected; do not
  speculate about missing posts Zernio has not synced yet.

---

## Current technical pointers

Read first:

1. `CONTEXTV16.md`
2. `MAYA_CONTEXT_V07.md` (this file)
3. `SESSION_2026-06-12.md`
4. `post_media_expansion_handoff.md`
5. `AUDIT_FIXES_2026-06-02.md`

Superseded: `MAYA_CONTEXT_V06.md`, `CONTEXTV15.md`.

---

## Marketing alignment (still pending)

When image-context v1 is prod-verified on marketing site (`~/agent7even/`):

- Caption written **to match** the user's image
- Do not claim crop, carousel, or video until post-media phases ship

---

*Last reviewed: June 12, 2026*
