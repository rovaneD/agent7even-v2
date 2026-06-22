# CONTEXTV19 — Creative assets library + hardened Maya image generation (v1.1)
*Snapshot: June 21, 2026 — supersedes `CONTEXTV18.md` for creative generation scope*

This document supersedes `CONTEXTV18.md` for **image generation, creative assets, and related Agents UX**.
Everything in V18 still applies unless this file explicitly changes it.

Prior session logs: `SESSION_2026-06-21.md` (this ship), `SESSION_2026-06-20-creative-generation.md` (v1 core).

---

## Repository state

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app (+ www.agent7even.ai when DNS pointed)
Branch: main
Latest commit (June 21, 2026):
  f300349 — Add creative assets library and harden Maya image generation
Prior creative gen baseline:
  634c53a — Add creative image generation v1 behind feature flag
  f1a047c — Clerk load error on sign-in (preview auth)
```

Before every push: `git remote -v` must show `rovaneD/agent7even-v2`.

---

## Feature flag

| Env var | Purpose | Default |
|---------|---------|---------|
| `NEXT_PUBLIC_IMAGE_GENERATION` | Gates generate UI + all `/api/posts/generate-images/*` routes | `false` in `.env.example` |

When `false`: generate block hidden in Agents; API returns 404/disabled.

Optional server tuning (see `.env.example`):

- `IMAGE_GENERATION_MODEL` — fallback OpenRouter slug if UI pick missing
- `IMAGE_GENERATION_BRIEF_MODEL` — brief composer LLM (default `anthropic/claude-sonnet-4`)
- `IMAGE_GENERATION_OPTIONS_COUNT` — options per run (default `3`, max 4)

---

## What shipped — June 21 (v1.1)

Commit `f300349` extends the June 20 v1 generate → pick → QA → compose → approval loop.

### Creative Assets library (`/dashboard/assets`)

| Capability | Notes |
|------------|-------|
| **Save from generate picker** | Any of the 3 options can be saved without submitting for approval |
| **Folders** | Create, rename, delete folders; move assets between folders |
| **Preview modal** | Click thumbnail → large view with actions |
| **Delete asset** | Removes DB row (file stays in `post-assets` bucket until manual cleanup) |
| **Use for post** | `?useAsset=<id>` on Agents loads saved asset into single-post flow |
| **Download** | At generate picker, Assets page, and Posts page |

**SQL (run in Supabase if not applied):**

| File | Purpose |
|------|---------|
| `19_creative_assets.sql` | Base `creative_assets` table |
| `20_creative_assets_extend.sql` | `brief`, `qa_passed` columns |
| `21_creative_asset_folders.sql` | `creative_asset_folders` + `creative_assets.folder_id` |

Without `21_*`, folders UI shows “not ready”; delete/save still work if `19` exists.

### Generation session persistence

- Session survives navigation **Agents ↔ Assets** until user discards or submits
- Storage: `lib/agents/imageGeneration/generationSessionStorage.ts` (client `sessionStorage`)
- Restore banner + **Discard session** in Agents Command Center
- `POST /api/posts/generate-images/refresh-previews` — refresh signed preview URLs after restore

### Image edit (step 4b)

| Mode | Model path | Use case |
|------|------------|----------|
| **Fix text only** | Recraft (`sharp-text`) regen with strict headline brief | Headline typos / copy changes |
| **Change visual** | Gemini img2img when source model is Google; else text regen | Subject/background swaps |

- UI: `components/agents/PostImageEditPanel.tsx`
- API: `POST /api/posts/generate-images/edit-option`
- Source images compressed via `lib/postAssetsImagePayload.ts` (sharp) — Google 5 MB inline base64 limit
- Vision QA / captions use **base64 from storage** (`buildVisionUserMessageFromStorage`) — not signed HTTPS URLs (Google rejects private URLs)

### Save-state fix after edit

- Save checkmark tracks **`storagePath`**, not option index — edited/regenerated images show Save unchecked
- Picker remounts on `briefId` change: `key={generatedBriefId}`

### Brief quality gates (prevents infographic / hex-leak outputs)

Root cause of bad Photoreal outputs: brief composer copied Brand Kit tokens into prompt text
(`Growth Green (#10B981)`, `Inter weight 700`, “data visualization”, etc.) — image models render
those as visible labels.

| Layer | File | Behavior |
|-------|------|----------|
| Compose rules | `briefCompose.ts`, `modelBriefRules.ts` | Model-specific diversity; no hex/token names in brief strings |
| Validation | `briefValidation.ts` | `prepareBriefForImageModel()` — Photoreal infographic briefs **replaced** with editorial photo brief |
| Design-spec QA | `designSpecLeakDetection.ts` | Catches `#hex`, bare `2D3748 Label`, color token names in transcription |
| Font-spec QA | `fontLeakDetection.ts` | Catches `Inter 700` etc. rendered as copy |
| Post-gen QA | `generateOptions.ts` | Vision QA on **each** option before return; auto-regenerate once (`GENERATION_OPTION_QA_MAX_RETRIES = 1`) |

### Provider error sanitization

Users must never see raw OpenRouter errors (402 credits, JSON payloads, URLs).

| File | Role |
|------|------|
| `lib/agents/sanitizeProviderError.ts` | Strips provider leaks; friendly copy by context |
| API routes | `generate-images`, `edit-option`, `regenerate-option`, `qa` |
| Client | `PostImageGenerate`, `AgentCommandCenter`, `PostImageEditPanel` |

User-facing fallback (credit/outage): *“Image generation is temporarily unavailable. Please try again in a few minutes.”*

---

## Image model catalog (user-facing picks)

Defined in `lib/agents/imageGeneration/imageModelCatalog.ts`:

| UI id | Label | OpenRouter slug | Notes |
|-------|-------|-----------------|-------|
| `balanced` | Balanced | `google/gemini-2.5-flash-image` | Default; general social |
| `sharp-text` | Sharp text | `recraft/recraft-v4-pro` | Headlines; text QA still required |
| `photoreal` | Photoreal | `black-forest-labs/flux.2-pro` | Photo/metaphor only — **no charts, infographics, or on-image text in briefs** |
| `latest-gemini` | Latest Gemini | `google/gemini-3.1-flash-image-preview` | Preview model |

---

## API routes — creative generation

All gated on `NEXT_PUBLIC_IMAGE_GENERATION` + auth + Foundation floor (see `creative_generation_handoff.md` §3).

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/posts/generate-images` | POST | Compose briefs → 3 images → QA each → return options |
| `/api/posts/generate-images/qa` | POST | Vision text QA on picked option |
| `/api/posts/generate-images/regenerate-option` | POST | Regenerate one option after QA fail |
| `/api/posts/generate-images/edit-option` | POST | User-directed edit |
| `/api/posts/generate-images/compose` | POST | Caption + insert `pending_approval` |
| `/api/posts/generate-images/refresh-previews` | POST | Refresh signed URLs for restored session |
| `/api/creative-assets` | GET/POST | List / save asset |
| `/api/creative-assets/[id]` | GET/PATCH/DELETE | Asset detail, move folder, delete |
| `/api/creative-asset-folders` | GET/POST | List / create folder |
| `/api/creative-asset-folders/[id]` | PATCH/DELETE | Rename / delete folder |
| `/api/post-assets/download` | GET | Download generated/uploaded post asset |
| `/api/media/download` | GET | Generic media download helper |

---

## Key file map

| Area | Paths |
|------|-------|
| Agents UI | `app/dashboard/agents/AgentCommandCenter.tsx` |
| Generate UI | `components/agents/PostImageGenerate.tsx`, `PostImageGeneratePicker.tsx`, `PostImageEditPanel.tsx`, `PostImageTextQaPanel.tsx` |
| Assets UI | `app/dashboard/assets/AssetsClient.tsx`, `AssetPreviewModal.tsx` |
| Download | `components/media/DownloadImageButton.tsx`, `lib/downloadMedia.ts` |
| Generation core | `lib/agents/imageGeneration/*` |
| Creative assets lib | `lib/creativeAssets/index.ts` |
| Foundation gate | `lib/foundation/sectionStrength.ts`, `lib/foundation/sections.ts` |
| Verification scripts | `scripts/verify-generate-images-*.ts` |

---

## v1 baseline still in force (June 20)

From `SESSION_2026-06-20-creative-generation.md` — unchanged:

- Pre-queue compose architecture (brief → options → pick → QA → compose → one `pending_approval` row)
- Foundation floor **70%** on Voice + Position + Customer (`scripts/calibrate-generation-floor.ts`)
- Bundled **25 credits** per compose run (`GENERATION_BUNDLE_CREDIT_COST`)
- Production flag was OFF at June 20 staging pass — re-check Vercel env before enabling on prod

---

## Known limitations / follow-ups

1. **`lib/posts/imageContextCapabilities.ts`** still lists “Image generation” under `unsupported` — accurate for Maya **chat** capability text; generation is a separate flagged Agents flow. Consider splitting capability docs or updating Maya prompts when flag goes prod-wide.
2. **Post media Phases A–C** (crop, carousel, video) — still in `post_media_expansion_handoff.md`; independent of generation.
3. **Assets without SQL** — save/delete fail gracefully; folders require `21_*`.
4. **Photoreal + on-image text** — some Photoreal outputs may still include short headlines; QA allows legible marketing copy but blocks design-token leaks. Infographic/chart briefs are replaced before generation.
5. **Orphan post-asset files** — deleting a creative asset row does not delete storage objects.
6. **Port to agent7even-app** — experimental v2 only until explicit production port.

---

## Open backlog (carried from V18 + new)

**Closed June 21:** raw OpenRouter errors in UI; infographic/data-viz briefs on Photoreal; hex/color-token brief leaks; save checkmark stuck after edit; session lost on Agents ↔ Assets navigation.

**Still open:**

1. Zernio DPA / real client publish gate (unchanged from V18)
2. Post media expansion Phases A–C
3. Production flag decision for `NEXT_PUBLIC_IMAGE_GENERATION` on www.agent7even.ai
4. Additional generation UX (user mentioned revisiting later — TBD)
5. `imageContextCapabilities.ts` / Maya chat alignment when generation goes GA

---

## Docs to read first

| Priority | Doc |
|----------|-----|
| Technical state | `CONTEXTV19.md` (this file) |
| Prior technical | `CONTEXTV18.md` |
| Creative gen spec | `creative_generation_handoff.md` (v1 spec + v1.1 addendum) |
| Maya product rules | `MAYA_CONTEXT_V10.md` |
| June 21 session | `SESSION_2026-06-21.md` |
| June 20 session | `SESSION_2026-06-20-creative-generation.md` |
| Post media roadmap | `post_media_expansion_handoff.md` |
| Go-live | `PRODUCTION_GREENLIGHT.md` |

Superseded for latest creative-gen state: `CONTEXTV18.md` (generation section), `MAYA_CONTEXT_V09.md` (no image-gen UX detail).

---

*Last reviewed: June 21, 2026*
