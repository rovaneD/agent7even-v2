# Phase B — Homepage + Agents Page Handoff

**Status:** ready. Unblocked now (gates A1 + A2 are locked; does NOT depend on credit retune).
**Repo:** `rovaneD/agent7even-v2`. Run `git remote -v` before any push. This is v2/lab5, not production.
**Gating docs (read first):** `a1_positioning_lock.md`, `a2_capability_ledger.md`. They are truth. If the live page contradicts them, the page is what we're fixing.

**Why this runs before pricing:** the live site currently makes claims the product does not back (fake "answers reviews," fictional Reputation agent, "runs ads," "monitors live"). These are performance-theater violations live right now. They get fixed here, with no dependency on credit-code changes. This is the most urgent copy work on the site.

**Scope guard:** copy + positioning + structure only. No credit numbers (that's pricing, gated on A3). No brand-system changes (Maya stays named; pink stays on the Maya name only). No new components unless a section move requires one.

---

## Step 0 — Structure recon (REQUIRED before any edit)

Do not edit from memory. Map first.

- Confirm `git remote -v`, branch, `git log -1 --oneline`.
- Find and report the real files: homepage (`app/lab5/page.tsx` or wherever `/` renders) and agents page (`app/lab5/agents/page.tsx`).
- For EACH page, list sections in render order with the component/file each comes from.
- Locate and quote the exact strings for every item in the "claims to fix" list below, with file + line. If a claimed string isn't present, say so — it may have moved or already changed.
- Report back this map, THEN proceed to edits. (If running solo, just continue; if a human is reviewing, this is the checkpoint.)

---

## Step 1 — HOMEPAGE edits

### 1a. Hero → OS-forward (A1)
- Lead with the system + outcome, Maya named one line under. Category = **AI Marketing Operating System**.
- Jobs-to-be-done frame should dominate: **"Marketing gets done without becoming your job."**
- Keep Maya named in the subhead (brand constraint). Do NOT demote Maya to a footnote; do NOT remove the name.
- Direction (not final copy — write to fit the page's voice):
  - Headline: outcome/OS-forward (e.g. "Your marketing, run for you" / "Marketing gets done. Without becoming your job.")
  - Subhead: "Meet Maya — the intelligence layer coordinating [N] specialist agents that plan, write, and queue your marketing for approval."
- CTA: keep existing trial CTA. (Education-before-conversion CTA test is a later optimization, not this pass.)

### 1b. Capability copy → true boundary (A2 claims table)
Apply the claims table verbatim in intent:
- **"sends emails"** → "drafts your email campaigns"
- **"posts / schedules for you"** → "drafts and queues for your approval; you publish in a click"
- **"monitors competitors" / "tracks live"** → "competitive reports from your Foundation"
- **"tracks trends"** → "trend reports"
- **"runs ads"** → "writes ad variations to test"
- **"answers reviews"** → REMOVE entirely from capability copy. (Roadmap only — see 1d.)

### 1c. Add underclaimed capabilities (A2 — the "stop underselling" half)
The product does more than the site says. Surface, accurately:
- **Image generation** — "generates images in your brand style" (env-gated live; claimable).
- **Video generation** — "generates short videos" (env-gated live; claimable).
- **In-context captions** — "reads your image and writes the caption."
- **Approval framework** — elevate as the core trust mechanism. This is the strongest asset both audits named. "Nothing goes live without your approval" should be prominent, not buried.

### 1d. Reviews → roadmap partition (A2 §4)
- Remove from all present-tense capability surfaces.
- If reviews appears at all, it must be in a clearly-future/roadmap context, visually + structurally separate, no present-tense verbs, no "coming soon" badge. Cleanest option: omit entirely from this pass.

### 1e. Do NOT claim revenue attribution (A2 §5)
- Stripe is billing-only; no Shopify/commerce integration. Remove or avoid any "connect your revenue / track revenue" implication. "Engagement" outcomes (reach, followers, DMs) are the honest deliverable — use those.

### 1f. Trust strip (both audits)
- Remove fictional logos (Ember Coffee, Atlas Studio, Maker & Co, Field Goods, Northline).
- Replace with honest framing ("Founding members" / "Early access") OR remove until real proof exists. **Do NOT add fabricated testimonials.** Fake-looking proof hurts more than none.

---

## Step 2 — AGENTS PAGE edits

### 2a. Correct 9 → 12 agents (A2 §3) — highest-priority factual fix
- The page claims "nine agents." Code has **12 registered.** Correct the count and the roster.
- **Remove "Reputation & Follow-up"** — it is a fictional agent (no registry entry, mockup only).
- The 12 real agents (with autonomy tag — surface the autonomous/approval split, it's a top trust mechanism):
  - content_posting (approval), campaign_builder (approval), email_sequence_builder (approval), ad_variations (approval), idea_analysis (approval), post_caption (approval, legacy), weekly_content (approval, legacy)
  - competitor_watcher (autonomous, weekly), performance_digest (autonomous, daily), trend_spotter (autonomous, daily), seo_scanner (autonomous, weekly), brand_voice_guardian (autonomous)
- If surfacing all 12 is too dense, lead with the Command-Center-visible set, but the COUNT and the named agents must be real. No fictional entries.

### 2b. Fix false autonomy claims (A2 §3)
- **"Weekly Content runs automatically"** → it's approval-required, no schedule. Correct to approval, OR move Weekly Content's function under content_posting (which is how the product folds it).
- **"Maya runs brand-voice review on every draft"** → brand_voice_guardian is a separate autonomous agent, not auto-invoked per output. Correct the claim.

### 2c. Elevate the architecture (A1 + audit)
- This is the strongest page on the site (scored 8.5). Lead with the Maya-as-director → specialists structure. Make the autonomous-vs-approval framework a core, visible element (both audits: this is a top differentiator most AI products hide).
- Agent verbs must match A2 boundaries (reports, drafts, writes — not monitors-live, sends, runs).

### 2d. Analytics framing (marketing audit)
- If the page introduces analytics, frame as **"Marketing Intelligence"** / outcome language ("know what's working"), not raw "analytics." Do not claim revenue attribution.

---

## Step 3 — Definition of done

- [ ] Step 0 structure map produced; edits bound to real locations.
- [ ] Every "claims to fix" string rephrased to its A2 true boundary; none of the six overclaim verbs (sends/posts-for-you/monitors-live/tracks-live/runs-ads/answers-reviews) remain in present-tense capability copy.
- [ ] "Answers reviews" + fictional "Reputation & Follow-up" removed everywhere.
- [ ] Agent count corrected to 12 real agents; autonomy claims accurate.
- [ ] Image gen, video gen, in-context captions, approval framework added/elevated.
- [ ] No revenue-attribution claim anywhere.
- [ ] Fictional trust logos removed; no fabricated testimonials added.
- [ ] Hero is OS-forward with Maya named in subhead; brand constraints intact (Maya named, pink on Maya name only).
- [ ] No credit numbers touched (pricing handoff owns those).
- [ ] Verified against the live rendered page, not just the source — view the page after edits.

**Performance-theater final check:** after edits, re-read every capability claim on both pages and confirm each maps to a `live` or correctly-rephrased `live-narrower` row in A2. Any claim that doesn't map to a backed row is a violation — remove or rephrase it.
