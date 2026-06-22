# SESSION_2026-06-21 — Video generation for Maya

*Experimental v2 (`rovaneD/agent7even-v2`). Commits `8e492b8` → `4b065ea` on `main`.*

---

## What shipped

Short-form video generation (9:16, 8 seconds) behind `NEXT_PUBLIC_VIDEO_GENERATION` feature flag.
User submits a post goal → Maya composes a video brief → OpenRouter async video API → webhook
downloads + stores completed video → existing approval queue surfaces it for review.
User never waits in-session; generation runs in the background.

### Flow

```
POST /api/posts/generate-video
  1. Foundation floor gate (same 70% Voice/Position/Customer as image gen)
  2. composeVideoBrief() — Foundation snapshot → OpenRouter brief LLM
  3. submitVideoJob() — POST /openrouter.ai/api/v1/videos → returns job_id
  4. createTask() — agent_tasks row: status=running, requires_approval=true,
       input.video_job_id, input.video_model, input.brief_excerpt
  5. deductCredits() — 40 credits linked to taskId

OpenRouter fires POST /api/webhooks/openrouter-video (async)
  1. HMAC-SHA256 verify (OPENROUTER_VIDEO_WEBHOOK_SECRET)
  2. Return 200 immediately via next/server after()
  3. Find agent_task by input->>video_job_id
  4. On completed: download video → ensureBucketAllowsVideo() →
       upload to post-assets/{profileId}/{uuid}.mp4 →
       insert agent_outputs (status=pending_approval) →
       update agent_task (status=completed)
  5. On failed: agent_task.status = failed, no output inserted

Existing approvals page (app/dashboard/agents/approvals/page.tsx)
  → queries agent_tasks WHERE requires_approval=true AND status=completed
     AND approved_at IS NULL AND rejected_at IS NULL
  → creates signed URL for content.media_storage_path
  → ApprovalsClient renders <video> when content.media_mime = 'video/mp4'
```

### Brief composition rules

`lib/agents/videoGeneration/briefComposeVideo.ts` — single video brief (120–220 words) that includes:

- **Scene direction** — opening shot (0–2s), main action (2–6s), closing (6–8s); specific to the business
- **Visual tone** — lighting, palette described as plain English ("warm amber", "deep slate", "clean white") — never hex codes or color token names
- **Motion style** — how camera and text move ("text slides up center-frame", "quick cuts between product moments")
- **Text overlay copy** — max 8 words tied to post goal; must be specific marketing copy, not generic filler

Post-compose `stripDesignTokenLeaks()` strips any `#hex`, color token names, and font specs that slipped through.

### Operation order (critical)

```
compose brief  →  submit OpenRouter job  →  create agent_task  →  deduct credits
```

If OpenRouter submit fails → no task created, no credits deducted.
If credit deduction fails (INSUFFICIENT_CREDITS) → task marked `failed`, 402 returned.

### Storage

| Concern | Detail |
|---------|--------|
| Bucket | `post-assets` (shared with image generation) |
| Path | `{profileId}/{uuid}.mp4` |
| MIME | `video/mp4` |
| Bucket config | `ensureBucketAllowsVideo()` in webhook adds `video/mp4` to allowed MIME types (idempotent); SQL migration `22_post_assets_allow_video.sql` for manual application |

### agent_outputs content shape

```json
{
  "raw": "Generated video ready for review.",
  "media_storage_path": "post-assets/{profileId}/{uuid}.mp4",
  "media_mime": "video/mp4",
  "generated": {
    "model": "kwaivgi/kling-v3.0-std",
    "job_id": "or-video-...",
    "brief_excerpt": "...",
    "qa_passed": true
  }
}
```

### Video model catalog

`lib/agents/videoGeneration/videoModelCatalog.ts`

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

Override with `VIDEO_GENERATION_MODEL` env var (OpenRouter slug or catalog ID).

### Credits

`GENERATION_VIDEO_CREDIT_COST = 40` — deducted at job submit time, not at webhook receipt.
One `credit_ledger` row linked to the `agent_task` id.
Calibrate after staging once model selection is finalized.

### Webhook security

- Header: `X-OpenRouter-Signature`
- Algorithm: HMAC-SHA256 of raw body, compared with `timingSafeEqual`
- Secret: `OPENROUTER_VIDEO_WEBHOOK_SECRET` (already set in Vercel)
- Invalid/missing signature → 401 immediately
- Valid → 200 within ~1ms, `after()` handles the rest

