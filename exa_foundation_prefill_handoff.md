# Exa Foundation Pre-fill — Claude Code Handoff
*Next feature build AFTER the CONTEXTV12 post-merge QA items. Onboarding intelligence
(first-contact value test).*
*Revised June 4, 2026 (post-merge) to match CONTEXTV12 / MAYA_CONTEXT_V03, the merged
onboarding/credit rules, current credit helpers, the design-system color tokens, and the
real Exa API setup guide.*

Read `AGENTS.md`, `CONTEXTV12.md`, `MAYA_CONTEXT_V03.md`, and `AUDIT_FIXES_2026-06-02.md`
before starting (the V11/V02 files are superseded historical snapshots). Confirm
`git remote -v` shows `rovaneD/agent7even-v2`. The `design-system/color-tokens` branch is
MERGED into `main`; cut a fresh feature branch off `main` for this work
(e.g. `feature/exa-foundation-prefill`).

> **Exa canonical reference:** https://docs.exa.ai/reference/search-api-guide-for-coding-agents
> If anything here contradicts real API behavior, fetch that URL — it is the source of
> truth for search types, parameters, and response shape. Report staleness back.

---

## Why we're building this

The first interaction is where Maya earns trust or loses it. Foundation currently asks a
new user to author business context from a blank form before Maya has done anything. This
flips it: Maya researches the user's business from their website BEFORE they fill anything
in, and pre-fills Foundation fields so the user *confirms and corrects* instead of
*authoring from scratch*.

This is a **validation build**, run flagged against the current manual Foundation, measured
for whether web-grounded pre-fill lifts the metrics in Part 7. Exa's free tier (1,000
requests/month) covers the whole test at zero cost (~3-6 requests/onboarding -> ~150-300
onboardings/month free).

**Graduation bar:** the pre-fill is right often enough that confirm-don't-author is a net
positive. A wrong/generic pre-fill is WORSE than no pre-fill - it makes Maya look like it
doesn't understand the business. Measure before trusting. Confidence-gate every field.

---

## Scope

1. Exa client lib (server-side, single platform key - NOT per-user, no OAuth)
2. New API route: POST /api/foundation/research
3. Two new columns on profiles (reuse existing tables otherwise)
4. Credit logging through the EXISTING lib/credits.ts helpers (not raw ledger inserts)
5. Feature flag + A/B split in the Foundation flow
6. Confidence-gated pre-fill wiring
7. Metrics instrumentation so the test produces a verdict

Does NOT touch the existing /api/foundation/generate (5-doc generation) - that stays
as-is. Pre-fill happens BEFORE the steps; generation still happens after the last step.

---

## Part 0 - Merged onboarding rules this build MUST respect (CONTEXTV12 / MAYA_CONTEXT_V03)

These were added when the design-system branch merged to main. The pre-fill sits inside the
existing Foundation onboarding and must not violate them:

- PLATFORM-FUNDED, PRE-CHECKOUT: Foundation runs before checkout and must NOT depend on the
  user's credit balance. Onboarding happens before a plan/balance exists. => During the
  free-tier test the pre-fill must not touch credits at all (cost 0). Do not gate it on
  credits or a plan.
- foundation_* TASK FILTERING: internal Foundation generation tasks use `foundation_*` agent
  ids and are filtered out of Dashboard agent counts and Maya daily briefs, and must not
  count as the user's first specialist agent run. If the research/synthesis runs as an
  internal task, it follows the SAME rule - invisible in briefs/counts.
- NO /onboarding REDIRECT: the `/onboarding` page was deleted; Foundation is the canonical
  onboarding route. The pre-step lives INSIDE the Foundation route. Do not reintroduce any
  redirect to `/onboarding`.
- DO NOT DISTURB COMPLETION ROUTING: after Foundation generation, selected plan ->
  `/checkout-now?plan=...`; no plan -> `/pricing?foundation=complete`. The pre-fill pre-step
  is upstream of this and must leave it untouched.
- FAILURE VISIBILITY: a Foundation generation failure must stay visible on the final step
  and must not redirect as though setup completed. The pre-fill must not mask or alter that
  behavior.

---

## Part 1 - Dependency + environment

    npm install exa-js

Add to .env.local, .env.example, and Vercel (Preview AND Production scopes - per the
CONTEXTV12 preview-env rule, Preview-only or Production-only will break the other):

    EXA_API_KEY=your_exa_key_here
    NEXT_PUBLIC_EXA_PREFILL_ENABLED=true   # kill switch, no-deploy disable

