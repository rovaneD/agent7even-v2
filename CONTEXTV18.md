# CONTEXTV18 — Launch prep, auth/billing hardening, lab5 homepage, vendor gates, cross-tenant fixes
*Snapshot: June 18, 2026 — supersedes `CONTEXTV17.md`*

This document supersedes `CONTEXTV17.md`. Everything in V17 still applies
unless this file explicitly changes it.

Prior session logs: `SESSION_2026-06-14.md` (inbox + Stage 2),
`SESSION_2026-06-11.md` (Foundation safety), `SESSION_2026-06-12.md` (Content Posting merge).

---

## Repository State

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app (+ www.agent7even.ai when DNS pointed)
Branch: main
Latest commits (June 18, 2026):
  a8ee8c6 — GA hostname + source/medium widgets; OAuth reconnect hardening
  ae2d614 — GA OAuth redirect from request host (www.agent7even.ai)
  0eba105 — GA false “access pending” when OAuth refresh fails
  e669826 — remove Zernio vendor branding from analytics UI
  eb3da62 — Zernio OAuth callback public route + multi-profile disconnect
  ca2804d — docs pass (CONTEXTV18, Maya V09, session logs)
  93beb2f — lab5 homepage hero, product widget cards, FAQ
  f8da5dd / 4a6b3f2 / 3f2793a — Stripe checkout hardening
  3d6a007 / 31c44d6 — auth pages aligned to lab5 marketing design
  81cbe2b — Google sign-in profile linking (redirect loop fix)
  27a03c9 — launch prep (Meta disclosure, legal .ai URLs)
June 15, 2026:
  b9c416b — Zernio cross-tenant isolation on shared master key
  29701e8 — mobile inbox thread header/loading fix
  be8fad1 — data deletion page + analytics OAuth/legal updates
  4d974da — Meta domain verification (agent7even.ai)
  5d2dc51 — PRODUCTION_GREENLIGHT.md
  85099c7 — remove hero pill badge
