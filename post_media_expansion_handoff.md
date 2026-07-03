
# Post Media Expansion — Full Scope Handoff
*Extends image-context captions (v1) with crop, carousels, and video*

**Status:** Phase A (crop) shipped in app · v1 path verified in code (July 2026)  
**Technical baseline:** `CONTEXTV15.md` §2 (image-context v1).  
**Product rules:** `MAYA_CONTEXT_V06.md`.

Read `MAYA_CONTEXT_V06.md` and `CONTEXTV15.md` before starting Phase B.  
Confirm `git remote -v` shows **`agent7even-v2`**, NEVER `agent7even-app`.

**Phase A:** `PostImageCropper.tsx` + crop step in `PostImageAttach.tsx` (Content Posting → Single post upload path).  
**Next:** Phase B carousel — see §4.

---

## 0. Executive summary

**v1 (shipped / in progress)** lets an owner attach **one ready-to-post still image**, Maya **reads** it via vision and writes a matching caption, and caption + image flow through approval → Zernio publish.

**This handoff** scopes three expansions — each independently shippable:

| Phase | Feature | Maya AI role | Rough effort |
|-------|---------|--------------|--------------|
| **A** | Crop before post | None — user crops; Maya reads **final** bytes | ~1 week (crop only) |
| **B** | Carousel (multi-image) | Vision strategy TBD — one caption vs per-slide | ~2–3 weeks |
| **C1** | Video publish | Caption from brief/text — **not** from watching video | ~2–3 weeks |
| **C2** | Video-aware captions | Frame extraction or video-capable model | +2–4 weeks + infra |

**Explicit non-goals across Phases A–C:** in-platform **generation** (Maya creating visuals) — see `creative_generation_handoff.md` instead. Crop/carousel/video here assume the user supplies media (upload or saved asset).

**Dependency gate:** live publish to **real client** accounts — Agent7even signed Zernio DPA Jul 2026; **await Zernio written confirmation** before client onboarding. Build and test on Zernio FREE tier (2 accounts) until then. See `CONTEXTV22.md` §8.

---

## 1. v1 baseline — reconcile before any code

Do not trust this document over live files. Reconcile against:

| Area | Path | v1 reality |
|------|------|------------|
| Capability contract | `lib/posts/imageContextCapabilities.ts` | `maxImagesPerPost: 1`, stills only, unsupported: generation/crop/carousel/video |
| Storage helpers | `lib/postAssets.ts`, `lib/postAssetLimits.ts` | Bucket `post-assets`, single path ref |
| Media ref shape | `agent_outputs.content` jsonb | `{ raw, media_storage_path, media_mime, image_caption_mode }` |
| Upload | `POST /api/posts/attach-image` | Base64, single file |
| Vision caption | `app/api/agents/run/[agentId]/route.ts` | Sonnet + Standard tier when image attached |
| Vision prompts | `lib/agents/visionCaption.ts` | Single image URL in AI SDK message |
| UI attach | `components/agents/PostImageAttach.tsx` — **Post Caption only** (one image, v1) | Weekly Content form in `AgentCommandCenter.tsx` |
| Approval preview | `app/dashboard/agents/approvals/page.tsx`, `ApprovalsClient.tsx` | One signed URL thumbnail |
| Publish | `lib/agents/publishApprovedOutput.ts` | One download → one presign → one `mediaItem` |
| Publisher interface | `lib/social/publisher.ts` | `presignMedia`, `uploadToPresignedUrl`, `createPost({ mediaItems })` — **already supports arrays + video type** |
| Platform validation | `lib/social/postConstraints.ts` | IG carousel ≤10 images; Reels require video |
| Credits | `lib/agents/cost.ts`, `lib/credits.ts` | Standard tier for vision; publish line item separate |
| Maya knowledge | `app/api/maya/chat/route.ts`, `lib/maya/summaries/agentsContext.ts` | Capability block in help + agents canvas |

**Verification gates for v1 (must pass before Phase A):**

