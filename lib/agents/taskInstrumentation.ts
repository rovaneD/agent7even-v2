import { createServiceClient } from '@/lib/supabase/server'
import type { ActionCreditKey } from '@/lib/credits/actionCosts'

export type TaskCostPatch = {
  action_type: ActionCreditKey
  cost_usd?: number
  model?: string | null
  input_tokens?: number
  output_tokens?: number
  /** When true, add cost_usd to existing task cost instead of replacing. */
  add_cost_usd?: boolean
}

/** Persist measured cost + action_type on agent_tasks (Phase 1 instrumentation). */
export async function recordAgentTaskCost(
  taskId: string,
  patch: TaskCostPatch,
): Promise<void> {
  const supabase = createServiceClient()
  const update: Record<string, unknown> = {
    action_type: patch.action_type,
    updated_at: new Date().toISOString(),
  }

  if (patch.model !== undefined) update.model = patch.model
  if (patch.input_tokens !== undefined) update.input_tokens = patch.input_tokens
  if (patch.output_tokens !== undefined) update.output_tokens = patch.output_tokens

  if (patch.cost_usd !== undefined) {
    if (patch.add_cost_usd) {
      const { data: row } = await supabase
        .from('agent_tasks')
        .select('cost_usd')
        .eq('id', taskId)
        .maybeSingle()
      const prev = Number(row?.cost_usd ?? 0)
      update.cost_usd = Number((prev + patch.cost_usd).toFixed(6))
    } else {
      update.cost_usd = patch.cost_usd
    }
  }

  const { error } = await supabase.from('agent_tasks').update(update).eq('id', taskId)
  if (error) {
    console.error('[recordAgentTaskCost]', taskId, error.message)
  }
}

/** Log a completed options-generation pass (no credit debit — compose step charges later). */
export async function insertImageOptionsCostTask(opts: {
  profileId: string
  actionType: ActionCreditKey
  imageModel: string
  imageModelId: string
  optionCount: number
  costUsd: number
  inputTokens: number
  outputTokens: number
  briefModel: string
}): Promise<string | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('agent_tasks')
    .insert({
      user_id: opts.profileId,
      actor_profile_id: opts.profileId,
      agent: 'image_generation',
      job_type: 'image_options',
      action_type: opts.actionType,
      model: opts.imageModel,
      status: 'completed',
      trigger_type: 'user',
      priority: 'normal',
      input: {
        image_model_id: opts.imageModelId,
        options_count: opts.optionCount,
        brief_model: opts.briefModel,
      },
      input_tokens: opts.inputTokens,
      output_tokens: opts.outputTokens,
      cost_usd: opts.costUsd,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[insertImageOptionsCostTask]', error.message)
    return null
  }
  return data.id as string
}