Single platform key. This is OUR backend infrastructure - invisible to users, no per-client
Exa account, no OAuth. Never expose EXA_API_KEY client-side. Follow the CONTEXTV12
deferred-initialization pattern: do NOT construct the Exa client at module-eval time in a
way that breaks the build when the key is absent in preview - instantiate inside the
function call, mirroring lib/stripe.ts / lib/resend.ts.

---

## Part 2 - Exa client lib

Create lib/research/exa.ts. Uses the official exa-js SDK. BOTH functions MUST fail
soft (return null/[] on any error, never throw) - onboarding must never break on a
research failure. The SDK throws on errors, so the try/catch is load-bearing.

Two corrections vs. the original draft, per the real API guide:
- Site read uses exa.getContents([url], {...}), NOT a search.
- On /search, content options nest inside `contents`. On /contents/getContents,
  they are top-level. Don't mix them.

    import Exa from 'exa-js'

    // Instantiate per-call (deferred init) so a missing key can't break module eval in preview.
    function getExa(): Exa | null {
      const key = process.env.EXA_API_KEY
      if (!key) return null
      return new Exa(key)
    }

    export type ExaSiteRead = {
      url: string
      title?: string
      text?: string
    }

    export type ExaCompetitor = {
      url: string
      title?: string
      highlights?: string[]
    }

    // Read the user's own website. /contents options are TOP-LEVEL.
    // Cap text to control downstream token cost. ~$1 / 1k pages.
    export async function exaReadSite(url: string): Promise<ExaSiteRead | null> {
      const exa = getExa()
      if (!exa) return null
      try {
        const res = await exa.getContents([url], {
          text: { maxCharacters: 4000, verbosity: 'compact' },
        })
        const first = res?.results?.[0]
        return first ? { url: first.url, title: first.title, text: first.text } : null
      } catch {
        return null // fail soft - onboarding continues
      }
    }

    // Find competitors / category context. On /search, options nest in `contents`.
    // Highlights (not full text) keep token cost predictable. ~$7 / 1k requests.
    export async function exaFindCompetitors(
      seed: string,
      numResults = 5
    ): Promise<ExaCompetitor[]> {
      const exa = getExa()
      if (!exa) return []
      try {
        const res = await exa.search(`competitors of ${seed}`, {
          type: 'auto',
          numResults,
          contents: { highlights: true },
        })
        return (res?.results ?? []).map((r: any) => ({
          url: r.url,
          title: r.title,
          highlights: r.highlights,
        }))
      } catch {
        return [] // fail soft
      }
    }

---

## Part 3 - Synthesis: TWO documented approaches, Claude Code picks at build

The pre-fill needs raw Exa results turned into suggestions keyed to Foundation field names.
There are two valid ways. RECONCILE against the real runner signature in
lib/agents/runner.ts and the real Exa SDK before choosing - do not reconstruct
parameter names.

### Approach A - Exa outputSchema (RECOMMENDED default)
Exa synthesizes structured JSON directly, with field-level confidence in output.grounding.
One call, no second LLM hop, and confidence comes free - which is exactly what the
confidence-gate in Part 6 needs.

- Use outputSchema on type: 'auto' (NOT deep). outputSchema works on every
  type; auto keeps latency in the onboarding budget. deep is 4-15s and fights the
  latency rule.
- Schema limits: max nesting depth 2, max 10 total properties. Do NOT add citation/
  confidence fields to the schema - grounding is returned automatically.