- Two different images + same brief → captions differ in image-specific ways
- `credit_ledger` row after vision run (Standard tier, correct `profile_id` + task)
- Same image in queue → same image in Zernio draft
- Text-only Weekly Content path still works

---

## 2. Shared architecture principles

1. **Capability file is source of truth** — extend `lib/posts/imageContextCapabilities.ts` (or rename to `postMediaCapabilities.ts` when v2 ships). Update `supported` / `unsupported` / `limits`; wire into agents, Maya, upload validation, publish guards.

2. **Never bypass the ledger** — vision calls through `run/[agentId]` + `deductCredits()`; publish through `publishApprovedOutput` + distinct publish credit line.

3. **Never call Zernio directly** — all publish through `lib/social/publisher.ts`.

4. **Signed URLs only** — storage paths never exposed raw to client; server signs for preview and vision.

5. **Maya reads; users prepare** — cropping/editing is a **first-party UI action**, not an agent capability. Same safety rule as v1 upload: user-driven only; no agent-triggered crop/upload from observed content.

6. **Approval gate unchanged** — publish stays behind human approve in `/dashboard/agents/approvals`.

7. **Design tokens** — white cards, `rounded-2xl`, `border-gray-100`, no default shadow, blue `#3B82F6` primary, 15px min body, no emoji (per MAYA_CONTEXT / analytics_v2_spec).

---

## 3. Phase A — Crop / aspect trim (in-platform, crop-only)

### 3a. Goal

Owner uploads an image, **crops to platform aspect** in-app, then runs Weekly Content with image-context caption. Maya sees the **cropped export**, not the original (unless product chooses to retain original for re-edit — see decision).

### 3b. What this is NOT

