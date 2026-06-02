# Foundation Generate — Route Through the Runner + Harden — Handoff

> Read `MAYA_CONTEXT.md` and `CONTEXTV7.md` first. Run `git remote -v`, confirm
> `agent7even-v2-clean`, before touching code.

## What this fixes

`app/api/foundation/generate/route.ts` generates the 5 Foundation documents — the
most important generations in the product, since every downstream agent runs
against them. Three problems, none about lossiness (the parallel `Promise.allSettled`
structure is correct and stays):

1. **It bypasses cost tracking entirely.** It imports the Anthropic SDK directly
   (`import Anthropic from '@anthropic-ai/sdk'`) and calls `anthropic.messages.create()`.
   This violates the standing rule in MAYA_CONTEXT.md / CONTEXTV7.md: *all model
   calls go through `lib/agents/openrouter.ts` / the runner — never the Anthropic
   SDK direct.* These 5 calls are invisible to `agent_tasks`, `cost_usd`, credits,
   and the ledger. Same class of gap as the known Maya-chat one.

2. **Hardcoded, non-routed model.** `model: 'claude-sonnet-4-20250514'` — a pinned
   dated SDK model ID, not the OpenRouter registry format, with no fallback chain.
   If that ID ages out, Foundation generation breaks silently at onboarding.

3. **Fragile output + loose completion gate.**
   - `response.content[0].type === 'text' ? ... : ''` assumes the first block is
     text; a non-text first block silently yields an empty document.
   - `saved.length >= 3` marks `foundation_complete = true` with up to 2 of 5
     documents missing. An owner can finish onboarding with no positioning
     statement or no 30-day plan, and every agent then runs against an incomplete
     Foundation — the exact "vague/incomplete Foundation poisons everything
     downstream" failure SAASTR_LESSONS.md Lesson 1 calls the most critical
     product decision.

## Keep as-is (do NOT change)
- The parallel generation structure. All 5 docs generate from the same `context`
  string built only from the owner's answers — no doc reads another doc's output.
  This is correct (Anthropic "parallelization" pattern, non-compounding). Keep
  `Promise.allSettled` so one failure doesn't kill the rest.
- The `context` string contents and the 5 prompts. Wording unchanged.
- The `foundation_documents` upsert shape (`user_id, type, title, markdown, version`).

---

## ⚠️ Must reconcile against the real files before writing (do this first)

I'm specifying behavior, not a verbatim signature — confirm these in the repo so
the call is correct rather than type-error bait:

1. **Which `runAgent` is canonical.** There may be two: an older streaming
   `lib/ai/runAgent.ts` (Vercel AI SDK) and the cost-tracking
   `lib/agents/runner.ts` `runAgent()` (the 8-step one: pre-checks credits →
   creates task → OpenRouter → calc cost → saves output → updates task →
   rolls up → deducts credits). **Use the `lib/agents/runner.ts` one.** Open it
   and read its actual parameter object.

2. **`runAgent()` exact params.** From its documented behavior it needs at least:
   the user (`user_id` vs `account_id` — confirm which keys credit balance), a
   prompt/system+message, a model or agent key, and likely a `job_type` /
   `agentKey` label. Match the real names.

3. **Does `runAgent()` need an orchestration session?** It rolls cost up to an
   orchestration if given one (`orchestration_id`). 5 parallel docs is exactly an
   orchestration. Confirm whether to wrap these in
   `createOrchestrationSession()` / `completeOrchestration()` (preferred — gives
   you one budgeted session + correct run-tier classification: 5 subagents =
   Deep) or call `runAgent()` 5× standalone. **Prefer the orchestration wrapper.**

4. **Model registry key.** Use the OpenRouter registry id for Sonnet
   (`anthropic/claude-sonnet-4` per CONTEXTV7) via the registry/`runAgent`, not a
   dated SDK string. Confirm the current key name in the registry.
   ⚠️ Before pinning any model, verify the current model lineup with the user —
   do not trust a model ID from this doc or memory; model availability shifts.