- Pair with a systemPrompt ("prefer the business's own site; collapse duplicates; keep
  grounded; leave fields null when unknown").
- Read output.content for the fields, output.grounding[].confidence for the gate.

Tradeoff: synthesis cost/control moves off your runner. Mitigate by still logging the Exa
spend as one ledger line via deductCredits() (Part 4).

### Approach B - Raw Exa results -> your OpenRouter runner
Keep exaReadSite + exaFindCompetitors returning raw text/highlights, then feed them to
the existing cost-tracking runner with a system prompt that returns strict JSON keyed to
Foundation fields. Keeps ALL synthesis on your runner and ledger - consistent with the
post-audit "all model spend through the runner" discipline - at the cost of a second hop
and you compute confidence yourself.

Decision rule for Claude Code: prefer A unless the runner integration is trivial and
keeping synthesis on-runner is judged more important than the extra hop. Either way: parse
defensively, strip ```json fences if present, and on any parse failure return
{ prefilled: false }.

---

## Part 4 - Supabase + credit logging

One migration, no new tables:

    ALTER TABLE profiles
      ADD COLUMN foundation_research         jsonb,   -- { website, suggestions, grounding, raw }
      ADD COLUMN foundation_research_variant text;     -- 'exa_prefill' | 'manual_control'

Credit logging uses the EXISTING helpers - not a raw credit_ledger insert. Per
AUDIT_FIXES_2026-06-02, the house pattern is reserve-before / refund-on-failure via the
atomic RPCs:

- deductCredits() -> deduct_credits() RPC
- refundCredits() -> refund_credits() RPC
  (both in lib/credits.ts)

    import { deductCredits, refundCredits } from '@/lib/credits'

    const EXA_RESEARCH_CREDIT_COST = 0 // FREE-TIER TEST - validating value, not charging

    // If/when this graduates to a paid surface, set a real cost and wrap:
    //   const reserved = await deductCredits(profileId, EXA_RESEARCH_CREDIT_COST, 'Foundation research (Exa)')
    //   try { ...do research... } catch { await refundCredits(...) ; throw }
    // During the test (cost 0) skip the reserve/refund dance - there's nothing to reserve,
    // and onboarding typically happens before a plan/balance exists.

Keep cost at 0 until this moves out of onboarding or onto a paid surface. At ~3-6
requests x ($7/$1 per 1k) it's well under $0.01 -> 1 credit is generous when the time comes.

---

## Part 5 - API route: POST /api/foundation/research

Create app/api/foundation/research/route.ts. Mirror the auth + profile-lookup +
ownership pattern used across the audited routes (app/api/agents/constraints/route.ts
is a clean reference). Never throw to the client.

    import { auth } from '@clerk/nextjs/server'
    import { NextResponse } from 'next/server'
    import { createServiceClient } from '@/lib/supabase/server'
    import { exaReadSite, exaFindCompetitors } from '@/lib/research/exa'

    export async function POST(req: Request) {
      const { userId } = await auth()
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const { website, businessName } = await req.json()
      if (!website && !businessName) {
        return NextResponse.json({ error: 'website or businessName required' }, { status: 400 })
      }

      const supabase = createServiceClient()
      const { data: profile } = await supabase
        .from('profiles').select('id').eq('clerk_user_id', userId).single()
      if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

      // 1. Read their site (if URL given) + find competitors. Both fail soft.
      const siteRead = website ? await exaReadSite(website) : null
      const seed = businessName || siteRead?.title || website
      const competitors = seed ? await exaFindCompetitors(seed, 5) : []

      // Both empty -> soft fail, let client fall through to manual Foundation.
      if (!siteRead && competitors.length === 0) {
        return NextResponse.json({ research: null, prefilled: false })
      }

      // 2. SYNTHESIZE -> Foundation field suggestions. See Part 3 (Approach A or B).
      //    Output a `suggestions` object keyed to the EXACT Foundation field names
      //    (businessDescription, problemSolved, transformation, customerWho, competitors[],
      //    differentiatorOwn, ...) plus a per-field confidence map for the Part 6 gate.
      //    On synthesis/parse failure -> return { prefilled: false }.

      const research = {
        website: website ?? null,
        siteTitle: siteRead?.title ?? null,
        competitors: competitors.map(c => ({ title: c.title, url: c.url })),
        // suggestions: {...}, grounding/confidence: {...}   <- from synthesis step
      }

      // 3. Persist research + variant (for the flow + quality auditing).
      await supabase.from('profiles').update({
        foundation_research: research,
        foundation_research_variant: 'exa_prefill',
      }).eq('id', profile.id)

      // 4. Credit logging via lib/credits.ts helpers - cost 0 during the test (Part 4).

      return NextResponse.json({ research, prefilled: true })
    }

---

## Part 6 - Feature flag, A/B split, confidence-gated pre-fill

Flag + split (in FoundationFlow.tsx or a small lib/flags.ts):

    const EXA_PREFILL_ENABLED = process.env.NEXT_PUBLIC_EXA_PREFILL_ENABLED === 'true'
    // 50/50, assigned ONCE at first Foundation load, persisted to
    // profiles.foundation_research_variant so the cohort is stable.
    function assignVariant(): 'exa_prefill' | 'manual_control' {
      if (!EXA_PREFILL_ENABLED) return 'manual_control'
      return Math.random() < 0.5 ? 'exa_prefill' : 'manual_control'
    }

Flow change:
- Add a tiny pre-step before the first Foundation step: "What's your business? Drop your
  website or name." (website optional but encouraged - it's what makes the site read useful).
- exa_prefill + input given -> call POST /api/foundation/research, show a short
  "Maya is looking into your business..." state, then enter the steps with fields pre-filled.
- manual_control, or prefilled: false, or timeout -> existing blank flow, unchanged.
- ~6s timeout -> graceful fallthrough. Onboarding latency is sacred. Never let research
  hang the flow.

Confidence-gated pre-fill - which fields, and only when confident:

| Foundation step | Pre-fill? | Notes |
|---|---|---|
| Your Business - businessDescription, problemSolved, transformation | Yes, if confident | Strong signal from site text |
| Your Customer - customerWho | Best-effort only | Often weak from site alone; gate hard |
| Your Position - competitors, differentiatorOwn | Yes - competitors strongest | Highest-confidence pre-fill; lead with this win |
| Your Voice | NO | Rarely reliable from a website |
| Your 30 Days - budget, goals | NO | User decisions, never inferred |

Rules:
- Only pre-fill a field when synthesis confidence is high enough (Approach A: use
  output.grounding confidence; Approach B: have the runner emit a confidence per field).
  Low/no confidence -> leave blank.
- Visually mark pre-filled fields as Maya's suggestion (editable, faded until touched) so
  the user knows it's a draft, not their own input. Honors confirm-don't-author and avoids
  silent trust in a wrong guess.
- competitors is the visible "Maya already did work" moment - surface it first.

Design tokens (current system - NOT the old orange/Geist tokens):
- Pre-step CTA: .btn-primary (blue #3B82F6).
- Pre-step container: .card (white, rounded-2xl, border-gray-100, no default shadow).
- "Suggestion" affordance: muted text #9BA1AE; never use pink (#F5349B is logo/accent only).
- Centered constrained canvas, left-aligned content, consistent with the dashboard
  alignment rule.

---

## Part 7 - Metrics: make the test produce a verdict

Compare exa_prefill vs manual_control (split on profiles.foundation_research_variant):

| Metric | Source | Hypothesis |
|---|---|---|
| Foundation completion rate | profiles.foundation_complete | pre-fill up |
| Step drop-off | abandonment step | pre-fill down early drop |
| Time to complete | first step -> complete | pre-fill down |
| First-pass Foundation score | existing scoring | pre-fill up |
| Time to first campaign | first campaign vs signup | pre-fill down |
| Early engagement (first 14d) | existing engagement signal | pre-fill up retention |

Minimum viable: log variant + completion + time-to-complete. Segment existing dashboards by
foundation_research_variant for the rest.

Decision: clear lift on completion + score with no latency/quality complaints ->
graduate (turn off split, default on, set real credit cost if paid surface). Flat or
mediocre pre-fill quality -> kill via the flag. $0 spent, question answered.

---

## Definition of done

- [ ] exa-js installed; EXA_API_KEY + NEXT_PUBLIC_EXA_PREFILL_ENABLED in env (local + Vercel Preview + Production), documented in CONTEXTV12 (or successor) + .env.example
- [ ] lib/research/exa.ts - exaReadSite (getContents) + exaFindCompetitors (search), both fail-soft, deferred client init
- [ ] profiles.foundation_research + foundation_research_variant migrated
- [ ] Synthesis implemented via Approach A or B; field names match Foundation exactly; defensive parse; confidence available for the gate
- [ ] POST /api/foundation/research returns { research, prefilled }, never throws to client, ownership-scoped
- [ ] Credit logging via lib/credits.ts helpers (cost 0 during test) - no raw ledger insert
- [ ] Pre-step added; NEXT_PUBLIC_EXA_PREFILL_ENABLED disables without deploy
- [ ] 50/50 variant assigned once, persisted, honored through the flow
- [ ] Pre-fill confidence-gated; voice + budget/goals never pre-filled; fields marked as editable suggestions
- [ ] ~6s timeout -> graceful fallthrough to blank Foundation
- [ ] Blue/token styling, centered constrained canvas; no pink
- [ ] Variant + completion + time-to-complete logged for the A/B
- [ ] Existing /api/foundation/generate untouched and still works
- [ ] Verified: npx tsc --noEmit + git diff --check + npm run build pass

---

## Update docs when done (per handoff protocol)

- MAYA_CONTEXT_V03.md (current, or successor) - Foundation pre-step + flow change; the A/B
  test + decision rule; reference the Exa grounding section. (Append section pre-written in
  MAYA_CONTEXT_V03_exa_addition.md.)
- CONTEXTV12.md (current, or successor) - EXA_API_KEY, NEXT_PUBLIC_EXA_PREFILL_ENABLED;
  lib/research/exa.ts; new profiles columns; Exa as a new external dependency; add the Exa
  queue item as DONE. (Append section pre-written in CONTEXTV12_exa_addition.md.)
