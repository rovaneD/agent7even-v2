# Agent7even / Maya — Site-Wide Audit Master Plan

**Status:** spine document. Phase handoffs spawn from here, one at a time.
**Repo:** `rovaneD/agent7even-v2` (experimental v2). Run `git remote -v` before any push.
**Source audits:** marketing-site audit (homepage→agents→use-cases→pricing→V2), 571-page logged-in screen-by-screen audit (38 screens), SEO Scanner grounding finding, OpenRouter cost run (715 generations), credit-debit code recon.

---

## 0. The one thesis

Both audits independently reached the same verdict from opposite ends:

- Marketing audit, final verdict: the company is **underselling its most differentiated idea** — a marketing OS where a coordinating intelligence layer runs specialist agents, approvals, monitoring, analytics, campaigns, execution.
- Logged-in audit, recurring across 38 screens: **the product is more sophisticated than the UX communicates.**

This is not a product-quality problem. The product is strong. It is a **communication and packaging problem.** Every fix below either (a) makes the real product legible, or (b) reorders information so comprehension precedes the ask. Nothing here invents capability; the performance-theater test governs every claim.

---

## 1. Phase order (gated)

Truth first. Nothing downstream ships until Phase A truth docs are locked and verified.

```
PHASE A — Truth documents (gates everything)
  A1. Positioning lock        [DECIDED — content below]
  A2. Capability ledger       [needs live-page recon before it ships as truth]
  A3. Credit model retune     [DONE — see credit_model_retune_spec.md]
        ↓
PHASE B — Marketing site (stop underselling)
  homepage finish · agents page · use cases · pricing · auth · trial onboarding
        ↓
PHASE C — Logged-in UX + AI interaction (highest retention leverage)
  dashboard cold-open · IA regroup · credits/services clarity · asset lifecycle
  · explainability · situational grounding (own gated workstream)
```

Why this order, not the auditor's numbering: the auditor numbered phases by what they *looked at first*, not what must be *fixed first*. The capability question and positioning tension gate the homepage, pricing, and onboarding — so they resolve first. (Same phase-ordering correction already applied once in this project; positioning/capability truth precedes downstream copy.)

---

## 2. Phase A — Truth documents

### A1. Positioning lock  [DECIDED]

**The collision both audits exposed, and its resolution.**

- Marketing auditor (saw only the site): demote Maya, lead with the OS. "I do not think Maya should be the hero." "People don't buy Siri; they buy the ecosystem."
- Logged-in auditor (saw the live product): when the Maya-activated dashboard loaded — "Primary: Maya Chat. Secondary: Marketing OS. Honestly, I think that's the right decision."

They are not contradicting each other. They are describing **two different surfaces.**

**LOCKED DECISION:**
> **Maya is the interface; the OS is the substance. Which one leads depends on whether the user has signed up yet.**
>
> - **Marketing site (pre-signup): OS-forward.** Lead with the system and the outcome ("marketing gets done without becoming your job"), backed by the nine-agent architecture and the approval framework. Maya is introduced one line down as the director / intelligence layer coordinating the specialists.
> - **Logged-in product (post-signup): Maya-forward.** The chat is the front door; the OS is what she operates. Matches the locked product context.

This preserves the brand constraint (Maya stays the named agent; pink accent stays on the Maya name) while satisfying the marketing auditor's "lead with the bigger story." Headline carries the OS outcome; Maya is named immediately under it.

**Two-ICP note (from Use Cases audit):** the product serves two buyers — survival-driven solo/near-solo SMB (primary) and developed-brand / agency / creator / operator (equally important, media-heavy). Messaging must stop telling the same story four times. Use Cases rebuild differentiates by *which agents matter to whom*, not by stock photo.

### A2. Capability ledger  [GATED ON LIVE RECON]

The single most-repeated finding across the entire corpus: **"Can Maya create images/video, or only copy?"** Marketing audit calls it P0, "affects perceived value 5–10x," "biggest unanswered question across the entire site."

**The logged-in audit answers it: the product generates images, video, weekly plans, captions.** The marketing auditor's "copy-first vs full-creative-agent" dilemma is already resolved by the product — it's closer to full-creative than they could see. The fix is purely: **state on the marketing site what the product already does.**

The ledger is a single table — every capability the site implies, with a hard status (`live` / `partial` / `not built` / `not planned`), verified against the live codebase, not synthesis. **This doc cannot ship as truth until a live-page recon confirms each row.** (Recon prompt scoped separately; same recon-before-edit discipline used throughout this project.)

Capabilities to verify: write posts · generate images · generate video · captions in image context · send/draft emails · schedule/publish · reply to reviews · competitor monitoring · SEO scan · trend spotting · campaign planning · landing pages · ads. The homepage implies all; the ledger states which are real.

### A3. Credit model retune  [DONE]

Fully specified in `credit_model_retune_spec.md`. Summary of the locked decision:

