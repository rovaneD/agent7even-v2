# A2 — Capability Ledger (LOCKED TRUTH DOC)

**Status:** locked. Verified against `agent7even-v2` @ `964f922` via code recon. **June 25 addendum:** YouTube on Zernio connect/publish path (code trace, `CONTEXTV21`); homepage hero approval-first copy shipped (`fcdfa65`).
**Gates:** all marketing-site capability copy (Phase B). No claim ships that this ledger doesn't back.
**Governing rule:** performance-theater test. Copy describes the verb the product *executes*, present tense, no temporal hedge. Roadmap items are partitioned, never present-tense.

---

## 1. Capability status table

Three statuses:
- **live** — end-to-end path exists, returns a real result. Claim freely.
- **live-narrower** — real but narrower than current marketing implies. **Rephrase to true boundary.**
- **roadmap** — no live path (or parked behind a gate). **Off the capability surface; roadmap context only.**

| # | Capability | Status | True boundary (what copy may claim) | Proof / notes |
|---|------------|--------|-------------------------------------|---------------|
| 1 | Write posts | **live** | "writes social posts and captions" | `executeAgentRun` → `generateText`; content_posting, weekly_content, campaign_builder. Draft until approved. |
| 2 | Generate images | **live** (env-gated) | "generates images in your brand style" | `generateImageFromBrief` → OpenRouter; 4 models (Gemini Flash default, Recraft Pro, Flux 2 Pro, Gemini 3.1). Needs `NEXT_PUBLIC_IMAGE_GENERATION=true`. |
| 3 | Generate video | **live** (env-gated) | "generates short videos" | `submitVideoJob` → OpenRouter; Kling default + Veo/Seedance/Sora catalog. Needs `NEXT_PUBLIC_VIDEO_GENERATION=true`. No publish path for video. |
| 4 | Captions in image context | **live** | "reads your image and writes the caption" | Claude Sonnet vision, image bytes from storage. Strong, under-marketed. |
| 5 | Send / draft emails | **live-narrower** | "drafts email sequences" — NOT "sends" | email_sequence_builder; output contract = paste into ESP. Resend is admin/support only. |
| 6 | Schedule / publish | **live-narrower** | "drafts to your approval queue; you schedule/publish" — NOT "posts for you" | Image-caption approval → Zernio **draft**; user schedules from Posts. IG/FB/LinkedIn/X/YouTube in app connect + `createPost` path (Zernio-dependent). Video excluded from publish. |
| 7 | Reply to reviews | **roadmap** | nothing — no live path | No agent, no route, no ingestion. Mockup only. Inbox = social DMs, not reviews. **Highest theater risk.** |
| 8 | Competitor monitoring | **live-narrower** | "competitive reports" / "competitor briefings" — NOT "monitors live data" | competitor_watcher = LLM report from Foundation + prior outputs. No live metrics feed. EnsembleData NOT wired (see §4). |
| 9 | SEO scan | **live-narrower** | "scans your site and advises" — NOT "full SEO audit / crawl" | Fetches live HTML, parses title/meta/canonical/H1-H2. Not a crawl, Lighthouse, or Search Console. |
| 10 | Trend spotting | **live-narrower** | "trend reports" — NOT "live trend monitoring" | LLM from prior outputs only. Output contract: "do not fabricate live trend evidence." No trend feed. |
| 11 | Campaign planning | **live** (plan only) | "builds a 30-day campaign plan" — NOT "auto-produces all the assets" | Produces one plan artifact. Does not fan out to posts/images automatically. "Build with Maya" = manual dispatch. |
| 12 | Landing pages | **roadmap** | nothing — no live path | No builder/host/deploy route. Copy mention only. |
| 13 | Run ads | **live-narrower** | "writes ad variations you can test" — NOT "runs ads" | ad_variations = copy only. No Meta/Google Ads write path. Meta is read-only insights. |

---

## 2. Claims table — the Phase B bridge artifact

Every current-or-implied site claim, its true boundary, and the action. **Pricing and homepage handoffs read off this row by row.**

