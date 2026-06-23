# CONTEXTV19 — Creative generation: images, assets, and video
*Snapshot: June 22, 2026 — supersedes `CONTEXTV18.md` for creative generation scope*

This document supersedes `CONTEXTV18.md` for **image generation, video generation, creative assets, and related Agents UX**.
Everything in V18 still applies unless this file explicitly changes it.

Prior session logs: `SESSION_2026-06-22.md` (video debug + pricing), `SESSION_2026-06-21-video-generation.md` (video gen ship), `SESSION_2026-06-21.md` (image gen v1.1), `SESSION_2026-06-20-creative-generation.md` (v1 core).

---

## Repository state

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app (+ www.agent7even.ai when DNS pointed)
Branch: main
Latest commits (June 22, 2026):
  bcd7a22 — Fix video download 401: unsigned_urls require OpenRouter Bearer token
  5f78584 — Fix webhook payload parsing: unwrap Convoy data envelope
  708172b — Show generating video cards in approval queue with progress bar
  4a67d88 — Handle expired video download URLs in reconcile (401/403 → mark failed)
  5ffde7b — Add video reconciliation endpoint for webhook-missed jobs
  9f0d476 — Fix webhook 401 (Convoy signature format) and restore pending state on navigation
  a72e273 — Fix video generation UX: model selector, clean pending state, queue auto-refresh
  c33c4cd — Fix video model catalog: replace non-existent slugs with live OpenRouter models
June 21 baseline:
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
- `VIDEO_GENERATION_MODEL` — override OpenRouter video model slug (default `kwaivgi/kling-v3.0-std`)

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
  Delivered by Convoy (User-Agent: Convoy/v26.3.5)
  HMAC-SHA256 verify — Convoy signs JSON-minified body (not raw bytes)
    Simple format:   X-OpenRouter-Signature: <hex>         — HMAC(secret, minify(body))
    Advanced format: X-OpenRouter-Signature: t=<ts>,v1=<hex> — HMAC(secret, "<ts>,<minify(body)>")
  Convoy wraps event in { data: { id, status, unsigned_urls, error } }
    → extract inner = payload.data ?? payload before reading fields
  Return 200 immediately via next/server after()
  Find task by input->>video_job_id
  On completed: download video with Authorization: Bearer <OPENROUTER_API_KEY>
    (unsigned_urls are NOT public despite the name — require Bearer token)
    → ensureBucketAllowsVideo() →
    upload post-assets/{profileId}/{uuid}.mp4 →
    insert agent_outputs (status=pending_approval) →
    agent_task.status = completed
  On failed: agent_task.status = failed, no output inserted
  Download 401/403 → URL expired (~2hr TTL) → mark task failed immediately

Fallback: POST /api/posts/reconcile-video (called on approval queue mount + "Check if ready")
  Polls OpenRouter for all running video_generation tasks for current user
  Same download/upload/insert logic as webhook
  401/403 on download → mark failed; other errors → leave as running
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

All 14 verified live models (updated June 22 — prior catalog had non-existent slugs):

| ID | Label | OpenRouter slug | Default |
|----|-------|-----------------|---------|
| `kling-v3-std` | Kling v3.0 Standard | `kwaivgi/kling-v3.0-std` | ✓ |
| `kling-v3-pro` | Kling v3.0 Pro | `kwaivgi/kling-v3.0-pro` | |
| `kling-video-o1` | Kling Video O1 | `kwaivgi/kling-video-o1` | |
| `seedance-2-fast` | Seedance 2.0 Fast | `bytedance/seedance-2.0-fast` | |
| `seedance-2` | Seedance 2.0 | `bytedance/seedance-2.0` | |
| `seedance-1-5-pro` | Seedance 1.5 Pro | `bytedance/seedance-1-5-pro` | |
| `veo-3-1` | Google Veo 3.1 | `google/veo-3.1` | |
| `veo-3-1-fast` | Google Veo 3.1 Fast | `google/veo-3.1-fast` | |
| `veo-3-1-lite` | Google Veo 3.1 Lite | `google/veo-3.1-lite` | |
| `grok-imagine-video` | xAI Grok Imagine Video | `xai/grok-imagine-video` | |
| `hailuo-2-3` | MiniMax Hailuo 2.3 | `minimax/hailuo-2.3` | |
| `wan-2-7` | Alibaba Wan 2.7 | `alibaba/wan-2.7` | |
| `wan-2-6` | Alibaba Wan 2.6 | `alibaba/wan-2.6` | |
| `sora-2-pro` | OpenAI Sora 2 Pro | `openai/sora-2-pro` | |