### Feature flag

`NEXT_PUBLIC_VIDEO_GENERATION=true` — set this in Vercel to enable.
**Note:** `NEXT_PUBLIC_*` is inlined at build time; requires redeploy after env change.

---

## Commits

| Commit | Summary |
|--------|---------|
| `8e492b8` | Add video generation for Maya — async OpenRouter video API |
| `77ed305` | Fix video generation operation order and bucket MIME type support |
| `4b065ea` | Render video/mp4 in approval queue using native video element |

---

## New files

| File | Purpose |
|------|---------|
| `lib/posts/videoGenerationFlag.ts` | Feature flag |
| `lib/agents/videoGeneration/videoModelCatalog.ts` | Model catalog + resolver |
| `lib/agents/videoGeneration/openRouterVideo.ts` | Submit + poll OpenRouter video API |
| `lib/agents/videoGeneration/briefComposeVideo.ts` | Foundation-grounded brief composer |
| `lib/agents/videoGeneration/index.ts` | Barrel export |
| `app/api/posts/generate-video/route.ts` | Submit route (gate → brief → submit → task → credits) |
| `app/api/webhooks/openrouter-video/route.ts` | Webhook receiver (verify → after() → download → upload → output) |
| `components/agents/PostVideoGenerate.tsx` | UI component in AgentCommandCenter |
| `22_post_assets_allow_video.sql` | Bucket MIME type migration |

## Modified files

| File | Change |
|------|--------|
| `lib/agents/sanitizeProviderError.ts` | Added `video_generation` error context + allowlist strings |
| `app/dashboard/agents/AgentCommandCenter.tsx` | Video UI + state behind `NEXT_PUBLIC_VIDEO_GENERATION` |
| `app/dashboard/agents/approvals/ApprovalsClient.tsx` | `<video>` element for `media_mime: video/mp4` |

---

## SQL to apply

```
22_post_assets_allow_video.sql  — adds video/mp4 to post-assets bucket allowed MIME types
```

Run in Supabase SQL editor or via MCP `apply_migration`. Safe to run multiple times (idempotent).
The webhook's `ensureBucketAllowsVideo()` also handles this at runtime on first video completion.

---

## Polling fallback (not yet built)

The spec calls for a client-side polling fallback: if an `agent_task` has `status = 'running'` and
`created_at` is more than 10 minutes ago, poll `GET /openrouter.ai/api/v1/videos/{job_id}` on next
page load to check job status manually. Not blocking for launch — webhook is the primary path.
Add to backlog if webhook reliability proves insufficient in staging.

---

## Known gaps / follow-ups

1. **`lib/posts/imageContextCapabilities.ts`** still lists video generation as unsupported for Maya chat prompts. Update when flag is confirmed on in production.
2. **Caption generation** — `agent_outputs.content.raw` is a placeholder string; video outputs don't yet have a Maya-authored caption. The approval flow will show it as a bare "Generated video ready for review." post. Add a caption compose step (similar to `generate-images/compose`) as a follow-on.
3. **Credit calibration** — `GENERATION_VIDEO_CREDIT_COST = 40` is a placeholder. Benchmark actual generation cost after staging and adjust.
4. **Polling fallback** — see above.
5. **Port to agent7even-app** — experimental v2 only until explicit production port.

---

## Prod enable checklist

- [ ] Run `22_post_assets_allow_video.sql` in Supabase (or let first webhook call do it automatically)
- [ ] Confirm `OPENROUTER_VIDEO_WEBHOOK_SECRET` is set in Vercel (already done per task brief)
- [ ] Confirm OpenRouter workspace webhook URL is registered to `https://agent7even-v2.vercel.app/api/webhooks/openrouter-video` (already done per task brief)
- [ ] Set `NEXT_PUBLIC_VIDEO_GENERATION=true` in Vercel (Production only initially)
- [ ] Redeploy Production (flag is inlined at build time)
- [ ] Smoke test: Agents → single post → set Post goal → Generate video → confirm "Generating video…" state → wait for approval queue entry → confirm video plays in approvals

---

## Verification

- [x] `npx tsc --noEmit` — clean
- [x] `npm run build` — clean
- [x] `git remote -v` — `rovaneD/agent7even-v2` confirmed before each push
- [ ] Prod smoke (pending flag enable)
- [ ] Credit calibration (pending staging run)

---

*Session: June 21, 2026*
