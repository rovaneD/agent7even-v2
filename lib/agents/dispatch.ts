import { createServiceClient } from '@/lib/supabase/server'
import { executeAgentRun } from '@/lib/agents/executeAgentRun'
import { AGENTS, type AgentId } from '@/lib/agents/registry'

export async function dispatchAgentTask(opts: {
  taskId: string
  agent: string
  input: Record<string, unknown>
  userId: string
}) {
  const agentId = opts.agent.replace(/-/g, '_') as AgentId
  const supabase = createServiceClient()

  try {
    const result = await executeAgentRun({
      agentId,
      taskId: opts.taskId,
      userId: opts.userId,
      taskInput: opts.input,
    })

    if (!result.ok) {
      await supabase
        .from('agent_tasks')
        .update({
          status: 'failed',
          error: result.error.slice(0, 500),
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', opts.taskId)
    }
  } catch (err) {
    console.error('Agent dispatch error:', err)
    await supabase
      .from('agent_tasks')
      .update({
        status: 'failed',
        error: String(err).slice(0, 200),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', opts.taskId)
  }
}