`DEFAULT_VIDEO_MODEL_ID = 'kling-v3-std'` and `VIDEO_MODEL_OPTIONS` array are exported for client use.
Override default with `VIDEO_GENERATION_MODEL` env var.

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
| `/api/webhooks/openrouter-video` | POST | Convoy/OpenRouter completion webhook — verify HMAC → unwrap → download → upload → output |
| `/api/posts/reconcile-video` | POST | Fallback: poll OpenRouter for all running video tasks, process any completed ones |

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

## Generation cost analysis (confirmed June 22, 2026)

First real cost data from OpenRouter Activity dashboard. Do not change credit costs without reviewing this table.

### Credit structure

```
CREDIT_VALUE_USD = $0.04  (lib/credits-packages.ts)
40 credits = $1.60 charged to user  (GENERATION_VIDEO_CREDIT_COST)
25 credits = $1.00 charged to user  (GENERATION_BUNDLE_CREDIT_COST — image gen)
```

### Video model costs (per generation, 8s, 9:16) — confirmed

| Model | OpenRouter slug | Actual cost | Charge (40cr) | Margin |
|-------|----------------|-------------|---------------|--------|
| Kling v3.0 Standard | `kwaivgi/kling-v3.0-std` | **$5.04** | $1.60 | **−$3.44** |
| Seedance 2.0 Fast | `bytedance/seedance-2.0-fast` | **$0.97** | $1.60 | +$0.63 |
| Veo 3.1 | `google/veo-3.1` | **$3.20** | $1.60 | **−$1.60** |
| Veo 3.1 Lite | `google/veo-3.1-lite` | **$0.48** | $1.60 | +$1.12 |

Wan 2.6/2.7, Hailuo, Seedance 1.5 Pro, Veo 3.1 Fast, xAI Grok — not yet benchmarked; likely $0.05–$0.30 range.

Kling v3.0 Standard (default) causes **$3.44 loss per generation** at current 40-credit price.
Decision: credit calibration deferred; no code changes until per-model pricing strategy is decided.

### Image model costs (per generation) — confirmed

| Model | OpenRouter slug | Avg cost | Charge (25cr) | Margin |
|-------|----------------|----------|---------------|--------|
| Balanced (Gemini 2.5 Flash) | `google/gemini-2.5-flash-image` | **$0.30** | $1.00 | +$0.70 |
| Latest Gemini (3.1 Flash Preview) | `google/gemini-3.1-flash-image-preview` | **$0.37** | $1.00 | +$0.63 |
| Photoreal (FLUX.2 Pro) | `black-forest-labs/flux.2-pro` | **$0.32** | $1.00 | +$0.68 |
| Sharp text (Recraft V4 Pro) | `recraft/recraft-v4-pro` | **$1.63** | $1.00 | **−$0.03** |

Image gen is broadly profitable at current pricing except Recraft V4 Pro (near breakeven).
The 3-option bundle means cost = 3× per-image + LLM brief; effective cost ~$0.90–$4.89 for the run.

### Pending calibration decisions

1. Implement per-model credit costs (model-specific `CREDIT_COST` map)
2. Gate loss-making video models (Kling, Veo 3.1) to ProAgent tier only
3. Determine target margin per generation tier

---

## Known limitations / follow-ups

