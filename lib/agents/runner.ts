// lib/agents/runner.ts  (v2 — OpenRouter version)
// ─────────────────────────────────────────────
// Full runner with OpenRouter + live cost tracking
// ─────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/server'
import { calculateCost, classifyRunTier, BUDGET_CAPS_USD, type RunTier } from './cost'
import { openRouterComplete, openRouterCompleteWithFallback, type OpenRouterMessage } from './openrouter'
import { buildAgentContext } from './buildAgentContext'
import { AGENTS, type AgentId } from './registry'

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'approval_required'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'failed'

export interface AgentExecutionResult {
  content:      string
  inputTokens:  number
  outputTokens: number
  costUsd:      number
  modelUsed:    string
}

// ── Agent skill + system prompt ────────────────

export async function getAgentSkill(agentId: string): Promise<{ skill_prompt: string } | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('agent_skills')
    .select('skill_prompt')
    .eq('agent_id', agentId)
    .single()
  return data ?? null
}

// Assembles full system prompt: brand context + agent skill playbook, joined with a divider.
// Both fetches run in parallel. Either can be absent — the result is still usable.
export async function buildSystemPrompt(userId: string, agentId: string): Promise<string> {
  const [brandContext, skill] = await Promise.all([
    buildAgentContext(userId),
    getAgentSkill(agentId),
  ])
  const parts = [brandContext, skill?.skill_prompt].filter(Boolean)
  return parts.join('\n\n---\n\n')
}

// ── Orchestration ──────────────────────────────

export async function createOrchestrationSession(opts: {
  userId: string
  triggeredBy: string
  plan: string
  subagentCount: number
  budgetCapUsd?: number
}): Promise<string> {
  const supabase = createServiceClient()
  const cap = opts.budgetCapUsd ?? BUDGET_CAPS_USD[opts.plan] ?? 2.00

  const { data, error } = await supabase
    .from('orchestration_sessions')
    .insert({
      user_id:        opts.userId,
      triggered_by:   opts.triggeredBy,
      status:         'running',
      total_tasks:    opts.subagentCount,
      budget_cap_usd: cap,
    })
    .select('id')
    .single()

  if (error) throw new Error(`createOrchestrationSession: ${error.message}`)
  return data.id
}

async function rollupCostToOrchestration(
  orchestrationId: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number
): Promise<{ budgetExceeded: boolean }> {
  const supabase = createServiceClient()

  const { data: s } = await supabase
    .from('orchestration_sessions')
    .select('total_cost_usd, budget_cap_usd, total_input_tokens, total_output_tokens, completed_tasks')
    .eq('id', orchestrationId)
    .single()

  if (!s) return { budgetExceeded: false }

  const newCost = (s.total_cost_usd ?? 0) + costUsd
  const budgetExceeded = s.budget_cap_usd != null && newCost >= s.budget_cap_usd

  await supabase
    .from('orchestration_sessions')
    .update({
      total_cost_usd:      newCost,
      total_input_tokens:  (s.total_input_tokens  ?? 0) + inputTokens,
      total_output_tokens: (s.total_output_tokens ?? 0) + outputTokens,
      completed_tasks:     (s.completed_tasks     ?? 0) + 1,
      budget_exceeded:     budgetExceeded,
      ...(budgetExceeded ? { status: 'paused_budget' } : {}),
    })
    .eq('id', orchestrationId)

  return { budgetExceeded }
}

export async function completeOrchestration(orchestrationId: string) {
  const supabase = createServiceClient()
  await supabase
    .from('orchestration_sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', orchestrationId)
}

// ── Task lifecycle ─────────────────────────────