5. **What `runAgent()` returns** — needs to surface the generated text plus
   `input_tokens` / `output_tokens` / `cost_usd` / `modelUsed`. Confirm the return
   shape so the doc-save loop reads the right field for the markdown body.

---

## Target implementation (pattern, reconcile names per above)

### Remove
```ts
import Anthropic from '@anthropic-ai/sdk'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
```

### Replace the generation block
Wrap the 5 docs in one orchestration session, fan out through the cost-tracking
runner, keep `Promise.allSettled`:

```ts
// names per reconcile step — illustrative
const session = await createOrchestrationSession({
  userId: profile.id,            // or account key per #2
  label: 'foundation_generate',
})

const results = await Promise.allSettled(
  docsToGenerate.map((doc) =>
    runAgent({
      userId: profile.id,                 // reconcile key
      orchestrationId: session.id,        // reconcile field name
      agentKey: 'foundation_generate',    // job_type label for cost screens
      model: FOUNDATION_MODEL,            // OpenRouter registry id, not dated SDK string
      system: doc.prompt,
      prompt: `BUSINESS CONTEXT:\n${context}`,
      maxTokens: 1000,
    }).then((r) => ({ ...doc, content: extractText(r) }))  // reconcile field
  )
)

await completeOrchestration(session.id)
```

If `runAgent()` already pre-checks credits and throws `INSUFFICIENT_CREDITS` /
`BUDGET_EXCEEDED`, catch those at the route level and return a clear status so
onboarding shows a real message, not a 500.

### Harden text extraction
Replace the `content[0]` assumption with a tolerant extractor — prefer whatever
the runner returns; if reading raw blocks anywhere, find the first text block
rather than indexing `[0]`:
```ts
function extractText(r): string {
  // prefer runner's returned text field (reconcile name), else:
  // (blocks ?? []).find(b => b.type === 'text')?.text ?? ''
}
```

### Tighten the completion gate
Require **all 5** documents to succeed before marking complete. If any fail,
do NOT set `foundation_complete = true`; return which docs are missing so the UI
can show a "finish setup / retry" state instead of silently admitting a partial
Foundation.

```ts
const REQUIRED = docsToGenerate.length  // 5
if (saved.length === REQUIRED) {
  await supabase.from('profiles').update({
    foundation_complete: true,
    onboarding_complete: true,
    foundation_step: 5,
    updated_at: new Date().toISOString(),
  }).eq('id', profile.id)
}

return NextResponse.json({
  success: saved.length === REQUIRED,
  generated: saved,
  missing: docsToGenerate.map(d => d.type).filter(t => !saved.includes(t)),
})
```

If a strict all-5 gate risks stranding users on transient single-doc failures,
the acceptable middle is: keep all-5 for `foundation_complete`, but add a retry
path that regenerates only the `missing` types — never lower the bar to 3.

---

## Definition of done
- [ ] No `@anthropic-ai/sdk` import in the route; all 5 calls go through the
      `lib/agents/runner.ts` runner / OpenRouter.
- [ ] The 5 docs run in one orchestration session; `agent_tasks` rows exist with
      tokens, `cost_usd`, `modelUsed`, and a `foundation_generate` job_type label;
      credits deducted via the normal path; ledger entries written.
- [ ] Model comes from the OpenRouter registry (verified current with user), not a
      dated SDK string; fallback chain applies.
- [ ] Parallel `Promise.allSettled` structure preserved; one doc failing doesn't
      kill the others.
- [ ] Text extraction no longer assumes `content[0]`; empty docs can't silently save.
- [ ] `foundation_complete` set only when all 5 saved; response returns `missing[]`.
- [ ] Insufficient-credit / budget-exceeded surfaced as a real status, not a 500.
- [ ] New signup end-to-end: 5 docs generate, all logged + costed, foundation marked
      complete; verified one run appears on the admin cost/run log.
- [ ] CONTEXTV7.md "Known gap" list updated: Foundation generate no longer bypasses
      the runner. Note it alongside the Maya-chat gap.
```
