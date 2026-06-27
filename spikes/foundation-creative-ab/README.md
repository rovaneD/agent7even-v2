# Foundation creative A/B spike (throwaway)

**Question:** Does Maya Foundation depth produce visibly better, on-brand post images and reels than shallow prompts?

## Run

```bash
# From repo root (requires .env.local with OPENROUTER_API_KEY + Supabase service role)
npx tsx spikes/foundation-creative-ab/run.ts           # full run
npx tsx spikes/foundation-creative-ab/run.ts --images-only
npx tsx spikes/foundation-creative-ab/run.ts --videos-only
```

Optional overrides: `SPIKE_IMAGE_MODELS=google/gemini-2.5-flash-image,...` `SPIKE_VIDEO_MODELS=google/veo-3.1-lite,...`

## Output layout

```
output/
  foundation-snapshot.md     # Real Agent7even Foundation used
  models-selected.json       # Live-picked image + video models
  briefs/                    # All Arm A + Arm B prompt text
  images/arm-{a,b}/{model}/concept-NN.png
  video/arm-{a,b}/{model}/concept-NN.mp4
  video-frames/              # Thumbnails for quick review (not from script)
  JUDGMENT.md                # Verdict + rubric scores
  video-costs.json
```

## Models used (June 2026 live list)

- **Brief writer:** `anthropic/claude-sonnet-4`
- **Image:** `google/gemini-2.5-flash-image`, `google/gemini-3.1-flash-image-preview`
- **Video:** `google/veo-3.1-lite`, `google/veo-3.1` (4s, 720p, 9:16, no audio)

Not committed: binary media under `output/` (see `.gitignore`).
