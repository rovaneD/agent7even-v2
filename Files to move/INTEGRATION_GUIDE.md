# OpenRouter Cost Tracking — Integration Guide

## Files to place in your project

| Output file | Destination in agent7even-v2 |
|---|---|
| `lib_agents_cost_v2.ts` | `lib/agents/cost.ts` (replaces old version) |
| `lib_agents_openrouter.ts` | `lib/agents/openrouter.ts` (new file) |
| `lib_agents_runner_v2.ts` | `lib/agents/runner.ts` (replaces old version) |
| `api_cron_refresh_pricing.ts` | `app/api/cron/refresh-pricing/route.ts` |
| `api_cron_allocate_credits.ts` | `app/api/cron/allocate-credits/route.ts` |
| `migration_cost_tracking.sql` | Run in Supabase SQL Editor |
| `AdminAgentCosts.tsx` | `app/admin/revenue/AdminAgentCosts.tsx` |
| `CreditBalance.tsx` | `components/CreditBalance.tsx` |

## Merge vercel_crons_addition.json into your existing vercel.json

## How to update an existing agent API route

Before:
```ts
import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic()
const msg = await client.messages.create({ model: 'claude-sonnet-4-...', ... })
const content = msg.content[0].text
const inputTokens = msg.usage.input_tokens
```

After:
```ts
import { runAgent } from '@/lib/agents/runner'

const result = await runAgent({
  userId:   profile.id,
  agentId:  'content_writer',
  model:    'anthropic/claude-sonnet-4',
  messages: [{ role: 'user', content: prompt }],
  plan:     profile.plan,
})
// result.content, result.costUsd, result.taskId all available
```

## How to run a parallel orchestration

```ts
import { runOrchestration } from '@/lib/agents/runner'

const { results, totalCostUsd, budgetExceeded } = await runOrchestration({
  userId:      profile.id,
  triggeredBy: 'campaign_builder',
  plan:        profile.plan,
  agents: [
    { agentId: 'ad_copy_generator',       model: 'anthropic/claude-haiku-4-5', messages: [...] },
    { agentId: 'email_sequence_builder',  model: 'anthropic/claude-sonnet-4',  messages: [...] },
    { agentId: 'brand_voice_guardian',    model: 'anthropic/claude-haiku-4-5', messages: [...] },
  ]
})
```

## Environment variables needed
- `OPENROUTER_API_KEY` — already set in v2 ✅
- `CRON_SECRET` — add to Vercel env (any random string, used to auth cron routes)

## OpenRouter model ID format
Always use the `provider/model-name` format:
- `anthropic/claude-opus-4`
- `anthropic/claude-sonnet-4`
- `anthropic/claude-haiku-4-5`
- `google/gemini-2.5-flash`

Check https://openrouter.ai/models for the exact ID of any new model you add.
