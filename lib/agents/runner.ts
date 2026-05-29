import { createServiceClient } from '@/lib/supabase/server'
import { AGENTS, AgentId } from './registry'
import { buildAgentContext } from './buildAgentContext'

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

export async function createTask({
  userId,
  agent,
  input,
  triggerType = 'user',
  priority = 'normal',
  scheduledFor,
}: {
  userId: string
  agent: AgentId
  input: Record<string, unknown>
  triggerType?: string
  priority?: string
  scheduledFor?: Date
}) {
  const supabase = createServiceClient()
  const agentDef = AGENTS[agent]

  const { data, error } = await supabase
    .from('agent_tasks')
    .insert({
      user_id: userId,
      agent,
      trigger_type: triggerType,
      status: scheduledFor ? 'scheduled' : 'pending',
      priority,
      input,
      requires_approval: agentDef.autonomyLevel === 'approval_required',
      scheduled_for: scheduledFor?.toISOString() ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateTaskStatus(
  taskId: string,
  status: string,
  output?: Record<string, unknown>,
  error?: string
) {
  const supabase = createServiceClient()

  const update: Record<string, unknown> = {
    status,
    output: output ?? {},
    error: error ?? null,
  }

  if (status === 'running') update.started_at = new Date().toISOString()
  if (status === 'complete' || status === 'failed') update.completed_at = new Date().toISOString()

  await supabase.from('agent_tasks').update(update).eq('id', taskId)
}

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
      task_id: taskId,
      user_id: userId,
      agent,
      output_type: outputType,
      title,
      content,
      status: agentDef.autonomyLevel === 'approval_required'
        ? 'pending_approval'
        : 'approved',
    })
    .select()
    .single()

  if (error) throw error
  return data
}
