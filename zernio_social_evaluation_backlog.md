# Social Scheduling Integration — Zernio Evaluation
*Backlog entry. EVALUATION, not a build. Snapshot: June 4, 2026; vendor log through June 2026.*
*Append to CONTEXTV11 successor as queue item #19-class; gated — see decision gates.*

## Why this exists

Maya's closed loop is: campaign calendar -> create post -> schedule/publish directly from
Maya. The calendar and create steps are Maya-native. The schedule/publish step needs an
external publisher. Buffer was the obvious candidate and is now RULED OUT (see below), so
this entry evaluates the replacement.

## Buffer is out (settled)

- Legacy REST API: OAuth 2.0 exists but Buffer stopped accepting new developer app
  registrations — no new client_id, so no OAuth flow to build.
- New GraphQL API: public beta, personal API keys only; third-party end-user OAuth (what a
  multi-tenant SaaS needs) is not enabled.
- Net: no path for Maya's users to connect their own socials through Maya. Per-user
  personal-key-paste is a non-starter. Confirmed June 4, 2026.
- Publer is similar — dashboard-first, not API-first/white-label for multi-tenant. Also out.

## Candidate: Zernio (https://zernio.com)

Why it fits where Buffer didn't:
- Multi-tenant OAuth-as-a-service: users link their own social accounts via one OAuth flow,
  no per-platform developer apps. This is the exact blocker Buffer couldn't clear.
- Fully white-label: end users never see Zernio branding. Maya stays the only surface.
- Per-account pricing: first 2 accounts free, then $6/acct (3-10), $3/acct (11-100),
  $1/acct (101-2,000), all features included, no tiers. Maps cleanly to the credit ledger —
  each connected client account is one predictable line item.
- Closes the loop AND the analytics gap: Posting, Analytics, Comments, Messaging, Ads APIs.
  Publish/fail WEBHOOKS provide the reconciliation layer the closed loop needs (no polling).
- Platform breadth (15): IG, FB, TikTok, LinkedIn, YouTube, X, Threads, Pinterest, Google
  Business, Bluesky, Reddit, Telegram, WhatsApp, Snapchat, Discord. Covers SMB needs.
- Ships an MCP server (280+ tools) for AI-agent publishing — possible future path, but a
  production multi-tenant flow will use the REST Posting API with our own per-tenant control.

Scope for Maya's FIRST build (when it happens): Posting API ONLY. Analytics is phase 2;
Comments/Messaging/Ads are out of current scope (ads especially — liability + not SMB-core).

## Risks to resolve BEFORE committing (this is the gate)

Zernio is a small vendor (self-described team of five). For an internal tool that's fine;
as the load-bearing layer under Maya's core promise, vendor maturity is a real risk — if
Zernio has an outage or slow incident response, Maya looks broken to the client (white-label
means they don't know Zernio exists; we inherit Zernio's reliability as our own).

Vendor questions and current status (as of June 4, 2026 webchat with Ana + escalation):

1. TENANT ISOLATION - **OPEN / HARD BLOCKER.** Can we issue per-tenant scoped API keys, or
   is isolation purely a shared key + profileId parameter? Ana did not guess; escalated to a
   teammate to confirm scoping options and the best multi-tenant pattern. This is the single
   biggest unknown - a leaked shared key exposing all clients is unacceptable and must match
   the ownership-scoping rigor from the June 2 audit. Do NOT move Zernio off "evaluation"
   until this is answered in writing.
2. COST CAPS - **ANSWERED (partial).** No per-workspace/per-account caps inside Zernio. The
   only lever is a hard spending limit in Stripe via zernio.com/dashboard/billing. That
   protects us from a runaway bill but bluntly - hitting the cap can halt ALL publishing
   rather than throttling one tenant. => Per-tenant rate limiting (connections + publishes)
   must live in OUR lib/social/publisher.ts. Treat the Stripe cap as a global backstop only.
   Note X/Twitter API costs are passed through per-call - confirm the cap covers pass-through.
3. SUPPORT + RELIABILITY - **trending OK, one data point.** Real human, prompt, honest "let
   me check" rather than a bluff. For a ~5-person team that's a positive early signal, but
   still confirm: incident response commitment, status page, breaking-change notice policy,
   realistic support response time. The teammate's response speed on Q1 is the next data point.
4. DATA HANDLING / DPA - **CLEARED (Agent7even signed, Jul 2026).** DPA `Data-Processing-Agreement-ARBICHAT.pdf`: Agent7even signed (Rovane Durso Bezerra, CEO), §13 California/LA County, sent back to Zernio. Zernio pre-signed 20/03/2026. **Await Zernio written confirmation / fully executed copy.** Trust materials on file under NDA (Jun 15, 2026): SOC 2 Type II Jan–Apr 2026 (Securance Pro, unqualified), GDPR attestation Feb 2026. Processing schedule annex still optional follow-up. Real client social connect: proceed after Zernio confirms execution — see `CONTEXTV22.md` §8.

Fallback if Zernio fails the gate: Postproxy claims scoped per-client keys, profile-group
pricing (caps surge exposure), and a higher uptime SLA — but verify its analytics depth and
platform coverage separately. (Postproxy framing came from their own Zernio comparison —
treat as adversarial, verify independently.)

