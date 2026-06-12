// lib/agents/runner.ts  (v2 — OpenRouter version)
// ─────────────────────────────────────────────
// Full runner with OpenRouter + live cost tracking
// ─────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/server'
import { calculateCost, classifyRunTier, BUDGET_CAPS_USD, CREDIT_COST, type RunTier } from './cost'
import { openRouterComplete, openRouterCompleteWithFallback, type OpenRouterMessage } from './openrouter'
import { buildAgentContext } from './buildAgentContext'
import { AGENTS, type AgentId } from './registry'
import { deductCredits, refundCredits } from '@/lib/credits'

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

// Assembles full system prompt: brand context + agent skill + constraints.
// All three fetches run in parallel. Per-user constraints take precedence over registry defaults.
export async function buildSystemPrompt(userId: string, agentId: string): Promise<string> {
  const supabase = createServiceClient()

  const [brandContext, skill, { data: userConstraintsRow }] = await Promise.all([
    buildAgentContext(userId),
    getAgentSkill(agentId),
    supabase
      .from('agent_constraints')
      .select('constraints')
      .eq('user_id', userId)
      .eq('agent_id', agentId)
      .single(),
  ])

  const agentDef = AGENTS[agentId as AgentId]
  const constraints = userConstraintsRow?.constraints ?? agentDef?.defaultConstraints ?? null

  const parts = [brandContext, skill?.skill_prompt].filter(Boolean)
  const base = parts.join('\n\n---\n\n')

  if (!constraints) return base

  return `${base}

---

CONSTRAINTS — YOU MUST NEVER DO THE FOLLOWING:
${constraints}

These constraints are non-negotiable and override any other instruction. If a user request conflicts with these constraints, explain that you cannot fulfill that specific request and offer an alternative.`
}

// ── Orchestration ──────────────────────────────

function buildInitialStatus(agentIds: string[]): Record<string, string> {
  return Object.fromEntries(agentIds.map(id => [id, 'pending']))
}

async function setOrchestrationAgentStatus(
  orchestrationId: string,
  agentId: string,
  status: 'running' | 'completed' | 'failed'
) {
  const supabase = createServiceClient()
  const { data: s } = await supabase
    .from('orchestration_sessions')
    .select('agent_status')
    .eq('id', orchestrationId)
    .single()

  await supabase
    .from('orchestration_sessions')
    .update({ agent_status: { ...(s?.agent_status ?? {}), [agentId]: status } })
    .eq('id', orchestrationId)
}

export async function createOrchestrationSession(opts: {
  userId: string
  triggeredBy: string
  plan: string
  subagentCount: number
  budgetCapUsd?: number
  agentIds?: string[]
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
      agent_ids:      opts.agentIds ?? [],
      agent_status:   buildInitialStatus(opts.agentIds ?? []),
    })
    .select('id')
    .single()

  if (error) throw new Error(`createOrchestrationSession: ${error.message}`)
  return data.id
}

