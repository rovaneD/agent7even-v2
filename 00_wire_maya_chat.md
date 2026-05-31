# Build Step 1 — Wire `/api/maya/chat` through the runner

**Goal:** Maya chat currently calls OpenRouter directly and logs nothing. After
this change, every chat turn: (1) creates an `agent_tasks` row tagged
`job_type='maya_chat'`, (2) records input/output/cached tokens + `cost_usd` +
`model`, (3) deducts credits via the same path every other agent uses.

**Why first:** until this is done, your cost data has a hole exactly where your
heaviest usage is. Every downstream metric is wrong until chat is captured.

---

## What I could verify vs. what you must reconcile

Verified from your docs:
- Runner is `lib/agents/runner.ts`, exposing `createTask`, `updateTaskStatus`,
  `saveAgentOutput`.
- All model calls go through `lib/agents/openrouter.ts`.
- Credit/cost logic lives in `lib/agents/cost.ts`; tables `credit_balances`,
  `credit_ledger`.
- Route is `/api/maya/chat`, and it **streams** responses.

⚠️ **You must open these files and confirm before running the code below:**
1. Exact signature of `createTask(...)` — what fields it accepts.
2. What `openrouter.ts` returns — specifically whether it surfaces a final
   `usage` object (`input_tokens`, `output_tokens`, `cached_tokens`) **after a
   stream finishes**. Streaming APIs send usage in the final chunk; if your
   client doesn't capture it, that's the first thing to fix (see Step A).
3. The deduct-credits function name in `cost.ts` (I'll call it
   `deductCredits` / `recordCost` — rename to match).
4. Whether tasks key on `user_id` or `account_id` for credit balance.

---

## Step A — Make the OpenRouter client return usage after streaming

The trap with streaming: you stream tokens to the user, the stream ends, and the
**final SSE chunk carries the usage totals**. If `openrouter.ts` returns early or
discards that chunk, you can never know the cost. Ensure the streaming path
accumulates and returns usage when the stream closes.

```ts
// lib/agents/openrouter.ts  (pattern — adapt to your existing client)
// When streaming, OpenRouter includes usage in the final chunk if you request it.
// Make sure the request body sets:  stream: true, usage: { include: true }
// and that you capture the last chunk's usage before resolving.

export async function streamChat(opts: {
  model: string;
  messages: ChatMessage[];
  onToken: (t: string) => void;            // pipes to the user as before
}): Promise<{
  text: string;
  model: string;
  usage: { input_tokens: number; output_tokens: number; cached_tokens: number };
}> {
  // ... your existing fetch with stream:true ...
  let fullText = "";
  let usage = { input_tokens: 0, output_tokens: 0, cached_tokens: 0 };

  for await (const chunk of stream) {
    if (chunk.choices?.[0]?.delta?.content) {
      const t = chunk.choices[0].delta.content;
      fullText += t;
      opts.onToken(t);                      // user still sees streaming
    }
    if (chunk.usage) {                      // final chunk
      usage = {
        input_tokens: chunk.usage.prompt_tokens ?? 0,
        output_tokens: chunk.usage.completion_tokens ?? 0,
        cached_tokens: chunk.usage.prompt_tokens_details?.cached_tokens ?? 0,
      };
    }
  }
  return { text: fullText, model: opts.model, usage };
}
```

If your client already returns usage, skip this step — just confirm it includes
`cached_tokens`.

---

## Step B — Wrap the chat route in the runner lifecycle

The pattern mirrors what every other agent already does: create task → run →
save output + cost → deduct credits. Maya chat just hasn't been doing it.