## Architecture requirement (build behind a swappable interface)

Whichever vendor wins, the social layer MUST be a thin internal abstraction so the vendor
is swappable — same pattern as lib/research/exa.ts. Do not let vendor specifics leak into
Maya's agents or canvas.

    lib/social/publisher.ts   (interface — implementation chosen after the gate)
      connectAccount(userId, platform)      -> OAuth handoff, store per-tenant connection
      listChannels(userId)                  -> connected accounts for this tenant
      schedulePost(userId, payload)         -> validate per-platform rules, schedule
      onPublishResult(webhook)              -> reconcile publish/fail back to the calendar slot

Rules carried from prior architecture decisions:
- schedulePost is a side-effectful publish action -> human approval gate (per the agent
  brand-safety constraints) before it fires.
- Validate the post payload against each platform's rules BEFORE scheduling (IG business-
  account requirement, media-hosting, aspect/length, carousel/Reels/Stories support vary).
- Reconciliation via the publish/fail webhook is mandatory — a silently failed scheduled
  post breaks the core promise. Surface failures on the calendar.
- Log the publish action + any pass-through cost to credit_ledger via lib/credits.ts as a
  distinct "publish" line item, separate from LLM token cost.
- Per-tenant connection stored scoped to the client (never one shared credential across
  tenants).

## Vendor support log

### Instagram analytics zeros — root cause confirmed (Zernio support, June 2026)

**Reported symptom:** Instagram analytics showed zeros / empty post list despite connected account.

**Root cause (Zernio):** On **June 15 reconnect**, the OAuth token was saved **without** the `instagram_business_basic` permission. This happens when that permission is **unchecked on Meta's consent screen** during OAuth. Instagram does not return an error — it **silently returns no posts**, which surfaces as empty analytics.

**Important nuance (June 22):** Instagram → Apps and websites can show **all permissions ON** (basic business info, manage insights, publish, messages, comments) while Zernio still holds an **older token** minted before scopes were fixed. The Instagram UI reflects current app authorization; **Zernio's stored token only refreshes when you complete OAuth through Agent7even again** (Reconnect), not when you toggle permissions in Instagram settings alone.

**Fix (operator):**
1. If Instagram Apps and websites already shows all permissions ON (e.g. added Jun 22) — **skip removing the app**.
2. Tap **Reconnect** in Analytics → Connect accounts to refresh Zernio's token (Meta may skip the consent screen — that's OK).
3. Allow up to **24 hours** for analytics backfill after reconnect.
4. If still empty after reconnect + wait, reply to Zernio: permissions ON in Instagram UI, analytics still empty — ask them to verify token scopes on their backend for your profile.

**Why Meta may not show a permission screen on reconnect:** Meta reuses prior authorization when the app is still connected. That does not mean Zernio has refreshed its token — use Agent7even Reconnect to force a new token exchange.

**Fix (vendor):** Zernio pushed a UI change so this case shows a clear **"reconnect needed"** message instead of silently showing empty data. Confirm that banner appears in our white-label flow after their deploy.

**Connect UX (product direction):** Zernio confirmed the long-term pattern is **headless** — building our own pickers per platform is the right assumption. **No hosted connect portal on their roadmap** currently; they noted feedback if more API customers hit this pain point.

**Action items for us:**
- [ ] Operator: use **Reconnect** in Analytics connect panel + remove Meta Business integration first; verify analytics post list + metrics.
- [ ] Verify Zernio "reconnect needed" UI surfaces in Agent7even after insufficient-scope connect (don't rely on silent zeros).
- [ ] Document required Meta scopes in connect flow / help copy so users don't uncheck permissions.

---

## Decision gates (do not build until BOTH are true)

1. The Exa Foundation pre-fill A/B test (queue #18) has shown value — we don't expand the
   external-integration surface until the cheapest grounding test pays off. (Independent
   rationale: social scheduling is a bigger build; sequence behind the validated win.)
2. Zernio has answered the OPEN questions acceptably - tenant isolation (Q1) still pending
   scoped-key written guarantee in chat (non-blocking for first paying pilot); data handling/DPA (Q4)
   **cleared Jul 8, 2026** — paying customer live social OK. (Q2 cost caps answered; Q3 support trending OK.)

Validation approach when unblocked: build the publisher interface, wire Zernio behind it on
the FREE tier (2 accounts), validate the full schedule->publish->reconcile loop AND Zernio's
support responsiveness with test accounts, before any real client depends on it. **Jul 2026:**
DPA + paying-customer clearance received — first live connects use `vendor/zernio/go_live_runbook.md`
and `scripts/verify-zernio-go-live-readiness.ts`.

## AGENTS.md rule update (apply now)

Replace the Buffer/Later/Publer line with:
> Social scheduling: Buffer is out (no multi-tenant OAuth for new developers in 2026).
> Publer is dashboard-first, also out. Leading candidate is Zernio (multi-tenant OAuth,
> white-label, per-account pricing, publish/fail webhooks) — pending three verification
> questions (tenant isolation, cost caps, support/reliability). Build behind a swappable
> lib/social/publisher.ts interface. Do not attempt Buffer OAuth.
