# CONTEXTV20 — Content Posting workflow UX
*Snapshot: June 23, 2026 — supersedes `CONTEXTV19.md` for Content Posting routes and format-picker UX*

This document supersedes `CONTEXTV19.md` for **Content Posting agent navigation, format selection, and platform-native previews**.
Everything in V19 still applies unless this file explicitly changes it.

Prior session log: `SESSION_2026-06-23.md`.

---

## Repository state

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app
Branch: main
```

Before every push: `git remote -v` must show `rovaneD/agent7even-v2`.

---

## Content Posting — 3-step flow

| Step | Route | UI |
|------|-------|-----|
| 1. Workflow hub | `/dashboard/agents/content-posting` | Image / Video / Weekly cards |
| 2. Format picker | `/content-posting/image` or `/video` (no `?format=`) | Platform-grouped format list + live preview |
| 3. Setup / create | Same routes with `?format={id}` | Existing `ContentPostingFlowClient` generate + compose flow |

**Gate:** `ContentPostingModeGate.tsx` — missing/invalid `format` param → format picker; valid param → setup flow.

**Back navigation:** Any sub-route (image, video, weekly) shows **Back to workflows** → hub. Hub shows **Back to Agents**.

---

## Key files

| Area | Path |
|------|------|
| Hub cards | `components/agents/contentPosting/ContentPostingHubCards.tsx` |
| Shell + stepper | `ContentPostingShell.tsx`, `ContentPostingStepper.tsx` |
| Format picker | `ContentPostingFormatPicker.tsx` |
| Mode gate | `ContentPostingModeGate.tsx` |
| Platform previews | `PlatformPostPreview.tsx`, `instagram/*` |
| Brand icons | `PlatformBrandIcon.tsx`, `lib/agents/contentPosting/platformBrandIcons.ts` |
| Format data (source of truth) | `lib/agents/contentPosting/platformFormats.ts` |
| Legacy re-exports | `lib/agents/contentPosting/instagramFormats.ts` (deprecated) |

---

## Platform formats

**Image (8):** Instagram post/story, Facebook post/cover, X post/header, LinkedIn post/banner

**Video (6):** Instagram Reels/story, Facebook Reels, TikTok, YouTube Shorts, LinkedIn video

Format IDs use prefixes like `ig-feed-post`, `ig-reels`, `x-post`. Default image format: `ig-feed-post`. Default video: `ig-reels`.

`generationAspectRatio` from the selected format flows through image generation APIs.

---

## Visual system (format picker)

- Pink kicker `#F5349B` — "Content Posting"
- Primary blue `#3B82F6` for selected format rows and CTAs
- Hub cards: 172px emblem, hover lift, footer CTA (Claude Design reference in local `design/` — not committed; re-import from bundle if needed)
- Format layout: 336px selector column + sticky preview panel; selector bottom-aligns with preview card on `lg+`
- Stepper → content gap: `mt-10` (40px)
- Platform brand icons: official Simple Icons paths (inlined), integer px sizing

---

## Routes migrated from legacy Agents tabs

Content Posting no longer lives as inline tabs in `AgentCommandCenter`. Entry:

- Agents Command Center → **Content Posting** card → `/dashboard/agents/content-posting`
- Legacy `/dashboard/agents/content-posting?...` query flows redirect via `AgentsLegacyRedirects.tsx`

Asset **Use for post** links: `/dashboard/agents/content-posting/image?format=ig-feed-post&useAsset={id}`

---

## Design reference (local only)

Claude Design bundle imported for format-picker layout lives under `design/` (~6MB). Not in git — keep locally or re-fetch via Vercel import script when refreshing visuals.

---

## Do not revert

- 3-step hub → format → setup flow for image/video
- Format required before setup (`?format=` gate)
- Weekly plan skips format step but uses same shell back-nav as image/video
- Platform-native preview chrome on format picker (not generic placeholders)
- Creative Direction cached on `profiles` — generation reads cache; recompute on content-checked Foundation save only (`creative_direction_cache_handoff.md`)

---

## Creative Direction cache (Step 5 — June 23, 2026)

| Piece | Path |
|-------|------|
| Source hash (answer + document keys from translation layer) | `lib/agents/foundationCreativeDirection/sourceHash.ts` |
| Cache read / lazy backfill / background refresh | `lib/agents/foundationCreativeDirection/cache.ts` |
| SQL | `23_creative_direction_cache.sql` — applied in Supabase (June 23, 2026) |
| Save triggers | `save-answers`, `save-exa-confirm`, `score`, `restore-previous`, `foundation/generate` |
| Generation reads | `generateOptions.ts`, `generate-video` route via `getOrComputeCreativeDirection()` |

Checkpoint script (isolation, still valid): `scripts/verify-creative-direction.ts`

### Hub synthesis (Your Look preview)

| Piece | Path |
|-------|------|
| Preview formatter | `lib/agents/foundationCreativeDirection/hubPreview.ts` |
| Hub card | `FoundationHub.tsx` — `Look: {aesthetic} · {palette} · {casting}` |
| Server load | `page.tsx` reads `profiles.creative_direction` |

Client hub imports `hubPreview.ts` / `types.ts` directly — not the barrel (avoids `after()` in client bundle).

---

## Critical Generation Gate Fix (June 25, 2026)

- Premium image model access is enforced before any OpenRouter image call in `lib/agents/imageGeneration/generateOptions.ts`; image API routes return `premium_plan_required` for non-ProAgent Recraft requests.
- Video generation creates the task and reserves credits before submitting the OpenRouter job. Submit/attach failures refund the reservation and fail the task.
- `app/api/webhooks/openrouter-video/route.ts` ignores non-running tasks so failed/unpaid jobs cannot become approval outputs.
