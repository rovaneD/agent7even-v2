# Credit Model Retune Spec — Phase A3

**Status:** DONE — ready for Claude Code execution.
**Repo:** `rovaneD/agent7even-v2`. Run `git remote -v` before any push.
**Derived from:** OpenRouter cost run (715 generations, real vendor COGS) + credit-debit code recon (real debit logic) + locked decisions (80% worst-case margin floor; premium media = ProAgent only).

This is a **retune + consolidation** spec, not just definitions. The credit system is already fully wired (atomic Supabase RPC, ledger, refunds). The job is to fix the *rates* and *consolidate the scattered cost constants*, not to build the mechanism.

---

## 1. Why this change (the finding)

Real debit rates (from code) are 8–12× higher than the model can absorb:
- image post = **25 credits**, video = **40 credits**, text run = 2, chat turn = 2 (per-artifact, not per-run).
- A realistic active month (12 images, 2 videos, 40 chat turns, campaigns, scans) = **518 credits**.
- Result: **Starter (100) dies after ~4 images. Growth (350) dies mid-month. Only ProAgent (1000) survives a normal month.** Hard 402 stop, billing modal, work blocked — the churn machine.

Real vendor COGS (from OpenRouter):
- text run $0.0074 · standard image (Gemini) $0.039 · standard video (Veo Lite) $0.12 · premium image (Recraft) $0.25 · premium video (Kling) $1.008.

So media is debited at **10–60× its COGS.** Not a cost problem — the rates are arbitrary (25/40 were never tied to economics) and needlessly punishing. Cutting them fixes capacity *and* keeps >80% margins.

---

## 2. The retuned rate table  [LOCKED]

| Action | Current | **New** | Model | COGS | Worst-case margin* |
|--------|---------|---------|-------|------|--------------------|
| Text agent run | 2 | **0** | — | $0.0074 | n/a (free) |
| Maya chat turn | 2 | **0** | — | $0.0074 | n/a (free) |
| Image — standard | 25 | **3** | Gemini Flash | $0.039 | 91% |
| Image — premium *(ProAgent only)* | 25 | **15** | Recraft Pro | $0.25 | clears floor |
| Video — standard | 40 | **10** | Veo Lite | $0.12 | 90% |
| Video — premium *(ProAgent only)* | 40 | **40** | Kling | $1.008 | 83% |
| Publish | 1 | **1** | — | — | — |
| Brand-kit gen (color/font) | 2 | **1** | — | $0.0074 | trivial |
| Foundation doc gen | 0 | **0** | — | — | unchanged |

*Worst-case = user spends 100% of credits on this action, valued at ProAgent's credit rate ($0.149/cr, the lowest/worst). If it clears 80% there, it clears everywhere.

Derivation rule: `credits × $0.149 × 0.20 ≥ COGS`. Min credits: std image ≥1.3 (set 3), std video ≥4 (set 10), premium image ≥8.4 (set 15), premium video ≥34 (set 40).

---

## 3. Gating  [LOCKED: premium = ProAgent only]

| Tier | Standard image (3) | Standard video (10) | Premium image (15) | Premium video (40) |
|------|:--:|:--:|:--:|:--:|
| Starter | ✅ | ✅ | ❌ | ❌ |
| Growth | ✅ | ✅ | ❌ | ❌ |
| ProAgent | ✅ | ✅ | ✅ | ✅ |

Starter and Growth differ by **volume only** (more of the same standard media). ProAgent adds **premium model quality** (Recraft, Kling) — the upgrade reason. Starter/Growth cannot invoke Recraft/Kling at all, which also quarantines the two cost outliers behind the tier that absorbs them.

**Implementation:** premium model selection must be tier-checked server-side at the generation route, not just hidden in UI. A Growth user hitting the premium path directly must be refused (premium models are ProAgent-gated, not merely unlabeled).

---

## 4. Monthly capacity (the sellable sentence)

| | Starter $49 | Growth $89 | ProAgent $149 |
|---|---|---|---|
| Campaigns, content, chat, scans | **Unlimited** | **Unlimited** | **Unlimited** |
| Media credits / mo | 100 | 350 | 1000 |
| ≈ standard images | 33 | 116 | 333 |
| ≈ standard videos | 10 | 35 | 100 |
| premium images (ProAgent) | — | — | 66 |
| premium videos (ProAgent) | — | — | 25 |
| balanced mix | 16 img + 5 vid | 58 img + 17 vid | 166 img + 50 vid |

Worst-case margins: **Starter 98% · Growth 95% · ProAgent 83%.** Floor (80%) holds everywhere.

This is the pricing-page language (Phase B): lead with "unlimited campaigns, content, and chat," frame credits as a *media* meter with concrete examples ("100 media credits ≈ 33 images or 10 videos"). Credits stop being the headline unit.

