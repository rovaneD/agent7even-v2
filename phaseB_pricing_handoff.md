# Phase B — Pricing Page Handoff

**Status:** drafted, staged. **EXECUTION GATED on A3 credit retune landing + verifying.**
Do not write credit numbers on the page until the app actually debits them (text=0, std image=3, std video=10, premium ProAgent-gated). Shipping pricing copy ahead of the retune = the performance-theater violation this whole audit exists to prevent.
**Repo:** `rovaneD/agent7even-v2`. `git remote -v` before push.
**Gating docs:** `a1_positioning_lock.md`, `a2_capability_ledger.md`, `credit_model_retune_spec.md` (A3).

**Why pricing is the priority page:** scored 5.2 — weakest on the site. The marketing audit: the biggest challenge isn't design, it's *packaging* — the site sells outcomes, the pricing page sells consumption (credits, service requests), and those narratives fight. This handoff makes pricing speak in outcomes.

---

## Pre-flight gate (BLOCKING)
Before any edit, confirm A3 is live in the app:
- `credit_ledger` rows show text agent run = 0, Maya chat = 0, std image = 3, std video = 10.
- Premium models (Recraft/Kling) refused for non-ProAgent; charged 15/40 for ProAgent.
- `ACTION_CREDIT_COST` single source exists.
If any is not true, STOP — pricing copy would describe a product the app doesn't run.

## Step 0 — Recon
- `git remote -v`, branch, last commit.
- Map the pricing page file(s); locate every place credits, "service requests," plan names, and tier features are rendered. Quote current strings.

## Step 1 — Reframe the unit (A3)
The biggest conversion leak (both audits): "I have no idea what a credit is."
- **Lead with outcomes, not credits.** Headline direction: "Choose your marketing team size" (not "simple transparent pricing").
- **Text/campaigns/chat = unlimited.** Surface this prominently — it's true (A3: text debits 0) and it removes the "will I run out?" anxiety on the things users do constantly.
- **Credits = media meter only.** Frame as media allowance with concrete examples:
  - Starter 100: "≈ 33 images or 10 videos/mo"
  - Growth 350: "≈ 116 images or 35 videos/mo"
  - ProAgent 1000: "≈ 333 images or 100 videos/mo, plus premium models"
- The "what does a typical month look like" treatment the auditor asked for — give it, in outcomes.

## Step 2 — Define Service Requests (A3 §7)
Second black hole. Define plainly wherever it appears:
> "Human-delivered work (design, photography, ad management) you request and track in your dashboard, fulfilled by our team. Not AI — managed services."
Starter 1 / Growth 3 / ProAgent unlimited (existing).

## Step 3 — Premium gating = the upgrade story (A3)
- Make premium media (Recraft images, Kling video) the visible ProAgent unlock. This is the Growth→ProAgent reason the audit said was missing ("nothing explains why Growth is the sweet spot").
- Standard media on all tiers; premium quality on ProAgent.

## Step 4 — Category + anchoring (A1 + audit)
- Reinforce A1 category (Marketing OS / team), not "credits."
- Add anchoring the audit recommended: frame against what it replaces (social media manager, coordinator, agency retainer) — but **only with honest numbers**, no fabricated ROI.
- "ProAgent" naming: audit flagged it reads like a feature not a plan. Optional rename (Starter/Growth/Scale or /Pro) — flag for decision, not required this pass.

## Step 5 — Trial friction (audit)
- Current: Starter trials, Growth/Pro charge immediately — audit flagged this as backwards ("why pay before trying?"). Flag for decision: every plan trials, or trial→choose. Product/Stripe change, may exceed copy scope — capture, don't force.

## Step 6 — FAQ reorder (audit)
- First FAQ should be "What does Maya actually create?" (capability, from A2) — not "what's a credit." The page currently assumes product understanding the visitor doesn't have.

## Step 7 — Starter→Growth differentiator (open item)
- Under the retune, Starter→Growth is volume-only (more media credits). The audit wants a clearer reason. Options: seats, service-request count, or premium-media-preview. **Flag for your decision** — volume-only is acceptable for v1; note it.

## Definition of done
- [ ] Pre-flight gate passed (A3 live in app).
- [ ] Credits reframed as media-only meter with outcome examples; text/chat/campaigns shown unlimited.
- [ ] Service Requests defined plainly.
- [ ] Premium = ProAgent unlock, surfaced as upgrade reason.
- [ ] Category/anchoring aligned to A1; no fabricated ROI.
- [ ] FAQ leads with capability, not credits.
- [ ] No claim violates A2 (capability) or A3 (economics).
- [ ] Live render + `npm run build` verified.
- [ ] Open decisions flagged (ProAgent rename, trial structure, Starter→Growth lever) — captured, not silently resolved.