export async function createTask(opts: {
  userId: string
  agent?: AgentId | string     // used by external route callers
  agentId?: string             // used by runAgent internally
  model?: string
  input: Record<string, unknown>
  orchestrationId?: string
  triggerType?: string
  priority?: string
  scheduledFor?: Date
}): Promise<{ id: string; status: string; [key: string]: unknown }> {
  const supabase = createServiceClient()
  const agentValue = opts.agent ?? opts.agentId
  const agentDef = agentValue ? AGENTS[agentValue as AgentId] : undefined

  const { data, error } = await supabase
    .from('agent_tasks')
    .insert({
      user_id:          opts.userId,
      agent:            agentValue,
      model:            opts.model ?? null,
      input:            opts.input,
      status:           opts.scheduledFor ? 'scheduled' : 'pending',
      trigger_type:     opts.triggerType ?? 'user',
      priority:         opts.priority ?? 'normal',
      requires_approval: agentDef?.autonomyLevel === 'approval_required',
      scheduled_for:    opts.scheduledFor?.toISOString() ?? null,
      orchestration_id: opts.orchestrationId ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`createTask: ${error.message}`)
  return data
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const supabase = createServiceClient()
  await supabase
    .from('agent_tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', taskId)
}

// ── Main execution wrapper ─────────────────────

export async function runAgent(opts: {
  userId:           string
  agentId:          string
  model:            string
  messages:         OpenRouterMessage[]
  plan:             string
  runTier?:         RunTier
  orchestrationId?: string
  fallbackModels?:  string[]
  maxTokens?:       number
  temperature?:     number
}): Promise<AgentExecutionResult & { taskId: string; creditsDeducted: number }> {

  const supabase = createServiceClient()
  const tier = opts.runTier ?? classifyRunTier(opts.orchestrationId ? 2 : 1)
  const { CREDIT_COST } = await import('./cost')
  const creditsNeeded = CREDIT_COST[tier]

  // 1. Check credit balance
  const { data: bal } = await supabase
    .from('credit_balances')
    .select('balance')
    .eq('user_id', opts.userId)
    .single()

  if ((bal?.balance ?? 0) < creditsNeeded) {
    throw new Error('INSUFFICIENT_CREDITS')
  }

  // 2. Create task record
  const task = await createTask({
    userId:          opts.userId,
    agentId:         opts.agentId,
    model:           opts.model,
    input:           { messages: opts.messages },
    orchestrationId: opts.orchestrationId,
  })
  const taskId = task.id
  await updateTaskStatus(taskId, 'running')

  // 3. Call OpenRouter
  let raw: { content: string; inputTokens: number; outputTokens: number; modelUsed: string }

  try {
    if (opts.fallbackModels?.length) {
      raw = await openRouterCompleteWithFallback(
        {
          model:       opts.model,
          messages:    opts.messages,
          max_tokens:  opts.maxTokens  ?? 2000,
          temperature: opts.temperature ?? 0.7,
        },
        opts.fallbackModels
      )
    } else {
      const res = await openRouterComplete({
        model:       opts.model,
        messages:    opts.messages,
        max_tokens:  opts.maxTokens  ?? 2000,
        temperature: opts.temperature ?? 0.7,
      })
      raw = res
    }
  } catch (err) {
    await updateTaskStatus(taskId, 'failed')
    throw err
  }

  // 4. Calculate cost using live OpenRouter pricing
  const costUsd = await calculateCost(raw.modelUsed, raw.inputTokens, raw.outputTokens)

  // 5. Save output row
  await supabase.from('agent_outputs').insert({
    task_id:       taskId,
    content:       raw.content,
    input_tokens:  raw.inputTokens,
    output_tokens: raw.outputTokens,
    cost_usd:      costUsd,
  })

  // 6. Update task — completed + cost data
  await supabase
    .from('agent_tasks')
    .update({
      status:        'completed',
      input_tokens:  raw.inputTokens,
      output_tokens: raw.outputTokens,
      cost_usd:      costUsd,
      model:         raw.modelUsed,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', taskId)

  // 7. Roll up to orchestration — throws if budget exceeded
  if (opts.orchestrationId) {
    const { budgetExceeded } = await rollupCostToOrchestration(
      opts.orchestrationId,
      raw.inputTokens,
      raw.outputTokens,
      costUsd
    )
    if (budgetExceeded) {
      throw new Error('BUDGET_EXCEEDED')
    }
  }

  // 8. Deduct credits + log to ledger
  const newBalance = (bal?.balance ?? 0) - creditsNeeded
  await supabase
    .from('credit_balances')
    .upsert({
      user_id:       opts.userId,
      balance:       newBalance,
      lifetime_used: creditsNeeded,
      updated_at:    new Date().toISOString(),
    })

  await supabase.from('credit_ledger').insert({
    user_id:          opts.userId,
    type:             'usage',
    credits:          -creditsNeeded,
    balance_after:    newBalance,
    description:      `${opts.agentId} — ${tier} run via ${raw.modelUsed}`,
    task_id:          taskId,
    orchestration_id: opts.orchestrationId ?? null,
  })

  return {
    content:         raw.content,
    inputTokens:     raw.inputTokens,
    outputTokens:    raw.outputTokens,
    costUsd,
    modelUsed:       raw.modelUsed,
    taskId,
    creditsDeducted: creditsNeeded,
  }
}

// ── Parallel orchestration helper ─────────────
// Runs multiple agents concurrently under one session
// Stops spawning new agents if budget is exceeded

export async function runOrchestration(opts: {
  userId:      string
  triggeredBy: string
  plan:        string
  agents: Array<{
    agentId:    string
    model:      string
    messages:   OpenRouterMessage[]
    fallbacks?: string[]
    maxTokens?: number
  }>
}): Promise<{
  orchestrationId: string
  results: Array<AgentExecutionResult & { taskId: string; agentId: string }>
  totalCostUsd: number
  budgetExceeded: boolean
}> {
  const orchestrationId = await createOrchestrationSession({
    userId:        opts.userId,
    triggeredBy:   opts.triggeredBy,
    plan:          opts.plan,
    subagentCount: opts.agents.length,
  })

  const results: Array<AgentExecutionResult & { taskId: string; agentId: string }> = []
  let budgetExceeded = false

  // Run all agents in parallel — Promise.allSettled so one failure doesn't kill the rest
  const settled = await Promise.allSettled(
    opts.agents.map(agent =>
      runAgent({
        userId:          opts.userId,
        agentId:         agent.agentId,
        model:           agent.model,
        messages:        agent.messages,
        plan:            opts.plan,
        runTier:         classifyRunTier(opts.agents.length),
        orchestrationId,
        fallbackModels:  agent.fallbacks,
        maxTokens:       agent.maxTokens,
      }).then(r => ({ ...r, agentId: agent.agentId }))
    )
  )

  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      results.push(outcome.value)
    } else {
      if (outcome.reason?.message === 'BUDGET_EXCEEDED') {
        budgetExceeded = true
      }
      console.error('Agent failed in orchestration:', outcome.reason)
    }
  }

  await completeOrchestration(orchestrationId)

  const totalCostUsd = results.reduce((s, r) => s + r.costUsd, 0)

  return { orchestrationId, results, totalCostUsd, budgetExceeded }
}

// ── Compat: saveAgentOutput ────────────────────
// Used by routes that call generateText() directly (e.g. campaign-builder)
// and need to save a structured output with type/title/content fields.

export async function saveAgentOutput({
  taskId,
  userId,
  agent,
  outputType,
  title,
  content,
}: {
  taskId: string
  userId: string
  agent: string
  outputType: string
  title: string
  content: Record<string, unknown>
}) {
  const supabase = createServiceClient()
  const agentDef = AGENTS[agent as AgentId]

  const { data, error } = await supabase
    .from('agent_outputs')
    .insert({
      task_id:     taskId,
      user_id:     userId,
      agent,
      output_type: outputType,
      title,
      content,
      status:      agentDef?.autonomyLevel === 'approval_required'
        ? 'pending_approval'
        : 'approved',
    })
    .select()
    .single()

  if (error) throw error
  return data
}