- Not filters, stickers, text overlay, or brightness sliders (that's Phase A+ / separate handoff)
- Not Maya performing the crop
- Not image generation

### 3c. Product decisions (confirm with Rovane before build)

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Keep original? | Replace in storage vs `{ original_path, edited_path }` | Keep **edited only** for v2-A simplicity; add original later if re-crop requested |
| Aspect presets | Platform-aware vs generic | **Platform-aware** from task `platforms` field: IG feed 1:1 / 4:5, Story/Reel 9:16, LinkedIn 1.91:1 |
| When to crop | Before agent run only vs also in approval queue | **Before run** only in v2-A |
| Export format | Always JPEG vs preserve PNG/WebP | **JPEG** for photos at quality 0.92; PNG if source PNG with transparency |

### 3d. Schema

No new table. Optional fields on `agent_outputs.content` / task `input`:

```json
{
  "media_storage_path": "profile_id/uuid-file.jpg",
  "media_mime": "image/jpeg",
  "image_caption_mode": true,
  "media_edit": {
    "cropped": true,
    "aspect": "4:5",
    "source_filename": "photo.heic"
  }
}
```

`media_edit` is optional metadata for analytics/debug — not required for publish.

### 3e. New / changed surfaces

| Surface | Work |
|---------|------|
| `components/agents/PostImageCropper.tsx` | Modal or inline step after file pick: `react-easy-crop` (or equivalent), aspect preset selector, zoom/pan |
| `PostImageAttach.tsx` | Flow: choose file → crop step → upload **cropped** base64 via existing attach endpoint |
| `validateImageContextUpload` | Remove "cropping" from `unsupported`; add `croppingSupported: true` to capability |
| `buildImageContextCapabilityPrompt` | "User may crop before upload; Maya always reads the final exported image." |
| Server | Optional: `sharp` crop endpoint if client export quality insufficient — prefer **client canvas export** first to avoid serverless binary limits |

### 3f. Client export pattern

```typescript
// After crop completes: canvas.toBlob('image/jpeg', 0.92) → base64 → POST attach-image
// Replace preview URL with cropped upload response
```

Handle EXIF orientation on load (`createImageBitmap` or read orientation before crop).

### 3g. Publish / vision / approval

- **Vision:** unchanged — signed URL of cropped file
- **Approval:** unchanged — one thumbnail (cropped)
- **Publish:** unchanged — one presign

### 3h. Build order (Phase A)

1. Capability update — crop moves from `unsupported` to `supported`
2. Cropper component + wire into `PostImageAttach`
3. EXIF + mobile Safari QA
4. Maya/agents prompt strings
5. Manual test: crop 4:5 → caption references framed content; publish matches preview

### 3i. Verification gates

- Crop visibly changes frame → caption references cropped content, not full original scene
- Uncropped upload path still works (skip crop button)
- Cropped file size ≤ platform limit; publish succeeds on Zernio test account

**Estimate:** ~5–7 dev days (crop-only).

---

## 4. Phase B — Carousels (multi-image)

### 4a. Goal

Owner attaches **2–N still images** (N capped per platform, default max **10** for Instagram per `postConstraints.ts`), Maya writes caption(s), approval shows all slides, publish sends ordered `mediaItems[]` to Zernio.

### 4b. Product decisions (BLOCKING — pick before schema)

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Caption model | **One caption** for whole post vs **per-slide** captions | **One caption** referencing the set (v2-B1); per-slide as fast-follow B2 |
| Vision input | All slides in one call vs first slide only vs one call per slide | **All slides in one call** (up to 4 slides) or **first + last** for 5+; document token/credit impact |
| Credit tier | Flat Standard vs scaled by slide count | **Standard base + 2 credits per additional slide** (example — tune against OpenRouter cost) |
| Reorder | Drag reorder before run | Yes — order is publish order |
| Mixed aspects | Allow per slide | Yes — each slide cropped independently in Phase A+B combined |

### 4c. Schema migration

Replace single-path ref with ordered array (backward compatible):

```typescript
// agent_outputs.content / agent_tasks.input
{
  raw: string,
  image_caption_mode: true,
  media_mode: 'single' | 'carousel',  // default 'single' for v1 rows

  // v1 backward compat — keep reading these when media_items absent
  media_storage_path?: string,
  media_mime?: string,

  // v2 carousel
  media_items?: Array<{
    storage_path: string
    mime: string
    order: number
    label?: string  // optional "slide 2" for prompt
  }>
}
```

Update `readPostMediaRef()` → `readPostMediaBundle()` in `lib/postAssetLimits.ts`:

```typescript
export function readPostMediaBundle(source): {
  mode: 'single' | 'carousel'
  items: Array<{ storage_path: string; mime: string; order: number }>
}
```

Migration: none required — v1 rows remain valid via fallback to `media_storage_path`.

### 4d. Upload API

Extend `POST /api/posts/attach-image`:

**Option 1 (recommended):** keep single-file endpoint; client calls N times; server returns `{ items: [...] }` aggregate on task update.

**Option 2:** new `POST /api/posts/attach-images` batch multipart.

Request additions:

```json
{
  "content": "<base64>",
  "filename": "slide-2.jpg",
  "mime": "image/jpeg",
  "taskId": "uuid",
  "order": 2,
  "append": true
}
```

Validation:

- `validateImageContextUpload` per file
- `assertCarouselLimits(count, platform)` — max 10 IG, 4 LinkedIn (confirm against Zernio docs), etc.
- Reject `video/*` in carousel v2-B

### 4e. Vision caption runner

In `app/api/agents/run/[agentId]/route.ts` when `media_items.length > 1`:

1. Sign URL for each slide (parallel)
2. Build multimodal user message:

```typescript
// AI SDK shape (reconcile with foundation/ingest + maya/chat)
messages: [{
  role: 'user',
  content: [
    { type: 'text', text: 'Carousel post — write ONE caption referencing the full set...' },
    ...items.flatMap((item, i) => [
      { type: 'text', text: `Slide ${i + 1}:` },
      { type: 'image', image: new URL(signedUrl) },
    ]),
  ],
}]
```

3. System addon override:

```
CAROUSEL MODE — N images attached in order. Write ONE caption that fits the full carousel arc, not N separate captions. Reference themes across slides without listing every slide literally.
```

4. `chargeAgentRun({ tier: 'standard', ... })` with scaled credits if decision above requires it.

### 4f. UI

| Component | Work |
|-----------|------|
| `PostImageAttach.tsx` | Multi-select; thumbnail strip; drag reorder; remove slide |
| `ApprovalsClient.tsx` | Horizontal scroll strip or dot pager; show slide count |
| `approvals/page.tsx` | Sign URLs for all items server-side |

### 4g. Publish

Update `publishApprovedOutput.ts`:

```typescript
for (const item of bundle.items.sort(by order)) {
  bytes = downloadPostAsset(item.storage_path)
  presign = presignMedia(...)
  uploadToPresignedUrl(...)
  mediaItems.push({ type: 'image', url: presign.publicUrl, title: `slide-${order}` })
}
createPost({ content: caption, mediaItems, ... })
```

Run `validatePost()` from `postConstraints.ts` before `createPost` — enforce IG ≤10, caption length, etc.

### 4h. Capability file

```typescript
unsupported: ['Image generation', 'Video']  // carousel removed from unsupported
limits: { maxImagesPerPost: 10, ... }
supported: [..., 'Multi-image carousel posts (ordered stills, one caption)']
```

### 4i. Build order (Phase B)

1. Schema helpers — `readPostMediaBundle`, backward compat
2. Multi-upload API + validation
3. `PostImageAttach` multi UI + reorder
4. Vision runner carousel branch + credit scaling
5. Approval carousel preview
6. Publish loop + `validatePost`
7. Capability + Maya/agent prompts
8. End-to-end test on Zernio test account (2–3 slide carousel)

### 4j. Verification gates

- 3-slide carousel → approval shows 3 thumbnails → Zernio post has 3 `mediaItems` in order
- Caption references content from slide 2 when slide 2 is distinctive
- v1 single-image rows still approve/publish
- Credit ledger reflects scaled cost (if implemented)

**Estimate:** ~10–15 dev days (B1 one caption); +5–8 days for per-slide captions (B2).

---

## 5. Phase C — Video

Split into **C1 (publish)** and **C2 (video-aware Maya)**. Ship C1 before C2.

### 5a. Phase C1 — Video upload + publish (caption from brief, not from video)

#### Goal

Owner uploads a **single video file**, writes context in Weekly Content form (or generic brief), Maya writes caption from **text context only** OR owner edits caption manually — **Maya does not watch the video** in C1.

#### Product decisions

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Post types | Feed video vs Reel vs Story | Start with **Reel/feed video** on IG + FB; validate per `postConstraints.ts` |
| Max size | 100 MB vs 250 MB | **100 MB** initial; align with Zernio presign limits (confirm in API docs) |
| Allowed MIME | mp4, mov, webm | **mp4 + quicktime** first |
| Maya vision | Off in C1 | Explicit `video_caption_mode: 'brief_only'` flag on content jsonb |
| Preview | HTML5 `<video>` in attach + approval | Required |

#### Schema

```json
{
  "media_mode": "video",
  "media_storage_path": "...",
  "media_mime": "video/mp4",
  "video_caption_mode": "brief_only",
  "image_caption_mode": false
}
```

Or unified:

```json
{
  "media_mode": "video",
  "media_items": [{ "storage_path": "...", "mime": "video/mp4", "order": 0 }]
}
```

#### Storage

- Increase bucket `file_size_limit` for `post-assets` (SQL migration)
- Consider **direct-to-storage** upload (Supabase signed upload URL) for large files — base64 in JSON body is not viable for video

New route (recommended):

```
POST /api/posts/attach-video/init   → { uploadUrl, storagePath, token }
PUT  (client → Supabase signed URL)
POST /api/posts/attach-video/complete → { storagePath, taskId?, previewUrl? }
```

#### Runner

When `media_mode === 'video'` && `video_caption_mode === 'brief_only'`:

- **No vision** — Haiku/light tier, text-only prompt:
  "Write a caption for a video post. You have NOT seen the video. Use the user's brief and Foundation only. Do not claim to describe specific visuals."

#### Publish

- `presignMedia({ contentType: 'video/mp4', size })` → `mediaType: 'video'`
- `createPost` with single video `mediaItem`
- Enforce `postType: 'reel'` when platform requires video (`postConstraints.ts`)

#### Capability (C1)

```typescript
supported: [..., 'User-uploaded video publish with text/brief-based caption']
unsupported: ['Image generation', 'Maya viewing video to write caption (until C2)']
limits: { allowedVideoMimeTypes: ['video/mp4', 'video/quicktime'], maxVideoBytes: 104857600 }
```

**Estimate C1:** ~10–15 dev days (signed upload path is the bulk).

---

### 5b. Phase C2 — Video-aware captions (Maya "sees" the video)

#### Goal

Maya writes caption **in context of what's in the video** — parity with image-context promise for motion content.

#### Approaches (pick one — reconcile cost/latency before build)

| Approach | Pros | Cons |
|----------|------|------|
| **A. Key-frame extraction** | Works with current Sonnet vision; predictable | Needs ffmpeg/worker; misses motion/audio |
| **B. Video-native model** | True multimodal | Model availability via OpenRouter; cost; latency |
| **C. Audio transcript → text** | Good for talking-head Reels | Useless for silent b-roll; needs Whisper/add-on |
| **D. Hybrid** | Best quality | Most complex |

**Recommended path:** **A + C hybrid** for Reels — extract 3–5 frames at 0%, 25%, 50%, 75%, 100% + optional audio transcript; one Standard-tier vision call with frames + transcript.

#### Infrastructure (likely required)

Vercel serverless is a poor fit for ffmpeg. Options:

- **Modal / Cloudflare Workers + ffmpeg WASM** — process upload after `attach-video/complete`
- Store derived assets: `media_derivatives: { frame_paths: string[], transcript?: string }`
- Runner reads frame signed URLs, not raw video

New module: `lib/posts/videoDerivatives.ts`  
New worker route: `POST /api/posts/process-video` (internal secret, triggered on complete)

#### Credit model

- **Deep tier (25 cr)** or custom **video_standard (15 cr)** — reconcile against frame count × Sonnet image tokens + transcript API cost

#### Capability (C2)

Remove "Maya viewing video" from unsupported; add limits on max duration (e.g. 60s for frame extract).

**Estimate C2:** ~15–25 dev days + infra setup.

---

## 6. Cross-phase build order (recommended)

```
v1 verified in production
  → Phase A (crop)
  → Phase B1 (carousel, one caption)
  → Phase C1 (video publish, brief-only caption)
  → Phase B2 (per-slide captions) — optional
  → Phase C2 (video-aware) — optional, infra-heavy
```

Each phase is independently shippable behind feature flags:

```typescript
// lib/posts/featureFlags.ts (suggested)
export const POST_MEDIA_FLAGS = {
  crop: process.env.NEXT_PUBLIC_POST_MEDIA_CROP === '1',
  carousel: process.env.NEXT_PUBLIC_POST_MEDIA_CAROUSEL === '1',
  videoPublish: process.env.NEXT_PUBLIC_POST_MEDIA_VIDEO === '1',
  videoVision: process.env.NEXT_PUBLIC_POST_MEDIA_VIDEO_VISION === '1',
}
```

---

## 7. Files to touch (by phase)

### All phases

- `lib/posts/imageContextCapabilities.ts` (or rename → `postMediaCapabilities.ts`)
- `lib/postAssetLimits.ts` — bundle reader, MIME limits
- `lib/postAssets.ts` — upload/download, bucket limits
- `app/api/maya/chat/route.ts` — help section
- `lib/maya/summaries/agentsContext.ts` — affordance line
- `lib/agents/registry.ts` — `weekly_content` defaultConstraints

### Phase A

- `components/agents/PostImageCropper.tsx` (new)
- `components/agents/PostImageAttach.tsx`

### Phase B

- `app/api/posts/attach-image/route.ts` (or batch route)
- `app/api/agents/run/[agentId]/route.ts`
- `lib/agents/visionCaption.ts`
- `lib/agents/publishApprovedOutput.ts`
- `lib/agents/runner.ts` — `chargeAgentRun` tier scaling
- `app/dashboard/agents/approvals/ApprovalsClient.tsx`
- `app/dashboard/agents/approvals/page.tsx`
- `app/dashboard/agents/AgentCommandCenter.tsx`

### Phase C

- `app/api/posts/attach-video/*` (new)
- SQL migration — bucket size + MIME allowlist for video
- `components/agents/PostVideoAttach.tsx` (new)
- `lib/agents/publishApprovedOutput.ts`
- `lib/social/postConstraints.ts` — reel/story validation before publish
- C2 only: `lib/posts/videoDerivatives.ts`, worker route, storage for frames

---

## 8. Zernio / platform validation checklist

Before each phase ships, confirm against Zernio API docs + test account:

- [ ] Presign accepts file size / MIME for cropped JPEG, carousel images, mp4
- [ ] `createPost` with ordered multi `mediaItems` publishes carousel to IG
- [ ] Video `mediaType: 'video'` publishes as Reel when `platformSpecificData.contentType` set
- [ ] Webhook publish/fail still reconciles to calendar slot (silent fail = broken promise)
- [ ] Q4 DPA — Agent7even signed Jul 2026; await Zernio confirmation before real client accounts (`CONTEXTV22.md` §8)

Reference: `zernio_social_evaluation_backlog.md`, `lib/social/postConstraints.ts`.

---

## 9. Credit ledger line items (suggested)

| Action | Tier | Credits (starting point — tune to cost) |
|--------|------|----------------------------------------|
| Single image vision caption | Standard | 8 (v1) |
| Carousel vision (≤4 slides) | Standard | 12 |
| Carousel vision (5–10 slides) | Standard | 16 |
| Carousel per-slide captions (B2) | Standard × N | 6 × slide count |
| Video brief-only caption (C1) | Light | 2 |
| Video frame+transcript vision (C2) | Deep | 25 |
| Social publish (any media) | Flat | 1 (v1) |

All via `deductCredits()` — never direct SDK calls outside runner.

---

## 10. Explicit non-goals (all phases)

- **Image generation** — Maya never creates visuals; user supplies all media
- **Auto-publish without approval** — unchanged
- **Buffer OAuth** — still out (see AGENTS.md)
- **In-platform full design editor** — filters, templates, Canva replacement (out of scope; crop-only is Phase A max)
- **Mixed carousel + video slides** — out of scope until single-format carousels proven
- **Live client publish before Zernio DPA confirmation** — test accounts only (`CONTEXTV22.md` §8)

---

## 11. Marketing copy (when each phase ships)

| Phase | Copy upgrade |
|-------|--------------|
| v1 | "You bring the visual, Maya writes the words **to match what's in the frame**" |
| A | Add: "Crop to fit before Maya writes" |
| B | Add: "Carousel posts — one caption for the full story" |
| C1 | Add: "Upload video — Maya writes from your brief" |
| C2 | Add: "Maya watches your Reel and writes the caption to match" |

Do not update marketing site until verification gates pass on staging.

---

## 12. Session checklist for implementing agent

1. Read `MAYA_CONTEXT_V06.md`, `CONTEXTV15.md`, this file
2. `git remote -v` → `agent7even-v2`
3. Confirm v1 verification gates pass
4. Confirm phase feature flag + product decisions in §3c / §4b / §5a with Rovane
5. Reconcile every signature against live files before writing
6. Ship one phase at a time; commit before starting next phase
7. Run `npx tsc --noEmit` + manual Zernio test account flow before push

---

*Last updated: June 10, 2026 — post image-context v1 handoff.*
