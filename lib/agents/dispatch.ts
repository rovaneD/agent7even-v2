import { createServiceClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/createNotification'
import { executeAgentRun } from '@/lib/agents/executeAgentRun'
import { AGENTS, type AgentId } from '@/lib/agents/registry'

/**
 * Scheduled runs fail with nobody watching — surface it. Manual runs already
 * show the failure in the UI the user is looking at, so they stay quiet here.
 */
async function notifyScheduledRunFailure(
  supabase: ReturnType<typeof createServiceClient>,
  opts: { taskId: string; agentId: AgentId; userId: string },
) {
  try {
    const { data: task } = await supabase
      .from('agent_tasks')
      .select('trigger_type')
      .eq('id', opts.taskId)
      .maybeSingle()
    if (task?.trigger_type !== 'scheduled') return

    const agentName = AGENTS[opts.agentId]?.name ?? opts.agentId
    await createNotification({
      userId: opts.userId,
      title: `${agentName} run failed`,
      body: `The scheduled ${agentName} run could not complete. It will try again on its next scheduled run — open the agent to run it manually or review its setup.`,
      type: 'agent_run_failed',
      link: `/dashboard/agents/${opts.agentId}/outputs`,
      sendEmail: false,
    })
  } catch (err) {
    console.error('Failed-run notification error:', err)
  }
}

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
      await notifyScheduledRunFailure(supabase, { taskId: opts.taskId, agentId, userId: opts.userId })
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
    await notifyScheduledRunFailure(supabase, { taskId: opts.taskId, agentId, userId: opts.userId })
  }
}