```

Before every push: `git remote -v` must show `rovaneD/agent7even-v2`.

---

## What Shipped Since CONTEXTV17

### June 15 — Zernio cross-tenant isolation (shared master key)

Three cross-tenant holes fixed in `b9c416b`. All verified live against test account
`@rovanedurso` via `scripts/verify-zernio-tenant-fixes.ts`.

| Fix | What changed | Files |
|-----|-------------|-------|
| **Fix 1 — Teardown** | Disconnect + Stripe cancel now loop ALL `zernio_profile_ids[]` (fail-soft per profile); clears both `zernio_profile_id` + `zernio_profile_ids` + `zernio_connected_platforms` | `lib/social/zernioProfileIds.ts` (new helper: `collectZernioProfileIds`, `disconnectAllZernioProfiles`, `ZERNIO_TEARDOWN_COLUMNS`), `disconnect/route.ts`, `webhooks/stripe/route.ts` |
| **Fix 2 — Post IDOR** | GET/PATCH/DELETE `/api/posts/[postId]` now verifies post's `profileId` is in tenant's set before access; fails closed → 404 | `app/api/posts/[postId]/route.ts`, `lib/social/zernioPostsParse.ts` (`readZernioPostProfileId` reads nested `platforms[].accountId.profileId`) |
| **Fix 3 — Account merge** | Removed master-key `listAllAccounts()` merge from `social/route.ts`; accounts now come only from profile-scoped `getProfileAccounts()` | `app/api/analytics/zernio/social/route.ts` |

**Live-discovered during testing (required, not optional):**
- `readZernioPostProfileId` must read `platforms[].accountId.profileId` (not root-level) — Zernio post payloads nest it.
- `teardownZernioProfile()` must disconnect platforms first, then delete profile — Zernio rejects `DELETE /profiles/{id}` while accounts still connected.

**Known limitations (registered, not blockers):**
- Fix 2: no real second-tenant postId collision test yet (single-tenant key); fail-closed is safe direction.
- Fix 1: Zernio `DELETE /profiles/{id}` returned `ok: false` even after platform-disconnect reordering — DB columns cleared correctly (fail-soft), but remote Zernio profile may remain orphaned. Needs follow-up: log actual Zernio error response to diagnose (async race vs missing precondition). Relevant to DPA deletion commitment.

**Rollback note for Fix 3:** if prod shows missing accounts, re-add `listAllAccounts` merge with `profileIdSet.has(a.profileId)` only — never `!a.profileId`.

### June 15 — other platform hardening

| Area | Summary |
|------|---------|
| **Inbox mobile** | `29701e8` — thread view keeps header + loading state visible on small screens |
| **Legal / compliance** | `be8fad1` — `/data-deletion` page + API; privacy/terms/security URLs on `.ai`; analytics OAuth copy |
| **Meta** | `4d974da` — domain verification meta tag for `agent7even.ai` |
| **Launch checklist** | `PRODUCTION_GREENLIGHT.md` — master go-live checklist (Stripe live, Clerk prod, DNS, etc.) |
| **Homepage** | `85099c7` — removed hero pill badge above Meet Maya |

### June 18 — auth, billing, marketing homepage

| Area | Summary |
|------|---------|
| **Auth UX** | `3d6a007`, `31c44d6` — split layout sign-in/sign-up with lab5 marketing panel; matches homepage tokens |
| **Auth fix** | `81cbe2b` — Google sign-in profile linking stops post-OAuth redirect loop |
| **Build fix** | `3f7e1e6` — duplicate `isProductionRuntime` declaration |
| **Launch prep** | `27a03c9` — Meta connect disclosure, inbox analytics notes, legal `.ai` URL alignment |
| **Stripe checkout** | `3f2793a`, `4a6b3f2`, `f8da5dd` — accounts without plan, stale test customer IDs, invalid header chars on secret key |
| **Homepage hero** | `93beb2f` — Meet Maya typography (pink on Maya only), two-line deck in `#838B97`, body/join CTAs, blue primary + ghost secondary, Metaballs retained |
| **Dashboard showpiece** | Increased `.showpiece` bottom padding (80px desktop) before trust strip |
| **Feature / use-case cards** | Cropped mini product UI widgets via `data-mk="widget-*"` — clipped inside card (`overflow: hidden`), left/bottom inset, zoomed mockup |
| **Mockup chrome** | `public/agent7even_mark.svg` — circle mark in mockup sidebars (`mockups.js`, `agent-mockups.js`, `usecase-mockups.js`) |
| **FAQ** | Scheduling-tool answer — Maya plans, writes, runs campaigns, queues for approval; user brings visuals |
| **Meta description** | `app/page.tsx` — "posts queued" (not "content posted") |

### June 18 (evening) — Analytics dashboard, Zernio connect, GA OAuth

| Area | Summary | Key files |
|------|---------|-----------|
| **Zernio disconnect** | `disconnectPlatformFromTenant()` searches all tenant profile IDs; API syncs `zernio_connected_platforms`; UI checks response + refetches accounts | `lib/social/zernioProfileIds.ts`, `app/api/integrations/zernio/disconnect/route.ts`, `AnalyticsClient.tsx` |
| **Zernio OAuth callback** | `/api/integrations/zernio/callback` added to public routes in `proxy.ts` — fixes Clerk blocking Facebook redirect → sign-in loop | `proxy.ts`, `lib/oauthCallbackBase.ts` |
| **Vendor white-label** | Removed user-facing “Zernio” from analytics empty states, connect errors, X cost modal | `AnalyticsClient.tsx`, `app/api/integrations/zernio/connect/route.ts`, `disconnect/route.ts` |
| **GA access pending bug** | OAuth-connected tenants no longer fall back to service account when refresh fails — shows reconnect instead of false “access pending” | `app/api/analytics/ga-data/route.ts` |
| **GA OAuth redirect** | Callback URL derived from request host (`oauthCallbackBaseFromRequest`) — fixes `redirect_uri_mismatch` when `NEXT_PUBLIC_APP_URL` stale | `lib/oauthCallbackBase.ts`, `ga-connect/route.ts`, `ga-callback/route.ts` |
| **GA reconnect** | Revoke stale refresh token before OAuth; surface `invalid_client` / token exchange errors; `prompt=consent select_account` | `ga-connect/route.ts`, `ga-callback/route.ts`, `AnalyticsClient.tsx` |
| **GA tab widgets** | **Hostnames** + **Session source / medium** per connected property (all tenants with GA linked) | `ga-data/route.ts`, `AnalyticsClient.tsx`, `lib/analytics/mockData.ts`, `lib/maya/summaries/analyticsContext.ts` |

