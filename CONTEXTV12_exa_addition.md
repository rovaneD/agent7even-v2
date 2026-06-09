# CONTEXTV12 - Addition: Exa Web-Grounding Integration
*Append to CONTEXTV12.md (current) or its successor. Snapshot: June 4, 2026 (post-merge).*

Adds Exa (https://exa.ai) as a new external capability. Does not change any prior CONTEXTV12
decision. Canonical Exa reference for build-time:
https://docs.exa.ai/reference/search-api-guide-for-coding-agents

---

## X.1 What Exa Is (and why it's here)

Exa is an AI-native web search + content-retrieval API. It is a SERVER-SIDE intelligence
layer, not a user-facing connector: a single platform API key, called from our backend,
invisible to users, no per-client account, no OAuth. This is the opposite of the social
publishing integrations (Buffer is ruled out; Zernio is the social-scheduling candidate -
see X.6 - Exa is unrelated to it).

Exa's role: take Maya's agents and flows from "generates from training data" to "generates
from current, cited reality." That grounding is the differentiator for an SMB tool whose
target market distrusts generic AI output.

Endpoints used: /search (type auto|fast|deep...) with optional outputSchema for grounded
structured JSON + field-level confidence in output.grounding; /contents (SDK getContents)
for clean text/highlights of known URLs.

Pricing posture: free tier covers 1,000 requests/month - enough to validate the first build
at zero cost. Usage-priced thereafter (~$7/1k search, ~$1/1k contents).

---

## X.2 Dependency, env, init pattern

- Dependency: exa-js (npm install exa-js).
- Env vars: EXA_API_KEY (server-side only, never client-exposed); NEXT_PUBLIC_EXA_PREFILL_ENABLED
  (kill switch for the Foundation pre-fill test).
- Set both in Vercel PREVIEW and PRODUCTION scopes (per the preview-env rule; one-scope-only
  breaks the other).
- Deferred init: instantiate the Exa client inside the function call, NOT at module-eval time -
  same discipline as Stripe/Resend. A missing key must not break the preview build.

---

## X.3 Architecture: a shared grounding layer, not per-feature bolt-ons

Exa grounding is a HORIZONTAL capability. The clean implementation is one reusable lib that
any agent/flow calls - not ad hoc Exa calls scattered per feature.

    lib/research/exa.ts
      exaReadSite(url)            -> getContents, top-level options, text capped ~4000 chars
      exaFindCompetitors(seed)    -> search type auto, contents.highlights
      (future) exaSearchTopic(q)  -> grounded topic/trend retrieval for content agents
      (future) exaResearchCompany -> structured company intel for competitor/trend agents

Rules:
- Every function fails soft (returns null/[] on error, never throws). Callers never break
  the user flow on a research failure.
- Paid Exa spend logged as its own ledger line via lib/credits.ts helpers
  (deductCredits/refundCredits -> atomic RPCs). Never raw credit_ledger inserts. NOTE: the
  Foundation pre-fill is platform-funded onboarding (no user-credit dependency) - it runs at
  cost 0 during the test and does not touch credits until it graduates to a paid surface.
- Grounding is opt-in per agent and TIERED on the existing run tiers:
  Light = no grounding; Standard = single grounded retrieval; Deep = multi-source /
  outputSchema synthesis. Gives run tiers real cost differentiation.
- On /search, content options nest under `contents`. On getContents they are top-level.
  Do not mix the two shapes.

---

## X.4 Template -> Agent map (roadmap, post-validation)

Exa publishes use-case templates that map ~1:1 onto the existing nine agents. Rollout order
for grounding AFTER the Foundation pre-fill test validates value. Do not build ahead of it.

| Exa template | Maya agent | What grounding adds |
|---|---|---|
| Fetch URL Content | (Foundation pre-fill) | Read the user's own site - the first build |
| Generated Social | content_writer | Posts grounded in a current topic/trend |
| Generated Ad | ad_copy_generator | Ads grounded in real web facts; helps satisfy no-unsubstantiated-claims constraints |
| Generated Page | seo_scanner | SEO/landing pages grounded in fresh source material |
| Outbound Research | competitor_watcher / trend_spotter | Structured, current company/market intel |
| Generated Email | email_sequence_builder | Topic/business grounding ONLY - never research individual recipients (privacy line) |
| CRM Enrichment | (none today) | Park - only if Maya ever holds contact/account lists |

The Email case must ground on topics/business, NOT facts about individual recipients - that
crosses into people-search/privacy territory and conflicts with the email agent's constraints.

---

## X.5 Work-queue placement

Sequenced AFTER the CONTEXTV12 post-merge QA follow-ups (visual QA, admin visual pass,
typography/dense-row QA). Add to the queue as:

| Item | Status |
|---|---|
| Exa Foundation pre-fill (A/B value test) | NEXT FEATURE (after post-merge QA) |
| Exa grounding layer - fleet-wide (lib/research/exa.ts shared fns + tiering) | BACKLOG - gated behind the pre-fill result |
| Grounding rollout per template->agent map (content_writer first) | BACKLOG - gated behind the pre-fill result |

Build detail: exa_foundation_prefill_handoff.md. Decision gate: the fleet-wide layer is
justified only if the pre-fill A/B shows a clear lift on Foundation completion + first-pass
score with no latency/quality regressions. Flat result -> kill the flag, do not proceed.

---

## X.6 Buffer (settled) and the social-scheduling path

Buffer is confirmed OUT for multi-tenant publishing (verified June 4, 2026): legacy REST
OAuth is closed to new developer app registrations (no new client_id); the new GraphQL API
is personal-key-only beta with no third-party end-user OAuth. No path for Maya's users to
connect their own socials through Maya via Buffer. Publer is dashboard-first, also not a
multi-tenant fit.

The replacement is tracked as an EVALUATION (not a build) in
zernio_social_evaluation_backlog.md: Zernio is the leading candidate (multi-tenant
OAuth-as-a-service, white-label, per-account pricing, publish/fail webhooks), gated behind
vendor questions (tenant isolation [open], cost caps [answered: Stripe global cap + our own
per-tenant throttle], support/reliability, data-handling/DPA) AND behind the Exa pre-fill
value test. Build behind a swappable lib/social/publisher.ts interface. Unrelated to Exa -
Exa grounds content; it does not publish. Apply the AGENTS.md Buffer-rule patch
(AGENTS_md_patch.md).
