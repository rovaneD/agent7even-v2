# EnsembleData Verification Spike — Findings Report

*Executed 2026-06-14 against live API. OpenAPI spec: `docs/ensembledata-openapi.json`.
Spike instructions: `ensembledata_verification_spike.md`.*

**Do not commit API tokens.** Token used for this spike only; store as
`ENSEMBLEDATA_API_TOKEN` in Vercel/local env if integration proceeds.

---

## Overall gate call: **CONDITIONAL GO**

| Question | Verdict |
|---|---|
| Q1 — Data shape | **CONFIRMED** (Instagram) |
| Q2 — Cost fan-out | **GO** — economics work at projected scale |
| Q3 — Resale / ToS | **UNCLEAR / RESTRICTED** — legal or vendor confirmation required before production |

**Recommendation:** Un-park Stage 1 + Stage 3 **design and integration planning** on
Instagram-first (views confirmed). **Do not ship to paying tenants** until Q3 is
resolved (derived-insight redistribution to Maya end-users) and the
public-scraped-data risk is accepted in writing alongside the Zernio DPA gate.

---

## Q1 — Data shape: **CONFIRMED**

Base URL: `https://ensembledata.com/apis/` · Auth: query param `token`.

### Handles tested (non-owned public accounts)

| Handle | Endpoint | Result |
|---|---|---|
| `@garyvee` | `GET /instagram/user/detailed-info` | ✅ `video_view_count`, `taken_at_timestamp`, `shortcode`, likes via `edge_liked_by` |
| `@hubspot` | `GET /instagram/user/detailed-info` | ✅ Same fields; view counts vary (389k vs 4.8k on sample posts) |
| `@garyvee` (user_id `1697296`) | `GET /instagram/user/reels?depth=1` | ✅ 10 reels; per reel: `play_count`, `taken_at`, `like_count`, `comment_count` |

### Redacted field names (outlier numerator + baseline primitives)

**`detailed-info` posts (in profile timeline edges):**

- `video_view_count` — view count for video/reel posts
- `taken_at_timestamp` — unix timestamp
- `shortcode` — post identifier
- `edge_liked_by.count`, `edge_media_to_comment.count` — engagement fallback

**`user/reels` items (`media` object):**

- `play_count` — primary view metric on reels endpoint
- `taken_at` — unix timestamp
- `like_count`, `comment_count`
- `id`, `shortcode` (when present)

**Note:** IG uses `video_view_count` on detailed-info timeline vs `play_count` on
the reels endpoint. Normalize to **views** in `competitor_channel_baselines` /
outlier math. TikTok uses `statistics.play_count` (pre-confirmed in spike prep;
not re-tested this run to conserve free-tier units).

### Platform choice for v1 feed

**Instagram first** — both baseline primitives work without OAuth:

1. **`detailed-info`** — 10 units, ~12 recent posts + metrics (cheapest single-call baseline)
2. **`user/reels`** — `#returned_reels` units (10 reels at depth=1 = 10 units)

---

## Q2 — Cost fan-out: **GO**

### Measured spend (2026-06-14 UTC)

| Step | Units (instagram) |
|---|---|
| Before any calls | 0 |
| After 2× `detailed-info` + 1× `reels` depth=1 | **30** |

Breakdown matches OpenAPI pricing:

- `detailed-info` = **10 units** each → 20
- `reels` depth=1 (10 reels) = **10 units** → 10

### Per-tenant refresh model (5 Foundation competitors, weekly)

| Strategy | Units / competitor | Units / tenant / refresh |
|---|---|---|
| **Recommended v1:** `detailed-info` only (12-post baseline) | 10 | **50** |
| Reels-only baseline (10 reels) | 10 | **50** |
| Both detailed-info + reels | 20 | **100** |

Spike prep estimate (**~50 units/tenant/refresh**) **confirmed** for the
recommended path.

### Tier capacity (weekly refresh, 50 units/tenant)

| Tier | Daily units | ~Units/month (30d) | Tenants @ 200 units/mo each |
|---|---|---|---|
| Free | 50 | 1,500 | ~7 |
| Wood ($100/mo) | 1,500 | 45,000 | ~225 |
| Bronze ($200/mo) | 5,000 | 150,000 | ~750 |
| Silver ($400/mo) | 11,000 | 330,000 | ~1,650 |

*200 units/mo = 50 units × ~4 weekly refreshes.*

### $/tenant/month (Bronze, recommended path)

- 200 units × ($200 / 150,000 units) ≈ **$0.27/tenant/month** all-in API cost
- vs Starter **$49/mo** revenue → data cost ≈ **0.5%** of subscription at scale

**Pass:** projected data cost is a small fraction of per-tenant revenue.

---

## Q3 — Resale / ToS: **UNCLEAR — treat as blocking for production**

Source: https://ensembledata.com/terms-and-conditions (fetched 2026-06-14)

### What the ToS clearly says

- Data is **publicly scraped**; EnsembleData disclaims accuracy; client assumes risk.
- Client gets a **limited, non-exclusive license to use APIs to access Data** — not ownership of Data.
- Client **may not** build a product that **competes directly** with EnsembleData.
- Website **content** may not be redistributed without prior written consent (separate from API Data section).
- Request **logs** erased monthly on vendor side; no explicit ban on **client storing derived baselines** — storage for rolling averages appears permissible if lawful use is maintained.
- Client must comply with applicable laws; indemnifies EnsembleData.

### What's silent or risky for Maya's model

- **No explicit permission** to surface **derived insights** (outlier scores, “20× normal” briefings) to **Maya's end-customers (SMBs)**. The license reads B2B client-only, not multi-tenant resale/sub-licensing of insights built on Data.
- Even if permitted, Maya inherits **public-scraped-data** risk class — better than self-scraping, **not** equivalent to licensed OAuth analytics (Zernio) or web research (Exa).

### Decision record (required before prod)

1. Contact EnsembleData / legal: *“We operate a multi-tenant SaaS. We store rolling view baselines and show customers derived outlier findings — not raw API payloads. Is this permitted?”*
2. Accept public-scraped-data posture in product/legal docs (same severity class as DPA gate — parallel track, not a substitute).

---

## Integration notes (for when gate clears)

| Endpoint | Params | Units | Use |
|---|---|---|---|
| `GET /customer/get-used-units` | `date`, `token` | 0 | Cost telemetry |
| `GET /instagram/user/detailed-info` | `username`, `token` | 10 | Baseline + recent posts |
| `GET /instagram/user/reels` | `user_id`, `depth`, `token` | #reels | Deeper reel history |
| `GET /instagram/user/info` | `username`, `token` | 3 | Resolve username → user_id if needed |

OpenAPI on disk: `docs/ensembledata-openapi.json` (full EnsembleData spec).

---

## Next steps

1. **Legal/vendor:** Close Q3 before any customer-facing competitor metrics.
2. **If Q3 clears:** Add `lib/social/competitorMetrics.ts` (or similar) swappable interface — mirror `publisher.ts` pattern; env `ENSEMBLEDATA_API_TOKEN`.
3. **Stage 1 build:** `competitor_channel_baselines` using **views** (`video_view_count` / `play_count`), trailing 12 posts, Foundation competitor list.
4. **Stage 2:** Continues independently (`stage2_idea_analysis_plan.md`).

Refs: `backlog_gate_competitor_reach.md`, `outlier_intelligence_handoff.md`.