1. **`lib/posts/imageContextCapabilities.ts`** — Maya/agent prompts are **flag-aware** for image gen (`NEXT_PUBLIC_IMAGE_GENERATION=true`). Video generation is not yet reflected in `imageContextCapabilities.ts`; update when `NEXT_PUBLIC_VIDEO_GENERATION` is confirmed on in production.
2. **Video caption** — `agent_outputs.content.raw` is a placeholder string ("Generated video ready for review."). A Maya-authored caption compose step (similar to `generate-images/compose`) is a follow-on.
3. **Video credit calibration** — `GENERATION_VIDEO_CREDIT_COST = 40` ($1.60) is below actual cost for Kling ($5.04) and Veo 3.1 ($3.20). Decision deferred. See "Generation cost analysis" section above for full numbers.
4. ~~**Webhook polling fallback**~~ — **DONE June 22**: `POST /api/posts/reconcile-video` polls OpenRouter for running tasks. Called automatically on approval queue mount and from "Check if ready" button. Note: `unsigned_urls` expire in ~2hr; jobs older than that cannot be recovered and are marked failed.
5. **Post media Phases A–C** (crop, carousel, user-uploaded video) — still in `post_media_expansion_handoff.md`; independent of generation.
6. **Assets without SQL** — save/delete fail gracefully; folders require `21_*`.
7. **Photoreal + on-image text** — some Photoreal outputs may still include short headlines; QA allows legible marketing copy but blocks design-token leaks.
8. **Orphan post-asset files** — deleting a creative asset row does not delete storage objects.
9. **Port to agent7even-app** — experimental v2 only until explicit production port.

---

## Open backlog (carried from V18 + new)

**Closed June 21 (image gen v1.1):** raw OpenRouter errors in UI; infographic/data-viz briefs on Photoreal; hex/color-token brief leaks; save checkmark stuck after edit; session lost on Agents ↔ Assets navigation.

**Closed June 21 (video gen):** async OpenRouter video job submission; webhook receiver; Foundation floor gate; brief composition with scene direction / visual tone / motion style / text overlay; approval queue rendering for video/mp4.

**Closed June 22 (video gen hardening):** correct model catalog (14 live slugs); Convoy HMAC signature format; Convoy data envelope unwrap; `unsigned_urls` Bearer auth; reconciliation endpoint; generating card in approval queue; expired-URL fast-fail; model selector UI; video state persistence across navigation.

**Still open:**

1. Zernio DPA / real client publish gate (unchanged from V18)
2. Post media expansion Phases A–C (user-supplied crop, carousel, video upload)
3. ~~Production image flag~~ — **Done June 22, 2026** (`NEXT_PUBLIC_IMAGE_GENERATION=true` on www.agent7even.ai)
4. Video flag prod enable — `NEXT_PUBLIC_VIDEO_GENERATION=true` + SQL `22` + smoke test (not yet flipped)
5. Video caption compose step (`agent_outputs.content.raw` is placeholder)
6. Video credit calibration — **real costs now known** (Kling $5.04, Veo 3.1 $3.20, Seedance Fast $0.97, Veo Lite $0.48); decision on per-model pricing deferred
7. ~~Webhook polling fallback~~ — **Done June 22** (`/api/posts/reconcile-video`)
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
| June 22 session (video debug + pricing) | `SESSION_2026-06-22.md` |
| June 21 video gen session | `SESSION_2026-06-21-video-generation.md` |
| June 21 image gen v1.1 session | `SESSION_2026-06-21.md` |
| Creative gen spec | `creative_generation_handoff.md` (v1 spec + v1.1 addendum) |
| Maya product rules | `MAYA_CONTEXT_V10.md` |
| June 20 session | `SESSION_2026-06-20-creative-generation.md` |
| Post media roadmap | `post_media_expansion_handoff.md` |
| Go-live | `PRODUCTION_GREENLIGHT.md` |

Superseded for latest creative-gen state: `CONTEXTV18.md` (generation section), `MAYA_CONTEXT_V09.md` (no image-gen UX detail).

---

*Last reviewed: June 22, 2026*
