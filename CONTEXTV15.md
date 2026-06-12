# CONTEXTV15 — Image-Context Captions, Zernio Analytics Honesty, Post Media Roadmap
*Snapshot: June 10, 2026 (evening session)*

This document supersedes `CONTEXTV14.md`. Everything in V14 still applies
unless this file explicitly changes it.

Session log (full backlog): `SESSION_2026-06-10.md`.

---

## Repository State

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app
Branch: main
Latest pushed commits (June 10): 793d953 (analytics chart), 2095593, 69639f3
Image-context caption loop: implemented locally — NOT YET COMMITTED (see §2)
```

Before every push: `git remote -v` must show `rovaneD/agent7even-v2`.

---

## What Changed Since CONTEXTV14

### June 12 branch note — image-context verification

Branch `feature/image-context-v1-verify` was created from `main` after
confirming `git remote -v` points to `rovaneD/agent7even-v2`. Current `main`
already includes `f1d9c90` (`Add image-context caption loop so Maya reads
uploaded post visuals`), so the earlier "implemented locally, uncommitted" note
is stale relative to git history.

Small reliability fix on this branch: `publishApprovedImageCaption` now refunds
the 1-credit social publish charge if Zernio `createPost` fails after the credit
deduction. Local checks: `npx tsc --noEmit` passes; `npm run build` passes when
run with permissions that allow Turbopack to bind its local worker port.

### Zernio posting analytics — SHIPPED (commits on main)

1. **Mock leakage removed in live mode** (`69639f3`).
   `AnalyticsClient.tsx` live path no longer spreads `MOCK_POSTING_ANALYTICS`.
   Fetch errors show banner + zeroed live-shaped data.

2. **Analytics SSR 500 fix** (`2095593`).
   Guard when live best-post row has no platform label.

3. **Engagement-over-time chart** (`793d953`).
   Full date-window zero-fill, dual Y-axis, 3×3 metric tiles aligned to Zernio
   presentation.

4. **Social analytics route** (`69639f3`).
   Fan-out per connected Zernio account with `accountId` on all analytics calls.

5. **Validator** (`69639f3`).
   `lib/social/zernioAnalyticsParse.ts` accepts Instagram `/reels/` URLs.

**Prod verify:** live Zernio posting tab with connected test accounts; confirm
no mock numbers when API returns sparse/empty data.

---

### Image-context caption loop (v1) — IMPLEMENTED, UNCOMMITTED

**Product promise:** Owner attaches the visual they intend to post; Maya **reads**
that image and writes caption copy in context; caption + image flow through
approval → Zernio publish. **Not image generation.**

#### Capability contract

Source of truth: `lib/posts/imageContextCapabilities.ts`

| Supported (v1) | Not supported (v1) |
|----------------|-------------------|
| User-upload still image (JPEG/PNG/WebP, ≤20 MB) | Image generation |
| Maya vision caption (Standard tier / Sonnet when image attached) | Cropping / in-platform editing |
| Paired approval + publish | Carousels (multi-image) |
| | Video |

Future work (crop, carousel, video): **`post_media_expansion_handoff.md`**

#### Data model

No new columns. Media refs on `agent_outputs.content` jsonb (and task `input`):

```json
{
  "raw": "<caption>",
  "media_storage_path": "{profile_id}/{uuid}-file.jpg",
  "media_mime": "image/jpeg",
  "image_caption_mode": true
}
```

Storage: private Supabase bucket `post-assets`. SQL bootstrap:
`12_post_assets_bucket.sql` (run manually in Supabase).

#### New / changed paths

| Piece | Path |
|-------|------|
| Capability + validation | `lib/posts/imageContextCapabilities.ts` |
| Limits (client-safe) | `lib/postAssetLimits.ts` |
| Storage server helpers | `lib/postAssets.ts` |
| Upload API | `POST /api/posts/attach-image` |
| Vision prompts | `lib/agents/visionCaption.ts` |
| Agent run (vision branch) | `app/api/agents/run/[agentId]/route.ts` |
| Credit tier param | `lib/agents/runner.ts` → `chargeAgentRun({ tier })` |
| Publish on approve | `lib/agents/publishApprovedOutput.ts` |
| Approve route | `app/api/agents/tasks/[id]/approve/route.ts` |
| UI attach | `components/agents/PostImageAttach.tsx` |
| Weekly Content form | `app/dashboard/agents/AgentCommandCenter.tsx` |
| Approval preview | `approvals/page.tsx`, `ApprovalsClient.tsx` |
| Maya help + agents canvas | `app/api/maya/chat/route.ts`, `lib/maya/summaries/agentsContext.ts` |
| Agent constraints | `lib/agents/registry.ts` (`weekly_content`) |

#### Agent note

Caption agent is **`weekly_content`** (not a separate `content_writer` id).
When `media_storage_path` present: Sonnet + **Standard tier (8 credits)**;
text-only stays Haiku + Light tier. Output contract overridden to **single
caption** (not 7-day plan).

#### Publish gate

`publishApprovedImageCaption` → download from `post-assets` → Zernio presign →
`publisher.createPost({ mediaItems })`. Separate publish credit line. Live client
accounts still gated on Zernio Q4 DPA — test on FREE tier only until cleared.

#### v1 verification gates (must pass before commit/push)

- [ ] Two different images + same brief → captions differ image-specifically
- [ ] `credit_ledger` Standard-tier row after vision run
- [ ] Approval thumbnail = Zernio draft media
- [ ] Weekly Content without image still works end-to-end
- [ ] `12_post_assets_bucket.sql` applied in Supabase
- [ ] `npx tsc --noEmit` clean

---

### Post media expansion — PLANNING ONLY

**`post_media_expansion_handoff.md`** — full scope for Phase A (crop), Phase B
(carousel), Phase C (video publish + optional video-aware Maya). Linked from
AGENTS.md and MAYA_CONTEXT_V06. **Do not start until v1 gates pass.**

---

## Current docs to read first

| Priority | Doc |
|----------|-----|
| Session + backlog | `SESSION_2026-06-10.md` |
| Technical state | `CONTEXTV15.md` (this file) |
| Product / Maya rules | `MAYA_CONTEXT_V06.md` |
| Image-context v1 (code map) | This file §2 + reconcile live files |
| Post media v2 roadmap | `post_media_expansion_handoff.md` |
| Audit ledger | `AUDIT_FIXES_2026-06-02.md` |

Superseded: `CONTEXTV14.md`, `MAYA_CONTEXT_V05.md`.

Handoffs still valid: `approval_queue_handoff.md`, `zernio_social_evaluation_backlog.md`,
`foundation_generate_runner_handoff.md` (retired per V14).

---

## Open backlog (added / updated June 10 evening)

Carried forward from V14 / `SESSION_2026-06-10.md`, plus:

15. **Image-context v1** — commit + push after verification gates (§2).
16. **Marketing copy** — after v1 verified: FAQ / How-it-works "to match it"
    (not "to go with it") — marketing site `~/agent7even/`, not this repo alone.
17. **Post media Phases A–C** — gated on `post_media_expansion_handoff.md` decisions.

---

## UNVERIFIED — NEEDS ROVANE CONFIRMATION

Unchanged from V14 where not resolved, plus:

9. Image-context v1 prod smoke on `agent7even-v2.vercel.app` after deploy?
10. Which post-media phase (crop / carousel / video) to prioritize after v1?

---

*Last reviewed: June 10, 2026*
