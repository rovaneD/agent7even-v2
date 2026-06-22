# CONTEXTV19 — Creative generation: images, assets, and video
*Snapshot: June 21, 2026 — supersedes `CONTEXTV18.md` for creative generation scope*

This document supersedes `CONTEXTV18.md` for **image generation, video generation, creative assets, and related Agents UX**.
Everything in V18 still applies unless this file explicitly changes it.

Prior session logs: `SESSION_2026-06-21-video-generation.md` (video gen ship), `SESSION_2026-06-21.md` (image gen v1.1), `SESSION_2026-06-20-creative-generation.md` (v1 core).

---

## Repository state

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app (+ www.agent7even.ai when DNS pointed)
Branch: main
Latest commit (June 21, 2026):
  4b065ea — Render video/mp4 in approval queue using native video element
  77ed305 — Fix video generation operation order and bucket MIME type support
  8e492b8 — Add video generation for Maya — async OpenRouter video API
Prior creative gen baseline:
  f300349 — Add creative assets library and harden Maya image generation
  634c53a — Add creative image generation v1 behind feature flag
```

Before every push: `git remote -v` must show `rovaneD/agent7even-v2`.

---

## Feature flags

| Env var | Purpose | Default |
|---------|---------|---------|
| `NEXT_PUBLIC_IMAGE_GENERATION` | Gates image generate UI + all `/api/posts/generate-images/*` routes | `false` in `.env.example` |
| `NEXT_PUBLIC_VIDEO_GENERATION` | Gates video generate UI + `/api/posts/generate-video` route | `false` in `.env.example` |

When `false`: UI block hidden in Agents; API returns 404/disabled.
**Note:** `NEXT_PUBLIC_*` is inlined at build time — changing the value requires a redeploy.

Optional server tuning (see `.env.example`):

- `IMAGE_GENERATION_MODEL` — fallback OpenRouter image model slug
- `IMAGE_GENERATION_BRIEF_MODEL` — brief composer LLM (default `anthropic/claude-sonnet-4`)
- `IMAGE_GENERATION_OPTIONS_COUNT` — options per image run (default `3`, max 4)
- `VIDEO_GENERATION_MODEL` — override OpenRouter video model slug (default `kling/kling-v1-5`)

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

---

## What shipped — June 21 (video generation)

Commits `8e492b8`, `77ed305`, `4b065ea`. Full details: `SESSION_2026-06-21-video-generation.md`.

### Architecture

Async job flow — user does not wait in-session:

```
POST /api/posts/generate-video
  Foundation floor gate (70% Voice/Position/Customer — same as image gen)
  composeVideoBrief()  ←  Foundation snapshot + post goal
  submitVideoJob()     →  OpenRouter POST /api/v1/videos  →  job_id
  createTask()         →  agent_tasks (status=running, requires_approval=true,
                            input.video_job_id, input.video_model, input.brief_excerpt)
  deductCredits()      →  40 credits linked to taskId

OpenRouter webhook → POST /api/webhooks/openrouter-video
  HMAC-SHA256 verify (OPENROUTER_VIDEO_WEBHOOK_SECRET, header X-OpenRouter-Signature)
  Return 200 immediately via next/server after()
  Find task by input->>video_job_id
  On completed: download video → ensureBucketAllowsVideo() →
    upload post-assets/{profileId}/{uuid}.mp4 →
    insert agent_outputs (status=pending_approval) →
    agent_task.status = completed
  On failed: agent_task.status = failed, no output inserted
```

### Operation order (non-negotiable)

`compose brief → submit OpenRouter job → create task → deduct credits`

Submit fail → no task, no credits. Insufficient credits → task marked failed, 402.

### Video brief quality rules

`lib/agents/videoGeneration/briefComposeVideo.ts` — 120–220 word brief with:
- **Scene direction** — opening (0–2s), main (2–6s), close (6–8s)
- **Visual tone** — plain English palette ("warm amber", "deep slate") — never hex codes or color token names
- **Motion style** — camera movement and text animation
- **Text overlay** — max 8 words, tied to post goal, must be specific copy (no generic filler)

Post-compose `stripDesignTokenLeaks()` strips any hex/token/font-spec leaks.

### Video model catalog

`lib/agents/videoGeneration/videoModelCatalog.ts`

| ID | Label | OpenRouter slug | Default |
|----|-------|-----------------|---------|
| `kling-v1-5` | Kling v1.5 | `kling/kling-v1-5` | ✓ |
| `runway-gen3` | Runway Gen-3 | `runway/gen-3-alpha-turbo` | |
| `luma-dream` | Luma Dream Machine | `luma/dream-machine` | |

Override with `VIDEO_GENERATION_MODEL` env var.

### Credits

`GENERATION_VIDEO_CREDIT_COST = 40` — deducted at submit time, one `credit_ledger` row.
Calibrate after staging once model is finalized.

### Storage

- Bucket: `post-assets` (shared with image generation)
- Path: `{profileId}/{uuid}.mp4`
- MIME: `video/mp4`
- `ensureBucketAllowsVideo()` in webhook updates bucket MIME types at runtime (idempotent)
- SQL: `22_post_assets_allow_video.sql` for manual application

### agent_outputs content shape

```json
{
  "raw": "Generated video ready for review.",
  "media_storage_path": "post-assets/{profileId}/{uuid}.mp4",
  "media_mime": "video/mp4",
  "generated": { "model": "...", "job_id": "...", "brief_excerpt": "...", "qa_passed": true }
}
```

Approval queue picks it up with no changes to existing query logic (requires_approval=true,
status=completed, approved_at IS NULL). ApprovalsClient renders `<video>` when media_mime is
`video/mp4`.

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

### Image routes — gated on `NEXT_PUBLIC_IMAGE_GENERATION` + auth + Foundation floor

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/posts/generate-images` | POST | Compose briefs → 3 images → QA each → return options |
| `/api/posts/generate-images/qa` | POST | Vision text QA on picked option |
| `/api/posts/generate-images/regenerate-option` | POST | Regenerate one option after QA fail |
| `/api/posts/generate-images/edit-option` | POST | User-directed edit |
| `/api/posts/generate-images/compose` | POST | Caption + insert `pending_approval` |
| `/api/posts/generate-images/refresh-previews` | POST | Refresh signed URLs for restored session |

### Video routes — gated on `NEXT_PUBLIC_VIDEO_GENERATION` + auth + Foundation floor

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/posts/generate-video` | POST | Compose brief → submit OpenRouter job → create task → deduct 40 credits |
| `/api/webhooks/openrouter-video` | POST | OpenRouter completion webhook — verify sig → download → upload → output |

### Asset / media routes

| Route | Method | Purpose |
|-------|--------|---------|
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
| Image generate UI | `components/agents/PostImageGenerate.tsx`, `PostImageGeneratePicker.tsx`, `PostImageEditPanel.tsx`, `PostImageTextQaPanel.tsx` |
| Video generate UI | `components/agents/PostVideoGenerate.tsx` |
| Approvals UI | `app/dashboard/agents/approvals/ApprovalsClient.tsx` (renders `<video>` for video/mp4) |
| Assets UI | `app/dashboard/assets/AssetsClient.tsx`, `AssetPreviewModal.tsx` |
| Download | `components/media/DownloadImageButton.tsx`, `lib/downloadMedia.ts` |
| Image generation core | `lib/agents/imageGeneration/*` |
| Video generation core | `lib/agents/videoGeneration/*` |
| Creative assets lib | `lib/creativeAssets/index.ts` |
| Feature flags | `lib/posts/imageGenerationFlag.ts`, `lib/posts/videoGenerationFlag.ts` |
| Foundation gate | `lib/foundation/sectionStrength.ts`, `lib/foundation/sections.ts` |
| Error sanitization | `lib/agents/sanitizeProviderError.ts` |
| Verification scripts | `scripts/verify-generate-images-*.ts` |

---

## v1 baseline still in force (June 20)

From `SESSION_2026-06-20-creative-generation.md` — unchanged:

- Pre-queue compose architecture (brief → options → pick → QA → compose → one `pending_approval` row)
- Foundation floor **70%** on Voice + Position + Customer (`scripts/calibrate-generation-floor.ts`)
- Bundled **25 credits** per compose run (`GENERATION_BUNDLE_CREDIT_COST`)
- Production flag **ON** in Vercel Production as of June 22, 2026 (`NEXT_PUBLIC_IMAGE_GENERATION=true` — must be exact string, not empty)

---

## Known limitations / follow-ups

1. **`lib/posts/imageContextCapabilities.ts`** — Maya/agent prompts are **flag-aware** for image gen (`NEXT_PUBLIC_IMAGE_GENERATION=true`). Video generation is not yet reflected in `imageContextCapabilities.ts`; update when `NEXT_PUBLIC_VIDEO_GENERATION` is confirmed on in production.
2. **Video caption** — `agent_outputs.content.raw` is a placeholder string ("Generated video ready for review."). A Maya-authored caption compose step (similar to `generate-images/compose`) is a follow-on.
3. **Video credit calibration** — `GENERATION_VIDEO_CREDIT_COST = 40` is a placeholder; benchmark real cost after staging.
4. **Webhook polling fallback** — if webhook doesn't fire within ~10 minutes, client should poll `GET /openrouter.ai/api/v1/videos/{job_id}` on next page load. Not yet built; webhook is the primary path.
5. **Post media Phases A–C** (crop, carousel, user-uploaded video) — still in `post_media_expansion_handoff.md`; independent of generation.
6. **Assets without SQL** — save/delete fail gracefully; folders require `21_*`.
7. **Photoreal + on-image text** — some Photoreal outputs may still include short headlines; QA allows legible marketing copy but blocks design-token leaks.
8. **Orphan post-asset files** — deleting a creative asset row does not delete storage objects.
9. **Port to agent7even-app** — experimental v2 only until explicit production port.

---

## Open backlog (carried from V18 + new)

**Closed June 21 (image gen v1.1):** raw OpenRouter errors in UI; infographic/data-viz briefs on Photoreal; hex/color-token brief leaks; save checkmark stuck after edit; session lost on Agents ↔ Assets navigation.

**Closed June 21 (video gen):** async OpenRouter video job submission; webhook receiver; Foundation floor gate; brief composition with scene direction / visual tone / motion style / text overlay; approval queue rendering for video/mp4.

**Still open:**

1. Zernio DPA / real client publish gate (unchanged from V18)
2. Post media expansion Phases A–C (user-supplied crop, carousel, video upload)
3. ~~Production image flag~~ — **Done June 22, 2026** (`NEXT_PUBLIC_IMAGE_GENERATION=true` on www.agent7even.ai)
4. Video flag prod enable — `NEXT_PUBLIC_VIDEO_GENERATION=true` + SQL `22` + smoke test (not yet flipped)
5. Video caption compose step (`agent_outputs.content.raw` is placeholder)
6. Video credit calibration (`GENERATION_VIDEO_CREDIT_COST = 40` — benchmark after staging)
7. Webhook polling fallback (agent_task still running after 10 min → poll OpenRouter)
8. Update `imageContextCapabilities.ts` to reflect video generation capability

---

## SQL migrations (apply in order if not already run)

| File | Purpose | Status |
|------|---------|--------|
| `19_creative_assets.sql` | Base `creative_assets` table | Applied prod |
| `20_creative_assets_extend.sql` | `brief`, `qa_passed` columns | Applied prod |
| `21_creative_asset_folders.sql` | `creative_asset_folders` + folder_id | Applied prod |
| `22_post_assets_allow_video.sql` | Add `video/mp4` to post-assets bucket | **Run before enabling video flag** |

---

## Docs to read first

| Priority | Doc |
|----------|-----|
| Technical state | `CONTEXTV19.md` (this file) |
| Prior technical | `CONTEXTV18.md` |
| Creative gen spec | `creative_generation_handoff.md` (v1 spec + v1.1 addendum) |
| Maya product rules | `MAYA_CONTEXT_V10.md` |
| Video gen session | `SESSION_2026-06-21-video-generation.md` |
| Image gen v1.1 session | `SESSION_2026-06-21.md` |
| June 20 session | `SESSION_2026-06-20-creative-generation.md` |
| Post media roadmap | `post_media_expansion_handoff.md` |
| Go-live | `PRODUCTION_GREENLIGHT.md` |

Superseded for latest creative-gen state: `CONTEXTV18.md` (generation section), `MAYA_CONTEXT_V09.md` (no image-gen UX detail).

---

*Last reviewed: June 21, 2026*