```ts
// app/api/maya/chat/route.ts  (pattern — adapt names to your runner)
import { createTask, saveAgentOutput, updateTaskStatus } from "@/lib/agents/runner";
import { computeCostUsd, creditsForCostUsd, deductCredits } from "@/lib/agents/cost";
import { streamChat } from "@/lib/agents/openrouter";

export async function POST(req: Request) {
  const { messages, accountId, userId } = await parseBody(req);
  const model = "claude-sonnet-4"; // or whatever Maya chat uses today

  // 1. PRE-CHECK BALANCE — refuse if empty, like other agents should
  //    (adapt to your cost.ts API; don't let chat run a free negative balance)
  // const balance = await getCreditBalance(accountId);
  // if (balance <= 0) return Response.json({ error: "out_of_credits" }, { status: 402 });

  // 2. CREATE TASK up front so even a failed/cut-off stream is recorded
  const task = await createTask({
    account_id: accountId,
    user_id: userId,
    job_type: "maya_chat",          // <-- the new field from the migration
    model,
    run_tier: "light",              // chat turns are light; adjust if you tier them
    status: "running",
  });

  try {
    // 3. STREAM to the user (unchanged UX) while capturing usage
    const stream = new ReadableStream({
      async start(controller) {
        const result = await streamChat({
          model,
          messages,
          onToken: (t) => controller.enqueue(new TextEncoder().encode(t)),
        });
        controller.close();

        // 4. AFTER stream closes: record cost + tokens + deduct credits
        const cost_usd = await computeCostUsd({
          model: result.model,
          input_tokens: result.usage.input_tokens,
          output_tokens: result.usage.output_tokens,
          cached_tokens: result.usage.cached_tokens,
        });
        const credits = creditsForCostUsd(cost_usd); // or fixed light-tier credits

        await saveAgentOutput({
          task_id: task.id,
          input_tokens: result.usage.input_tokens,
          output_tokens: result.usage.output_tokens,
          cached_tokens: result.usage.cached_tokens,
          cost_usd,
        });
        await updateTaskStatus(task.id, {
          status: "complete",
          input_tokens: result.usage.input_tokens,
          output_tokens: result.usage.output_tokens,
          cached_tokens: result.usage.cached_tokens,
          cost_usd,
          credits_charged: credits,
          success: true,
        });
        await deductCredits({
          account_id: accountId,
          amount: credits,
          description: `Maya chat (task ${task.id})`,  // writes to credit_ledger
        });
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream" },
    });
  } catch (err: any) {
    // 5. RECORD THE FAILURE — failed runs still cost tokens; don't lose them
    await updateTaskStatus(task.id, {
      status: "error",
      success: false,
      error_code: err?.code ?? "stream_error",
    });
    throw err;
  }
}
```

---

## The two decisions you have to make (not code — judgment)

**1. Fixed credits per chat turn, or cost-based?**
Other agents use fixed run-tier credits (Light 2). Simplest: charge chat as a
Light run (2 credits) regardless of actual tokens. Cleaner UX, but a long
context-heavy chat could cost you more than 2 credits' worth — which is exactly
the power-user leak to watch. Recommendation: **start fixed (Light = 2)** for
predictability, and let the instrumentation tell you within a few weeks whether
chat turns are running hot. If P90 chat cost exceeds 2 credits of value, switch
to cost-based or cap context length. Don't pre-optimize; measure first.

**2. Charge per turn, or per session?**
Per turn is honest and simple. Per session feels nicer to users but hides cost.
Start per turn; revisit only if users complain.

---

## Verification checklist (run after wiring, before committing)

- [ ] Send a Maya chat message; confirm a new `agent_tasks` row appears with
      `job_type='maya_chat'`, non-zero tokens, non-zero `cost_usd`.
- [ ] Confirm a matching `credit_ledger` debit row was written.
- [ ] Confirm `credit_balances` decreased by the charged amount.
- [ ] Cut a stream off mid-response; confirm the task is recorded as
      `error`/`success=false` and NOT charged (or charged only for real usage).
- [ ] Confirm the user still sees streaming with no visible latency change.

## Then, and only then
- Commit (`git add -A && git commit`, push to `main` on the **v2** repo — confirm
  `git remote -v` shows `agent7even-v2`).
- Run migration `01_cost_instrumentation.sql`.
- Begin admin tool Screen 2.