---

## 5. Consolidation  [REQUIRED before retune]

Recon confirmed **no single source of truth** — costs are scattered across six locations. Do not retune in place across six files; you will miss one. **First** create one authoritative map, then point every call site at it.

Create `ACTION_CREDIT_COST` (single config or DB table):

```ts
export const ACTION_CREDIT_COST = {
  text_run:        0,
  maya_chat_turn:  0,
  image_standard:  3,
  image_premium:   15,   // ProAgent-gated
  video_standard:  10,
  video_premium:   40,   // ProAgent-gated
  publish:         1,
  brandkit_gen:    1,
  foundation_gen:  0,
} as const
```

Then replace the scattered constants at every recon-identified location:
- `lib/agents/cost.ts` → `CREDIT_COST.{light,standard,deep}` (2/8/25) — repoint to the new map; light text → 0.
- `app/api/campaigns/generate/route.ts` → `body.credits ?? 8` and UI hardcoded `credits: 8` — campaign generation is text, set to 0.
- `app/api/posts/generate-video/route.ts` → `GENERATION_VIDEO_CREDIT_COST = 40` → standard/premium split (10/40 by model+tier).
- `lib/agents/imageGeneration/queueGeneratedPost.ts` → `GENERATION_BUNDLE_CREDIT_COST` (25) → 3/15 by model+tier.
- `lib/agents/publishApprovedOutput.ts` → `PUBLISH_CREDIT_COST = 1` — keep.
- brand-kit routes → `const COST = 2` ×2 → 1.
- `lib/agents/executeAgentRun.ts` → tier selection (`hasImage || singlePostRun ? standard : light`) — text-only runs must now resolve to 0, image-attached runs route to image cost.

**DoD for §5:** grep for every old literal (2, 8, 25, 40 in credit context) returns only the new map; no call site computes credit cost inline.

---

## 6. Text-free implementation

Extend the zero-debit pattern Foundation already uses (`chargeCredits: false`) to all text paths:
- Command Center text agents (seo_scanner, campaign_builder, weekly_content, competitor_watcher, idea_analysis, etc.) → 0.
- Maya chat (`/api/maya/chat`, `CHAT_CREDITS`) → 0.
- Campaigns page generate (`/api/campaigns/generate`) → 0.

Image-attached caption runs still debit (they produce media). The discriminator is **does this run produce a media asset** — if no, it's free.

**Fair-use guard:** text being free assumes a sane per-user ceiling. Add a soft fair-use cap far above any real user's behavior (e.g. rate-limit text runs per user per hour) so a runaway loop can't cost real money. Soft-warn, don't hard-stop — the SMB ICP must never be blocked mid-work on text.

---

## 7. Services definition  [known — not gated]

Define plainly wherever "Service Requests" appears (pricing, dashboard):
> **Service Requests = human-delivered work** (e.g. design, photography, ad management) you request and track inside the dashboard, fulfilled by our team. Not AI, not credits — managed services.

Starter 1 / Growth 3 / ProAgent unlimited (existing allocation). Eight-service catalog (per product context) is the menu.

---

## 8. Overflow & cadence

- **Refill:** media credits reset on the user's **monthly billing date** (calendar refill), not a rolling clock. This is the deliberate improvement over Claude's 5-hour/weekly rolling windows, which produce "blocked mid-week" churn — poison for the SMB ICP.
- **Top-up packs:** one-time media-credit purchases that add to balance without resetting cadence — monetizes media-heavy ecommerce/agency ICP without forcing an upgrade or a hard stop. (Mirrors Claude's API-overflow valve.)
- **Zero-balance behavior:** keep the existing hard-stop + billing modal for media, but the message must offer **top-up OR upgrade**, not just upgrade. Text/chat never hit zero (free), so the front door never blocks.

---

## 9. Definition of done (Phase A3)

- [ ] `ACTION_CREDIT_COST` single source created; all six scattered locations repointed; grep clean.
- [ ] Retuned rates live: std image 3, premium image 15, std video 10, premium video 40, publish 1, brand-kit 1.
- [ ] Text agents + Maya chat + campaign generate debit 0; fair-use soft cap in place.
- [ ] Premium models server-side tier-gated to ProAgent; Growth premium attempt refused.
- [ ] Zero-media-balance modal offers top-up OR upgrade.
- [ ] Services defined in copy (pricing + dashboard).
- [ ] Verified against live app: run one of each (text agent, std image, std video, ProAgent premium) and confirm the ledger row debits the new amount; confirm a Growth user cannot invoke premium.
- [ ] Margins spot-checked: no action clears below 80% worst-case.

**Validate against the live app, not the changelog** — confirm debits with actual `credit_ledger` rows, per the gate-based debugging discipline.