**GA architecture (unchanged principle):** each tenant’s profile stores `ga_measurement_id` + `ga_refresh_token`; `/api/analytics/ga-data` queries **their** GA4 property only. App-wide gtag `G-8913QV8Z1M` in `app/layout.tsx` tracks Agent7even app usage on the operator property — separate from customer-connected properties.

**Production ops (manual, not in repo):**
- GCP OAuth client must list `https://www.agent7even.ai/api/analytics/ga-callback` under authorized redirect URIs.
- Vercel Production: `GOOGLE_OAUTH_CLIENT_SECRET` must match current GCP secret (dashboard masks value — re-paste full `GOCSPX-…` from GCP after rotation).
- `NEXT_PUBLIC_APP_URL` should be `https://www.agent7even.ai`.

**Verified on operator account (June 18):** property `538544424` / `G-8913QV8Z1M` — live GA tab after reconnect; traffic mostly app routes + Clerk/Vercel referrers (dev/testing, not customer acquisition yet).

---

## Marketing site (lab5) — file map

Root `/` is the lab5 homepage:

| Path | Role |
|------|------|
| `app/page.tsx` | Re-exports `app/lab5/page.tsx` + metadata |
| `app/lab5/page.tsx` | Homepage JSX (hero, sections, FAQ) |
| `app/lab5/styles.css` | All `--l5-*` tokens + `.lab5` layout |
| `app/lab5/MarketingNav.tsx` | Shared nav |
| `app/lab5/SafeMetaballs.tsx` | Metaballs error boundary |
| `public/lab5/mockups.js` | Full mockups + `widget-*` card snippets |
| `public/agent7even_mark.svg` | Circle logo for mockup rails |
| `public/agent7even_logo.svg` | Full wordmark for nav |

**Hero CSS hooks:** `.hero-title`, `.hero-title-deck-line`, `.hero-body`, `.hero-link`, `.showpiece`, `.btn-hero-primary`.

**Card widgets:** `.lcard` / `.use` → `.lcard-copy` / `.use-copy` + `.card-widget` with `[data-mk="widget-…"]`. Mockup keys: `widget-campaign`, `widget-competitor`, `widget-reputation`, `widget-voice`, `widget-use-ecommerce`, `widget-use-local`, `widget-use-creators`, `widget-use-agencies`.

**Visual rules (marketing):** primary blue `#3B82F6`; pink `#F5349B` on Maya/logo moments only; white cards, no grey card fills; cropped UI peeks at card bottom.

---

## Vendor gates — June 18 status

### EnsembleData — CLEARED

Written confirmation from support (email, not contractual amendment — save the email):
- Storing data + deriving insights + showing on platform is permitted on any monthly plan.
- Stage 1/3 (competitor outlier intelligence) can un-park into build.
- **Mandatory constraint:** stagger tenant refreshes across the week (daily unit ceiling resets 00:00 UTC). Batching all refreshes = ~$1,400/mo at 1k users; staggered = ~$400/mo. Bake the stagger constraint in from the first line of the build.
- Public-scraped-data posture accepted as recorded decision.

### Zernio DPA — IN PROGRESS

- **Trust center:** `trust.zernio.com` — real compliance program (25 policies, 36 controls, GDPR compliant, SOC 2 Type 2 Jan–Apr 2026 by Securance Pro — clean, no exceptions).
- **Real sub-processor stack** (from SOC 2, not trust center which showed "0"): Google Cloud, Vercel, Cloudflare, MongoDB, PostHog, Resend, Stripe.
- **DPA reviewed** (`Data-Processing-Agreement-ARBICHAT.pdf`, pre-signed by Miquel Palet/CEO, 20/03/2026). Core protections present. Three items need resolution before signing:
  1. **§13 governing law/jurisdiction is BLANK** — do not sign with this empty; Elean said "fill in as you see fit" but this is a real legal decision (Spanish law? California?). Needs lawyer input.
  2. **§5 subprocessing thin** — no list, no flow-down, no advance-notice right; DPA says "no sub-processor without authorization" but doesn't list the real stack. Flag in clarification email.
  3. **Missing processing schedule/annex** — DPA references Schedules but none attached; needs data categories, data subjects, purpose, duration.