- **Text & Maya chat: free (0 credits).** Text is 20% of real COGS even when every agent ran in one day; metering it creates anxiety on the chat-primary front door for no economic reason.
- **Credits = media meter only.** Standard image **3cr**, standard video **10cr**, publish **1cr**, brand-kit **1cr**.
- **Premium media = ProAgent only.** Premium image (Recraft) **15cr**, premium video (Kling) **40cr**. This is the Growth→ProAgent upgrade reason (quality, not just volume).
- **Tiers unchanged** (100 / 350 / 1000), now re-expressed as media allowances: Starter ≈ 33 images or 10 videos/mo; Growth ≈ 116 or 35; ProAgent ≈ 333 or 100 (+ premium). Text/campaigns/chat unlimited.
- **Worst-case margins: 98% / 95% / 83%** — clears the 80% floor on every tier.
- **Services** = managed human-delivered work (eight-service catalog), tracked in-dashboard. Define plainly; not a credit.
- **Overflow:** monthly refill on billing date (not rolling clock — avoids the Claude-style "blocked mid-week" churn) + optional top-up media packs for heavy ICP.

---

## 3. The seven cross-cutting threads

These recur in **both** audits — spine-level, not screen-level. Each carries a DoD gate.

| # | Thread | Evidence (both audits) | Fix | Gated on |
|---|--------|------------------------|-----|----------|
| 1 | **Creative-capability legibility** | Mkt P0 "5–10x perceived value"; logged-in confirms image/video/plans live | Surface real capability on marketing site | A2 ledger |
| 2 | **Credits + Services black holes** | Mkt: pricing weakest page (5.2); logged-in: "product-wide" on dashboard/pricing/video | Retune + re-express as media allowance; define Services | A3 (done) |
| 3 | **Show the finished artifact** | Both: site shows *process* (queue/approvals), never *output* | Show real email/IG post/review reply/competitor report; add Draft→Approved→Scheduled→Published lifecycle state | A2 |
| 4 | **9-agent architecture underused** | Mkt: Agents page strongest (8.5), "could be an entire section" | Move architecture up-funnel; visual agent map (Maya → 9 specialists) | A1 |
| 5 | **Fake social proof** | Both: Ember Coffee et al. read fake, "remove them" | Remove; replace with honest "Founding Members / Beta" framing or counter — **never fabricated testimonials** | — |
| 6 | **Two-ICP messaging collision** | Mkt Use Cases: serving SMB + agency/creator simultaneously | Differentiate verticals by agent emphasis, not stock photo | A1 |
| 7 | **Situational grounding + actuation** | SEO Scanner screenshot: Maya asks for website URL while a Website URL field sits beside her; logged-in "context awareness"/"explainability" theme | Build-once-at-shell-level: Layer 1 canvas-state context binding (read) → Layer 2 field actuation through approval gate (write) | Phase C; needs write-path confirmation |

**Thread 7 detail (architectural, not screen-level):**
- **Layer 1 — canvas-state context binding (read).** Maya's chat system context must include the live form schema + current field values of the surface she's on, not just the route. Principle: *Maya never asks for what the surface already shows or Foundation already holds.* Already HIGH-priority in MAYA_CONTEXT; the screenshot proves it's unwired for agent setup forms.
- **Layer 2 — field actuation through approval (write).** "Help me fill the form" → Maya proposes field values (from Foundation) as an applyable fill; user confirms. This is the approval queue doing its exact job. Gated on Layer 1 (can't write what you can't see). **Generalizes across every agent setup form — build at the shell, not per-form.**
- **Open input needed:** does Maya's chat runner have a write-back/actuation path today (even for canvas edits)? If yes, Layer 2 is wiring. If output-only, Layer 2 is a new capability. Confirm before Phase C scoping.

---

## 4. Per-screen registry

Full registry (all 42 screens: 38 logged-in + 4 marketing), score + P0/P1/P2 inline, lives in `per_screen_registry.md` (spawned with Phase C; marketing rows usable in Phase B). It is the durable reference Claude Code reads off per screen. Built from the 571-page logged-in audit + the four marketing-page scores. **Status: shipped June 10, 2026.**

Marketing-page scores (for Phase B): Homepage 7.0–7.5 · Agents 8.5 (strongest) · Use Cases 6.0 · Pricing 5.2 (weakest, jumps ahead of Use Cases in priority).

---

## 5. Spawn order

1. **`credit_model_retune_spec.md`** — ready now (Phase A3).
2. **Live-page recon prompt** — unblocks A2 ledger. (recon-only, reports, no edits.)
3. **A2 capability ledger** + **A1 positioning lock** as full handoffs once recon returns.
4. **Phase B** marketing-site handoffs (pricing first — weakest page, and now unblocked by A3).
5. **Phase C** logged-in handoffs + full per-screen registry + Thread-7 grounding workstream.

**Open inputs still needed (non-blocking for A3):**
- Live-page recon (gates A2).
- Maya chat write-path confirmation (gates Thread-7 Layer 2 scoping).
- Starter→Growth non-media differentiator (volume-only today; consider seats/service-requests) — Phase B pricing refinement, not a blocker.
