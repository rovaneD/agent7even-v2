# Claude Code Session Brief — Exa + Social Scheduling
*Entry point. Read this first, then the referenced handoffs. Snapshot: June 4, 2026 (post-merge).*

This brief orders the work and tells you which file to open for each task. Do NOT
freelance ahead of it. Two workstreams are in this package; only ONE is a near-term build.

---

## 0. Session protocol (do this before touching anything)

1. Confirm repo: `git remote -v` MUST show `rovaneD/agent7even-v2`. If it shows
   `agent7even-app`, STOP - that's production, wrong repo.
2. Branch state: `design-system/color-tokens` has been MERGED into `main`. New work happens
   on top of `main`. For the Exa build, cut a fresh feature branch off `main`
   (e.g. `feature/exa-foundation-prefill`) - do NOT reuse the merged design-system branch.
3. Read, in order (current docs - the V11/V02 files are superseded historical snapshots):
   `AGENTS.md`, `CONTEXTV12.md`, `MAYA_CONTEXT_V03.md`, `AUDIT_FIXES_2026-06-02.md`.
4. Source-of-truth order: chat instructions > CONTEXTV12.md > MAYA_CONTEXT_V03.md > code.
5. Before any push: `git status`, show changed files, WAIT for explicit approval.
   Never `vercel --prod` with uncommitted changes. Never push without confirmation.
   (A `.git/hooks/pre-push` blocks pushes with uncommitted changes; CI runs tsc + build.)

Verification gate for any code change:
    npx tsc --noEmit
    git diff --check
    npm run build   # Next.js 16.2.6 / Turbopack; may need sandbox escalation for worker ports

---

## 1. What's in this package

| File | What it is | Action |
|---|---|---|
| `00_START_HERE_claude_code_brief.md` | This brief | Read first |
| `exa_foundation_prefill_handoff.md` | BUILD spec - Exa Foundation pre-fill | Build AFTER V12 post-merge QA (see order) |
| `CONTEXTV12_exa_addition.md` | Doc section to append to CONTEXTV12 (current) | Append to docs |
| `MAYA_CONTEXT_V03_exa_addition.md` | Doc section to append to MAYA_CONTEXT_V03 (current) | Append to docs |
| `zernio_social_evaluation_backlog.md` | EVALUATION - social scheduling (Buffer replacement) | DO NOT BUILD - gated |
| `AGENTS_md_patch.md` | One-line replacement for the stale Buffer rule in AGENTS.md | Apply now |

---

## 2. Build order (strict)

### FIRST (already in flight, not in this package) - V12 post-merge QA
CONTEXTV12 section 5: next work is normal QA follow-up on `main` - full desktop/mobile
visual QA, admin visual-system pass, typography/dense-row QA. Exa pre-fill sits AFTER these.
Do not start Exa until the QA follow-ups are done or the user explicitly says to start Exa.

### THEN - Exa Foundation pre-fill  (next feature build)
Open `exa_foundation_prefill_handoff.md` and build to its Definition of Done, on a fresh
branch off `main`.

Why this is the chosen first feature after QA: cheapest, lowest-risk test of whether Exa
web-grounding lifts Maya's value. Free-tier covers the whole test ($0). Flagged + A/B'd so
it produces a verdict, and it can't break onboarding (everything fails soft).

Hard constraints (carried from the handoff + the merged onboarding rules):
- Single server-side `EXA_API_KEY`, deferred init (mirror `lib/stripe.ts`/`lib/resend.ts`).
- Both Exa functions fail soft (return null/[], never throw). Onboarding never hangs.
- PLATFORM-FUNDED onboarding: Foundation runs pre-checkout and must NOT depend on the
  user's credit balance (CONTEXTV12 / MAYA_CONTEXT_V03). The pre-fill happens before a plan
  exists - so during the test it must not touch credits at all (cost 0). When it later
  graduates to a paid surface, use the EXISTING `lib/credits.ts` helpers (deduct/refund via
  atomic RPCs) - never raw `credit_ledger` inserts.
- If the research runs as an internal task, use a `foundation_*`-style agent id and FILTER
  it out of Dashboard agent counts and Maya daily briefs (same rule as existing Foundation
  tasks). It must not count as the user's first specialist agent run.
- The pre-step lives INSIDE the Foundation route. Do NOT reintroduce any redirect to the
  deleted `/onboarding` page.
- Do NOT disturb Foundation completion routing: selected plan -> `/checkout-now?plan=...`;
  no plan -> `/pricing?foundation=complete`. Pre-fill is upstream of this.
- Synthesis: two approaches documented (Exa `outputSchema` on `auto` type, OR raw -> your
  OpenRouter runner). RECONCILE against the real `lib/agents/runner.ts` signature and the
  real `exa-js` SDK before choosing - do not reconstruct parameter names.
- Confidence-gate pre-fill. NEVER pre-fill Voice or Budget/Goals. Mark pre-filled fields as
  editable suggestions.
- ~6s timeout -> fall through to the existing blank Foundation.
- Styling: blue `#3B82F6` / `.btn-primary` / `.card`. No pink (logo/accent only). No orange.
- Do NOT touch the existing Foundation document generation. Pre-fill is a NEW pre-step
  before it.

When done: append the two pre-written `*_addition.md` sections into CONTEXTV12 /
MAYA_CONTEXT_V03 (or their successors), and add the Exa queue item as DONE.

### LATER - Social scheduling (Zernio)  (GATED, not now)
Open `zernio_social_evaluation_backlog.md`. Buffer replacement, but an EVALUATION not a
build. Gated behind (a) the Exa pre-fill showing value and (b) Zernio answering the open
tenant-isolation question. Do not write social-publishing code this session. Permitted prep:
documenting the swappable `lib/social/publisher.ts` interface shape (no implementation)
only if explicitly asked.

---

## 3. Standing facts you need (so you don't re-derive them wrong)

- **Buffer is OUT.** Legacy REST OAuth is closed to new app registrations (no new
  `client_id`); the new GraphQL API is personal-key-only beta with no third-party end-user
  OAuth. No multi-tenant path. Do not attempt Buffer OAuth. Apply `AGENTS_md_patch.md` to
  fix the stale "use Later or Publer" line (Publer is dashboard-first, also not a fit;
  Zernio is the candidate).
- **Exa** is server-side intelligence (web grounding), unrelated to social publishing. One
  platform key, our infra, invisible to users.
- **Zernio** is the leading social-scheduling candidate (multi-tenant OAuth-as-a-service,
  white-label, per-account pricing, publish/fail webhooks, analytics). Small vendor - treat
  maturity/support as a real gate. Build behind a swappable interface.
- **Credits discipline** (post-June-2 audit): all model spend reserves before the call and
  refunds on failure, via atomic RPCs in `lib/credits.ts`. Onboarding/Foundation is the
  exception - platform-funded, no user-credit dependency.
- **Next.js 16**: middleware file is `proxy.ts`, not `middleware.ts`.
- **Stripe**: API version `'2026-04-22.dahlia' as any`. Never `'2025-04-30.basil'`.
- **Preview env**: set new env vars in BOTH Preview and Production Vercel scopes, or the
  other environment breaks.
- **Instagram Lucide icon** does not exist - use `Hash`.

---

## 4. One-line summary
Finish the V12 post-merge QA on `main` first; then build the Exa Foundation pre-fill on a
fresh branch (flagged, free-tier, fails soft, platform-funded/no-credit at onboarding,
foundation_*-filtered, no /onboarding redirect); fold in the pre-written doc sections and
the AGENTS.md Buffer patch; leave Zernio gated behind a swappable interface.