| Current/implied claim | Reality | ACTION |
|-----------------------|---------|--------|
| "Maya sends emails" | drafts only | **rephrase** → "drafts your email campaigns" |
| "Posts / schedules content" | drafts to Zernio queue; user schedules | **rephrase** → "drafts and queues for your approval; you publish in a click" |
| "Monitors competitors" / "tracks live" | LLM reports, no live feed | **rephrase** → "competitive reports from your Foundation" |
| "Tracks trends" | LLM reports | **rephrase** → "trend reports" |
| "Runs ads" | writes ad copy | **rephrase** → "writes ad variations to test" |
| "Answers reviews" | not built | **move to roadmap** (off capability surface) |
| "Nine agents" | 12 registered; "nine" includes a fictional one | **correct** → see §3 |
| (image generation — underclaimed) | 4 models live | **add** → "generates images in your brand style" |
| (video generation — underclaimed) | live | **add** → "generates short videos" |
| (in-context captions — underclaimed) | live | **add** → "reads your image, writes the caption" |
| (approval framework — underclaimed) | real, strong | **elevate** → core trust mechanism, surface everywhere |

---

## 3. Agent architecture correction

**Code has 12 registered agents, not 9.** The marketing "nine" is inaccurate three ways:
- **"Reputation & Follow-up" is fictional** — no registry entry, mockup only. **Remove.**
- **"Weekly Content runs automatically" is false** — code is approval-required, no schedule. **Correct.**
- **"Maya runs brand-voice review on every draft" is false** — brand_voice_guardian is a separate autonomous agent, not auto-invoked per output. **Correct.**

The 12 real agents (with autonomy + text/media tag for the credit retune):
content_posting (approval, media-capable), post_caption (approval, text/vision — legacy hidden), weekly_content (approval, text — legacy hidden), campaign_builder (approval, text), competitor_watcher (autonomous weekly, text), performance_digest (autonomous daily, text), trend_spotter (autonomous daily, text), seo_scanner (autonomous weekly, text), email_sequence_builder (approval, text), ad_variations (approval, text), idea_analysis (approval, text), brand_voice_guardian (autonomous, text).

**Marketing upside:** 12 real agents with a genuine autonomous/approval split beats a fabricated 9. The architecture is your strongest differentiator (Agents page scored highest, 8.5) — make it accurate and lead with it.

---

## 4. Roadmap section (partitioned — never present-tense capability copy)

Two kinds of "later," kept distinct:

**Reviews — unbuilt.** No code path of any kind. If surfaced at all, clearly future, no backing claims.

**Outlier Intelligence (competitor post-level metrics) — scoped, vendor-verified, gated.** This is the EnsembleData feature. NOT vaporware: data shape confirmed in a live spike (2026-06-14, CONDITIONAL GO), cost trivial (~$0.27/tenant/mo), specs written. **Parked behind one legal gate (Q3):** EnsembleData ToS is unclear on surfacing derived insights to end-customers — needs vendor/legal confirmation before any customer-facing competitor metrics ship. Same severity class as the Zernio DPA gate. EnsembleData correctly NOT wired into the codebase yet; that is the intended state, not an oversight. If it ever appears on the marketing site, it's a roadmap item *with* real backing — distinct from reviews.

**Landing pages — unbuilt.** No backing.

**Captured for MAYA_CONTEXT backlog (roadmap decisions, not audit decisions):** whether to build reviews; whether to clear the Outlier legal gate and ship the feed. Not decided here.

---

## 5. Integration truth (for "where does X connect" copy)

| Integration | Status | Note |
|-------------|--------|------|
| Zernio (social publish) | live | IG/FB/LinkedIn/YouTube (+ TikTok, Pinterest, etc. in connect UI) on all plans; **X / Twitter connect gated to Growth + ProAgent** (Starter blocked while usage is measured); draft→scheduled→published; YouTube not headless OAuth |
| Google Analytics (GA4) | live when connected | real GA4 reports; trial users see mock data |
| Meta | partial | read-only insights; no ad creation |
| Stripe | live, billing only | no revenue attribution / commerce sync |
| Exa | partial | Foundation pre-fill; NOT wired to competitor/SEO |
| EnsembleData | not-wired (roadmap, gated) | see §4 |
| Resend | partial | transactional only; not user campaigns |
| Shopify / commerce | not-built | marketing copy only |
| PostHog | not-built | GA4 only today |

**Copy implication:** the marketing audit's "revenue attribution" claim (Shopify/Stripe → revenue) is **not defensible** — Stripe is billing-only, no commerce integration exists. Do not claim revenue attribution.

---

## 6. Asset lifecycle (Thread 3 scope note)

No unified Draft→Approved→Scheduled→Published state machine on one entity. Three parallel models exist (agent_outputs: pending_approval/approved; agent_tasks: pending→completed/failed; Zernio posts: draft/scheduled/published/failed). **Thread 3 is a surfacing + bridging job, not a greenfield data model** — but the full four-state lifecycle is not on one entity today. Bridge exists only for single-image caption approvals.
