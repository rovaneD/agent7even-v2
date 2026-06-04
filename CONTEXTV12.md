# CONTEXTV12 - Merge Complete, Foundation-to-Pricing, and Maya Billing Flow
*Snapshot: June 4, 2026*

This document supersedes `CONTEXTV11.md`. Everything in V11 still applies
unless this file explicitly changes it.

## Repository State

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app
Current branch history: design-system/color-tokens merged into main
Production repository: rovaneD/agent7even-app - do not touch from this folder
```

Before every push:

```bash
git remote -v
```

The remote must show `rovaneD/agent7even-v2`.

---

## What Changed Since CONTEXTV11

The design-system branch has been merged into `main`. The merged state now
includes the latest visual-system pass plus the onboarding and Maya flow
corrections that were added after the original V11 snapshot.

Key changes:

- `main` now contains the `design-system/color-tokens` merge commit.
- Foundation completion no longer dumps no-plan users back to Dashboard.
  Successful Foundation generation routes no-plan users to
  `/pricing?foundation=complete` so they can choose a subscription tier.
- Maya no-credit states no longer appear as a normal assistant response.
  Both the embedded Maya panel and the `/maya` shell now open a plan/credits
  modal with a direct CTA.
- Existing plan users are routed to Billing / credit top-up from the Maya
  modal. Users without a plan are routed to Pricing.
- The Foundation flow remains platform-funded before checkout, so setup can
  complete without charging the new user first.
- Documentation was refreshed so the repository pointers now reference the
  latest versioned Maya and technical context files.

---

## 1. Visual System Status

The merged branch keeps the established design-system rules from V11:

- Blue is the primary interaction color.
- Pink is reserved for the logo and restrained accent moments.
- Standard cards use the restrained white bordered treatment.
- Dashboard Command Center and Agents Command Center remain the intentional
  soft-shadow hero exceptions.
- Centered page canvases with internally left-aligned content remain the
  standard layout pattern.

## 2. Onboarding and Billing Flow

Foundation generation is allowed before checkout using the platform-funded
runner path.

The end states are now:

- Selected plan exists: continue to `/checkout-now?plan=...`
- No selected plan: continue to `/pricing?foundation=complete`

Maya credit gating behavior:

- No plan: show Pricing CTA
- Existing plan: show Billing / add-credits CTA

This keeps the new-user path explicit and prevents a failed chat response from
being treated like a valid product state.

## 3. Merge Verification

Verified locally before pushing `main`:

```bash
npx tsc --noEmit
git diff --check
npm run build
```

`npm run build` required sandbox escalation because Turbopack needs to bind
local worker ports during the build.

## 4. Current Source Files

The latest docs to read are now:

- `CONTEXTV12.md`
- `MAYA_CONTEXT_V03.md`
- `AUDIT_FIXES_2026-06-02.md`

## 5. Current Priority

The merge is complete. The next work should be normal feature or QA follow-up
on top of `main`, not more branch reconciliation.

---

## X.1 What Exa Is (and why it's here)

Exa is an AI-native web search + content-retrieval API. It is a SERVER-SIDE intelligence
layer, not a user-facing connector: a single platform API key, called from our backend,
invisible to users, no per-client account, no OAuth. This is the opposite of the social
publishing integrations (Buffer is ruled out; Zernio is the social-scheduling candidate —
see X.6 — Exa is unrelated to it).

Exa's role: take Maya's agents and flows from "generates from training data" to "generates
from current, cited reality." That grounding is the differentiator for an SMB tool whose
target market distrusts generic AI output.

Endpoints used: /search (type auto|fast|deep...) with optional outputSchema for grounded
structured JSON + field-level confidence in output.grounding; /contents (SDK getContents)
for clean text/highlights of known URLs.

Pricing posture: free tier covers 1,000 requests/month — enough to validate the first build
at zero cost. Usage-priced thereafter (~$7/1k search, ~$1/1k contents).

---

## X.2 Dependency, env, init pattern

- Dependency: exa-js (`npm install exa-js`).
- Env vars: `EXA_API_KEY` (server-side only, never client-exposed); `NEXT_PUBLIC_EXA_PREFILL_ENABLED` (kill switch for the Foundation pre-fill test).
- Set both in Vercel PREVIEW and PRODUCTION scopes (per the preview-env rule; one-scope-only breaks the other).
- Deferred init: instantiate the Exa client inside the function call, NOT at module-eval time — same discipline as Stripe/Resend. A missing key must not break the preview build.

---

## X.3 Architecture: a shared grounding layer, not per-feature bolt-ons

Exa grounding is a HORIZONTAL capability. The clean implementation is one reusable lib that
any agent/flow calls — not ad hoc Exa calls scattered per feature.

    lib/research/exa.ts
      exaReadSite(url)            -> getContents, top-level options, text capped ~4000 chars
      exaFindCompetitors(seed)    -> search type auto, contents.highlights
      (future) exaSearchTopic(q)  -> grounded topic/trend retrieval for content agents
      (future) exaResearchCompany -> structured company intel for competitor/trend agents

Rules:
- Every function fails soft (returns null/[] on error, never throws). Callers never break the user flow on a research failure.
- Paid Exa spend logged as its own ledger line via `lib/credits.ts` helpers (deductCredits/refundCredits → atomic RPCs). Never raw credit_ledger inserts. NOTE: the Foundation pre-fill is platform-funded onboarding (no user-credit dependency) — it runs at cost 0 during the test and does not touch credits until it graduates to a paid surface.
- Grounding is opt-in per agent and TIERED on the existing run tiers: Light = no grounding; Standard = single grounded retrieval; Deep = multi-source / outputSchema synthesis. Gives run tiers real cost differentiation.
- On /search, content options nest under `contents`. On getContents they are top-level. Do not mix the two shapes.

---

## X.4 Template → Agent map (roadmap, post-validation)

Exa publishes use-case templates that map ~1:1 onto the existing nine agents. Rollout order
for grounding AFTER the Foundation pre-fill test validates value. Do not build ahead of it.

| Exa template | Maya agent | What grounding adds |
|---|---|---|
| Fetch URL Content | (Foundation pre-fill) | Read the user's own site — the first build |
| Generated Social | content_writer | Posts grounded in a current topic/trend |
| Generated Ad | ad_copy_generator | Ads grounded in real web facts; helps satisfy no-unsubstantiated-claims constraints |
| Generated Page | seo_scanner | SEO/landing pages grounded in fresh source material |
| Outbound Research | competitor_watcher / trend_spotter | Structured, current company/market intel |
| Generated Email | email_sequence_builder | Topic/business grounding ONLY — never research individual recipients (privacy line) |
| CRM Enrichment | (none today) | Park — only if Maya ever holds contact/account lists |

The Email case must ground on topics/business, NOT facts about individual recipients — that crosses into people-search/privacy territory and conflicts with the email agent's constraints.

---

## X.5 Work-queue placement

Sequenced AFTER the CONTEXTV12 post-merge QA follow-ups (visual QA, admin visual pass,
typography/dense-row QA). Queue:

| Item | Status |
|---|---|
| Exa Foundation pre-fill (A/B value test) | NEXT FEATURE (after post-merge QA) |
| Exa grounding layer — fleet-wide (`lib/research/exa.ts` shared fns + tiering) | BACKLOG — gated behind the pre-fill result |
| Grounding rollout per template→agent map (content_writer first) | BACKLOG — gated behind the pre-fill result |

Build detail: `exa_foundation_prefill_handoff.md`. Decision gate: the fleet-wide layer is
justified only if the pre-fill A/B shows a clear lift on Foundation completion + first-pass
score with no latency/quality regressions. Flat result → kill the flag, do not proceed.

---

## X.6 Buffer (settled) and the social-scheduling path

Buffer is confirmed OUT for multi-tenant publishing (verified June 4, 2026): legacy REST
OAuth is closed to new developer app registrations (no new client_id); the new GraphQL API
is personal-key-only beta with no third-party end-user OAuth. No path for Maya's users to
connect their own socials through Maya via Buffer. Publer is dashboard-first, also not a
multi-tenant fit.

The replacement is tracked as an EVALUATION (not a build) in `zernio_social_evaluation_backlog.md`:
Zernio is the leading candidate (multi-tenant OAuth-as-a-service, white-label, per-account
pricing, publish/fail webhooks), gated behind vendor questions (tenant isolation [open], cost
caps [answered: Stripe global cap + our own per-tenant throttle], support/reliability,
data-handling/DPA) AND behind the Exa pre-fill value test. Build behind a swappable
`lib/social/publisher.ts` interface. Unrelated to Exa — Exa grounds content; it does not
publish. Apply the AGENTS.md Buffer-rule patch (`AGENTS_md_patch.md`).