async function rollupCostToOrchestration(
  orchestrationId: string,
  agentId: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number
): Promise<{ budgetExceeded: boolean }> {
  const supabase = createServiceClient()

  const { data: s } = await supabase
    .from('orchestration_sessions')
    .select('total_cost_usd, budget_cap_usd, total_input_tokens, total_output_tokens, completed_tasks, agent_status')
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
      agent_status:        { ...(s.agent_status ?? {}), [agentId]: 'completed' },
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
  jobType?: string             // finer-grained job label for wedge analysis
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
      job_type:         opts.jobType ?? null,
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
  const now = new Date().toISOString()
  const update: Record<string, string> = { status, updated_at: now }

  if (status === 'running') update.started_at = now
  if (status === 'completed' || status === 'failed') update.completed_at = now

  await supabase
    .from('agent_tasks')
    .update(update)
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
  chargeCredits?:   boolean
}): Promise<AgentExecutionResult & { taskId: string; creditsDeducted: number }> {

  const supabase = createServiceClient()
  const tier = opts.runTier ?? classifyRunTier(opts.orchestrationId ? 2 : 1)
  const { CREDIT_COST } = await import('./cost')
  const creditsNeeded = CREDIT_COST[tier]
  const shouldChargeCredits = opts.chargeCredits !== false

  // 1. Create task record, then reserve credits before model spend unless this is platform-funded work.
  const task = await createTask({
    userId:          opts.userId,
    agentId:         opts.agentId,
    model:           opts.model,
    input:           { messages: opts.messages },
    orchestrationId: opts.orchestrationId,
  })
  const taskId = task.id
  await updateTaskStatus(taskId, 'running')

  if (opts.orchestrationId) {
    await setOrchestrationAgentStatus(opts.orchestrationId, opts.agentId, 'running')
  }

  if (shouldChargeCredits) {
    await deductCredits(
      opts.userId,
      creditsNeeded,
      `${opts.agentId} — ${tier} reserved`,
      taskId,
      opts.orchestrationId
    )
  }

  // 2. Call OpenRouter
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
    if (shouldChargeCredits) {
      await refundCredits(opts.userId, creditsNeeded, `${opts.agentId} failed — refund`, taskId).catch(() => {})
    }
    if (opts.orchestrationId) {
      await setOrchestrationAgentStatus(opts.orchestrationId, opts.agentId, 'failed')
    }
    throw err
  }

  // 3. Calculate cost using live OpenRouter pricing
  const costUsd = await calculateCost(raw.modelUsed, raw.inputTokens, raw.outputTokens)

  // 4. Save output row (agent + output_type are NOT NULL in agent_outputs)
  const agentDef = AGENTS[opts.agentId as AgentId]
  const outputType = agentDef?.outputType
    ?? (opts.agentId.startsWith('foundation_generate_')
      ? opts.agentId.replace('foundation_generate_', '')
      : 'agent_output')

  const { error: outputErr } = await supabase.from('agent_outputs').insert({
    task_id:       taskId,
    user_id:       opts.userId,
    agent:         opts.agentId,
    output_type:   outputType,
    content:       { raw: raw.content },
    input_tokens:  raw.inputTokens,
    output_tokens: raw.outputTokens,
    cost_usd:      costUsd,
    status:        agentDef?.autonomyLevel === 'approval_required'
      ? 'pending_approval'
      : 'approved',
  })

  if (outputErr) {
    console.error(
      `[runAgent] agent_outputs insert failed task=${taskId} agent=${opts.agentId}:`,
      outputErr.code,
      outputErr.message,
      outputErr.details,
    )
  }

  // 5. Update task — completed + cost data
  await supabase
    .from('agent_tasks')
    .update({
      status:        'completed',
      input_tokens:  raw.inputTokens,
      output_tokens: raw.outputTokens,
      cost_usd:      costUsd,
      model:         raw.modelUsed,
      updated_at:    new Date().toISOString(),
      completed_at:  new Date().toISOString(),
    })
    .eq('id', taskId)

  // 6. Roll up to orchestration — throws if budget exceeded
  if (opts.orchestrationId) {
    const { budgetExceeded } = await rollupCostToOrchestration(
      opts.orchestrationId,
      opts.agentId,
      raw.inputTokens,
      raw.outputTokens,
      costUsd
    )
    if (budgetExceeded) {
      if (shouldChargeCredits) {
        await refundCredits(opts.userId, creditsNeeded, `${opts.agentId} budget exceeded — refund`, taskId).catch(() => {})
      }
      throw new Error('BUDGET_EXCEEDED')
    }
  }

  return {
    content:         raw.content,
    inputTokens:     raw.inputTokens,
    outputTokens:    raw.outputTokens,
    costUsd,
    modelUsed:       raw.modelUsed,
    taskId,
    creditsDeducted: shouldChargeCredits ? creditsNeeded : 0,
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
    agentIds:      opts.agents.map(a => a.agentId),
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

// ── Cost billing for pre-created tasks ────────
// Call after generateText() to log tokens + deduct credits.
// Use this when a task already exists (created by tasks/create) so we
// don't create a duplicate row the way runAgent() would.

export async function chargeAgentRun(opts: {
  taskId:       string
  userId:       string
  inputTokens:  number
  outputTokens: number
  model:        string
  creditsAlreadyDeducted?: boolean
  tier?:        RunTier
}): Promise<{ costUsd: number; creditsDeducted: number }> {
  const supabase = createServiceClient()
  const tier = opts.tier ?? classifyRunTier(1)
  const creditsNeeded = CREDIT_COST[tier]

  if (!opts.creditsAlreadyDeducted) {
    await deductCredits(
      opts.userId,
      creditsNeeded,
      `agent_run — ${tier} reserved`,
      opts.taskId
    )
  }

  const costUsd = await calculateCost(opts.model, opts.inputTokens, opts.outputTokens)

  await supabase
    .from('agent_tasks')
    .update({
      input_tokens:  opts.inputTokens,
      output_tokens: opts.outputTokens,
      cost_usd:      costUsd,
      model:         opts.model,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', opts.taskId)

  return { costUsd, creditsDeducted: creditsNeeded }
}

// ── Compat: saveAgentOutput ────────────────────
// Saves structured output with type/title/content for the approval queue.

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
