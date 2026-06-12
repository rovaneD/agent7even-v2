import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { contentPostingStatsAgentIds } from '@/lib/agents/contentPosting'
import { COMMAND_CENTER_AGENTS } from '@/lib/agents/registry'
import AgentCommandCenter from './AgentCommandCenter'

export default async function AgentsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, company_name, plan')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  const profile = profileRows?.[0] ?? null

  if (!profile) redirect('/foundation')

  const [
    { data: activeTasks },
    { data: pendingApprovals },
    { data: recentTasks },
    { data: schedules },
    { data: allOutputs },
    { data: recentOutputs },
  ] = await Promise.all([
    supabase
      .from('agent_tasks')
      .select('*')
      .eq('user_id', profile.id)
      .in('status', ['running', 'pending'])
      .order('created_at', { ascending: false }),

    supabase
      .from('agent_tasks')
      .select('*, agent_outputs(*)')
      .eq('user_id', profile.id)
      .eq('requires_approval', true)
      .eq('status', 'completed')
      .is('approved_at', null)
      .is('rejected_at', null)
      .order('created_at', { ascending: false }),

    supabase
      .from('agent_tasks')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(30),

    supabase
      .from('agent_schedules')
      .select('*')
      .eq('user_id', profile.id),

    supabase
      .from('agent_outputs')
      .select('agent, status')
      .eq('user_id', profile.id),

    supabase
      .from('agent_outputs')
      .select('id, task_id, agent, output_type, title, content, status, created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  // Build scorecard stats per Command Center agent (legacy content agents roll into Content Posting)
  const scorecard = COMMAND_CENTER_AGENTS.map(agent => {
    const agentIds = agent.id === 'content_posting'
      ? contentPostingStatsAgentIds()
      : [agent.id]
    const tasks = (recentTasks ?? []).filter(t => agentIds.includes(t.agent))
    const outputs = (allOutputs ?? []).filter(o => agentIds.includes(o.agent))
    const approved = outputs.filter(o => o.status === 'approved').length
    const approvalRequired = outputs.filter(o => o.status !== 'approved' || o.status === 'pending_approval').length + approved

    const lastTask = tasks[0]
    const schedule = (schedules ?? []).find(s => agentIds.includes(s.agent))

    return {
      agentId: agent.id,
      name: agent.name,
      icon: agent.icon,
      lastRunAt: lastTask?.completed_at ?? lastTask?.updated_at ?? lastTask?.created_at ?? null,
      totalOutputs: outputs.length,
      approvalRate: approvalRequired > 0 ? Math.round((approved / approvalRequired) * 100) : null,
      isScheduled: !!schedule?.is_active,
      scheduleId: schedule?.id ?? null,
    }
  })

  return (
    <AgentCommandCenter
      profileId={profile.id}
      companyName={profile.company_name ?? 'Your business'}
      activeTasks={activeTasks ?? []}
      pendingApprovals={pendingApprovals ?? []}
      recentTasks={recentTasks ?? []}
      recentOutputs={recentOutputs ?? []}
      scorecard={scorecard}
    />
  )
}