- **DPA clarification email sent to Elean** — covers all four items (§13, §5 sub-processors, missing annex, company name in preamble).
- **Lawyer review needed on §13 specifically** — runs in parallel, not a build blocker.
- **Real client onboarding still gated** on signed DPA. Test accounts (free tier) only until cleared.

### Zernio scoped-key question — PENDING (Phase 2 gate)

Elean said "you could generate your own API keys scoped to a single profileId." Before building the scoped-key migration (Phase 2), need written confirmation:
1. Mint endpoint for profile-scoped keys.
2. One key maps 1:1 to one profileId?
3. **Written isolation guarantee** — scoped key cannot read/write other profiles' posts/accounts/inbox/media.
4. Lifecycle: rotate/revoke; does `DELETE /profiles/{id}` invalidate the key?
5. Migration: retroactive minting for existing connections?

Do NOT build Phase 2 until question 3 is answered in writing.

### Zernio Meta OAuth — OPEN PROBLEM (BYOK confirmed no-go)

**Discovered June 18:** During Instagram/Facebook OAuth, Meta shows "Social Media Connector" (Zernio's underlying app name) as a clickable link → `zernio.com/login`. End users don't have Zernio accounts; this breaks trust at the most sensitive moment.

**Zernio's confirmed position:**
- Meta controls the app name/link on the consent screen; Zernio cannot rebrand per-customer.
- **BYOK for Meta is a confirmed no-go** — not on roadmap. BYOK exists only for X/Twitter on AppSumo accounts. No Meta equivalent planned.
- Feature request logged at `zernio.featurebase.app` for tracking.

**Active mitigation (shipped):** disclosure copy added to the Meta connect flow:
> "Instagram, Facebook, and Threads use Meta's authorization screen. It may show 'Social Media Connector' — that's our publishing partner verifying access, not a separate login. Click Allow; don't click the app name link."

This is honest, accurate, and works for users who trust you before connecting. It does not fix the underlying trust gap for cold/skeptical users.

**Still-open question to Zernio (not yet sent):** "If we handle Meta OAuth ourselves with our own Facebook app and obtain the access token directly, can we pass that token to Zernio to create/link a profile?" This determines whether Option A (own Facebook app) is viable as a real fix.

**Options ranked:**
- A (real fix): Own Facebook app → own consent screen → pass token to Zernio if their API accepts external tokens. Viability unknown — needs the answer above.
- B (roadmap): Zernio BYOA for Meta — feature-requested; timeline unknown.
- C (mitigation): **ACTIVE** — disclosure copy shipped June 18. Works for trusting early users; not a solution at scale.
- D (defer): Avoid Meta for now, use non-affected platforms.

**Next step:** ask Zernio the token-passthrough question to determine if Option A is viable.

---

## Competitive intelligence — June 18

### Vibiz (vibiz.ai) — closest competitor

- **Pricing:** Plus $24/member/mo (100 credits, 10 posts), Pro $40 (250, 50), Ultra $64 (unlimited posts). Hidden: 2% fee on ad spend deployed through autopilot.
- **Per-member vs Maya's bundled seats:** at 3+ people Maya's pricing converges or wins.
- **Maya's wedges vs Vibiz:** (1) control/approval queue vs autopilot — Vibiz auto-deploys ad spend and takes 2%; Maya approves everything and charges no cut. (2) Foundation depth vs URL-scrape — IF output quality is provably better.
- **"Business in a box" concern:** Vibiz generates full funnel from one URL extraction. Output quality unknown from marketing site alone — needs real test.
- **Decision:** don't race price or breadth. Maya is the premium option; quality/trust must carry the premium.
- **Backlog:** run a throwaway business through Vibiz (not Agent7even — competitor would ingest the URL); compare output quality against Maya's Foundation-grounded output as empirical test of the core differentiator.

---

## Creative generation spike — June 18 findings

Throwaway spike `spikes/foundation-creative-ab/` — nothing wired into app.

**What ran:** real Agent7even Foundation → Claude brief → images (Gemini 2.5 Flash Image + 3.1 Flash Image Preview) + video (Veo 3.1 Lite + Veo 3.1). ~$3.68 video cost. A/B: Arm A grounded (real Foundation) vs Arm B shallow (URL-scrape proxy).

**Image — CONDITIONAL GO:**
- Grounded beats shallow on 3/3 concepts; 2 Arm A outputs near-publishable (carousel + quote card).
- Blockers: text QA (typos, wrong brand names), human-pick-from-3 not one-click autopost.
- Feature shape: Maya brief → generate 3 options → user picks → text QA gate → approval queue → publish.
- **Not Vibiz autopilot** — control queue is the wedge, preserved by design.

**Video — NO-GO (for now):**
- Briefs A≫B on both modalities — Maya's Foundation→brief composition is sound.
- Video rendering: uncanny faces, gibberish text in frame, no Agent7even visual system. Not publishable.
- **Root cause: model quality ceiling, not Maya capability gap.** Recheck when video models improve.
- Composition work is not wasted — it's ahead of the renderer.

**Critical spike insight:** video/image models perform best when fed reference assets + structured scene-direction prompt, not Foundation text alone. Maya's real differentiator is the **translation layer**: Foundation identity + user's real assets → structured generation input the model actually needs. That translation layer (not the model) is the defensible edge over thin-input competitors.

**Generation gating (product principle):** generation features should gate on Foundation strength. Weak Foundation → block with specific actionable message pointing to weak section → strengthen Foundation → unlock. Threshold empirical, not hardcoded; gate on sections relevant to the agent (Voice/Position/Customer), not global score. Server-enforced, not just UI.

**Generalised Foundation-relevance gradient (broader principle — see Foundation section below):** generation is the hard-floor exception; most agents run in trial/weak-Foundation mode but produce sharper output as Foundation strengthens.

---

## Foundation vision — major rethink (June 18, NOT yet built)

**Current state:** Foundation is a static scored form — a one-time intake artifact. It scores well but doesn't compound.

**Vision (decided, not yet documented in a dedicated doc):**

- **Phase 1 = guarded bedrock.** First contact with the business. Protected by the contamination fix (never overwritten silently, single-snapshot undo). Always used as the reference frame. Never disregarded.
- **Phases stack accretively on top.** As Maya observes the user's decisions (approve/reject/edit signals), learning forms new layers above Phase 1. Not edits to Phase 1 — layers above it.
- **Learning signal = user decisions.** Available now, ungated by vendors. Every approve/reject/edit is a signal about who this business actually is. Performance data (Zernio/EnsembleData) enriches later phases but isn't required to start.
- **Mechanism = changelog that surfaces as proposals.** Maya keeps running notes on the side; periodically formalizes observations into proposals the user reviews. Approved proposals become new Foundation layers. Silent writes never happen — the approval queue applied to Foundation's own evolution.
- **Maya = the maestro.** Foundation isn't a document Maya reads — it's the score. Phase 1 is the key the piece is written in; stacked phases are movements that develop the theme; Maya conducts agents to play it.
- **The moat:** a competitor can copy Phase 1 (onboarding form). They cannot copy the stack — months of accreted, decision-trained, business-specific intelligence that's path-dependent. That's the thing that makes "persistent intelligence" structurally true instead of marketing copy.
- **The open hard problem (drift prevention):** how does Maya distinguish real identity-signal from noise so accretive learning doesn't become accretive drift? Phase 1 acts as the anchor/reference frame that proposals are checked against. A proposal that contradicts Phase 1 core should face a much higher bar. This is the central engineering challenge — not yet designed.

**Status:** vision held and agreed; no doc written yet. Write the Foundation vision doc with a clear head before the generation handoff (generation work is downstream of Foundation design). The generation handoff waits until the Foundation vision is documented.

**Trial-mode / Foundation-strength gradient (agreed):**
- Trial = deliberately ungated explore mode. Agents run so users feel value immediately (no activation cliff).
- Product is explicit: "this is preview quality; Maya gets sharper as you build Foundation."
- Framing turns the limitation into the conversion hook — not "the product is weak," but "here's how good it gets."
- **Exception:** generation (image/video) keeps a real minimum-strength gate even in trial — a bad reel is worse than none, unlike a rough text draft the user can edit.

---

## SQL migrations — unchanged from V17

| File | Purpose | Status |
|------|---------|--------|
| `18_idea_analysis_skill.sql` | Idea Analysis agent skill | **Run if not applied** |
| Prior migrations | See `CONTEXTV17.md` | Applied in prod |

---

## Open backlog (carried + new)

1. **Zernio DPA** — lawyer review §13 (parallel, not a build blocker); DPA clarification email sent to Elean; sign once §13 resolved. Real client onboarding gated.
2. **Zernio Meta OAuth** — "Social Media Connector" on Meta consent screen; BYOK for Meta confirmed no-go. Disclosure copy shipped as active mitigation. Still need to ask Zernio: "Can we pass our own Facebook app's OAuth token to Zernio to link a profile?" — that answer decides Option A (own Facebook app) viability as the real fix.
3. **Zernio scoped-key migration (Phase 2)** — gated on written isolation guarantee from Zernio (question 3 in scoped-key email). Do not build until confirmed.
4. **Zernio orphan profile on disconnect** — `DELETE /profiles/{id}` returns `ok: false` even after platform-disconnect reordering; remote profile may remain. Log actual Zernio error to diagnose. Relevant to DPA deletion commitment.
5. **EnsembleData Stage 1/3 build** — unparked, CLEARED. Stagger constraint mandatory (bake in from line 1). Build when sequencing allows.
6. **Foundation vision doc** — write with clear head before generation handoff. The generalized model: Phase 1 bedrock / accretive proposal-based phases / decision-signal learning / drift-prevention as central challenge / Maya as maestro.
7. **Creative generation handoff** — downstream of Foundation vision doc. Image GO (brief → 3 options → pick → QA → approval → publish); Video NO-GO (model ceiling, recheck later); Foundation-strength gate; relevance gradient; 100-video format library as Meaning 1 (prompt composition, not fine-tuning). Not a build tonight — validated roadmap entry.
8. **Inbox B4.1** — Maya draft-reply in composer (optional).
9. **In-app comment replies** — blocked on Zernio per-comment thread API.
10. **Competitor post-level metrics (CONDITIONAL GO)** — Stage 1/3 parked; see `backlog_gate_competitor_reach.md`.
11. **Zernio native publish → analytics** — confirm sync before trusting best-post.
12. **Engagement cron** — never ran in v2.
13. **Post media Phases A–C** — `post_media_expansion_handoff.md`; gated on generation vision.
14. **Port to agent7even-app** — separate repo; live Stripe, crons, full QA.
15. **Show the artifact, not the description** — partial progress June 18 (homepage cards); Viktor principle still applies to product UI and remaining marketing surfaces.
16. **Production greenlight** — `PRODUCTION_GREENLIGHT.md` (Stripe live, Clerk prod, Resend domain, DNS cutover).
17. **Vibiz output-quality test** — run throwaway business through Vibiz; compare grounded Foundation output vs URL-scrape output side by side. Answers whether Maya's premium pricing is justified by visibly better output.

**Closed since V17:** auth redirect loop; three Stripe checkout edge cases; lab5 homepage hero + card widgets; Zernio cross-tenant isolation (three holes, all verified live); Zernio OAuth callback sign-in loop; analytics vendor branding in UI; GA false access-pending + redirect_uri_mismatch + reconnect flow; GA hostname/source widgets on analytics tab.

---

## Current docs to read first

| Priority | Doc |
|----------|-----|
| Technical state | `CONTEXTV18.md` (this file) |
| Prior technical | `CONTEXTV17.md` |
| Maya product rules | `MAYA_CONTEXT_V09.md` |
| Go-live checklist | `PRODUCTION_GREENLIGHT.md` |
| Inbox build record | `zernio_inbox_phase_b_plan.md` |
| Stage 2 build record | `stage2_idea_analysis_plan.md` |
| June 18 session | `SESSION_2026-06-18.md` |
| June 14 session | `SESSION_2026-06-14.md` |
| Audit ledger | `AUDIT_FIXES_2026-06-02.md` |

Superseded for latest state: `CONTEXTV17.md`, `MAYA_CONTEXT_V08.md`.

---

*Last reviewed: June 18, 2026 (evening — analytics/GA pass consolidated)*
