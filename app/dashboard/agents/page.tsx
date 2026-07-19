import { Suspense } from 'react'
import { auth } from '@clerk/nextjs/server'
import { getClerkSessionEmail } from '@/lib/clerk/sessionUser'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { loadDashboardSession } from '@/lib/profiles/getDashboardWorkspaceContext'
import { contentPostingStatsAgentIds } from '@/lib/agents/contentPosting'
import { COMMAND_CENTER_AGENTS, type AgentId } from '@/lib/agents/registry'
import { ensureDefaultAgentSchedules } from '@/lib/agents/ensureDefaultSchedules'
import { listPendingApprovalTasks } from '@/lib/agents/pendingApprovals'
import AgentCommandCenter from './AgentCommandCenter'
import AgentsLegacyRedirects from './AgentsLegacyRedirects'

type ScorecardTaskRow = {
  agent: string
  status: string
  completed_at: string | null
  updated_at: string | null
  created_at: string
  error?: string | null
}

const SCORECARD_AGENT_IDS = [
  ...new Set(
    COMMAND_CENTER_AGENTS.flatMap(agent =>
      agent.id === 'content_posting' ? contentPostingStatsAgentIds() : [agent.id],
    ),
  ),
] as AgentId[]

function taskTimestamp(task: Pick<ScorecardTaskRow, 'completed_at' | 'updated_at' | 'created_at'> | undefined): string | null {
  if (!task) return null
  return task.completed_at ?? task.updated_at ?? task.created_at ?? null
}

function latestTaskForAgentIds(
  agentIds: string[],
  byAgent: Map<string, ScorecardTaskRow>,
): ScorecardTaskRow | undefined {
  let best: ScorecardTaskRow | undefined
  let bestMs = 0
  for (const id of agentIds) {
    const task = byAgent.get(id)
    const ts = taskTimestamp(task)
    if (!task || !ts) continue
    const ms = new Date(ts).getTime()
    if (!best || ms > bestMs) {
      best = task
      bestMs = ms
    }
  }
  return best
}

function latestOutputAt(agentIds: string[], outputs: Array<{ agent: string; created_at: string }>): string | null {
  let best: string | null = null
  for (const output of outputs) {
    if (!agentIds.includes(output.agent)) continue
    if (!best || new Date(output.created_at) > new Date(best)) best = output.created_at
  }
  return best
}

function latestRunAt(taskTime: string | null, outputTime: string | null): string | null {
  if (!taskTime) return outputTime
  if (!outputTime) return taskTime
  return new Date(taskTime) > new Date(outputTime) ? taskTime : outputTime
}

export default async function AgentsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const email = await getClerkSessionEmail()
  const { profile, workspace } = await loadDashboardSession(supabase, userId, email)

  if (!profile) redirect('/foundation')

  const workspaceProfile = workspace?.workspaceProfile ?? profile
  const dataUserId = workspace?.workspaceId ?? profile.id

  // Backfill: existing accounts never got their autonomous schedules seeded
  await ensureDefaultAgentSchedules(supabase, dataUserId).catch(err =>
    console.error('Schedule seeding failed (non-fatal):', err),
  )

  const [
    { count: colorCount },
    { count: fontCount },
    { count: logoCount },
    { count: styleRefCount },
    { data: imageryStyleDoc },
  ] = await Promise.all([
    supabase.from('brand_kit_colors').select('id', { count: 'exact', head: true }).eq('user_id', dataUserId),
    supabase.from('brand_kit_fonts').select('id', { count: 'exact', head: true }).eq('user_id', dataUserId),
    supabase
      .from('brand_kit_assets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', dataUserId)
      .in('asset_type', ['logo_primary', 'logo_alternate', 'logo_icon']),
    supabase
      .from('brand_kit_assets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', dataUserId)
      .eq('asset_type', 'style_reference'),
    supabase
      .from('foundation_documents')
      .select('markdown')
      .eq('user_id', dataUserId)
      .eq('type', 'imagery_style')
      .limit(1)
      .maybeSingle(),
  ])

  const brandKitAvailable =
    (colorCount ?? 0) > 0
    || (fontCount ?? 0) > 0
    || (styleRefCount ?? 0) > 0
    || !!(imageryStyleDoc?.markdown?.trim())
  const hasUploadedLogo = (logoCount ?? 0) > 0

  const [
    { data: activeTasks },
    pendingApprovalsData,
    { data: recentTasks },
    { data: scorecardTasks },
    { data: schedules },
    { data: allOutputs },
    { data: recentOutputs },
  ] = await Promise.all([
    supabase
      .from('agent_tasks')
      .select('*')
      .eq('user_id', dataUserId)
      .in('status', ['running', 'pending'])
      .order('created_at', { ascending: false }),

    listPendingApprovalTasks(supabase, dataUserId),

    supabase
      .from('agent_tasks')
      .select('*, error')
      .eq('user_id', dataUserId)
      .order('created_at', { ascending: false })
      .limit(30),

    supabase
      .from('agent_tasks')
      .select('agent, status, completed_at, updated_at, created_at, error')
      .eq('user_id', dataUserId)
      .in('agent', SCORECARD_AGENT_IDS)
      .order('created_at', { ascending: false }),

    supabase
      .from('agent_schedules')
      .select('*')
      .eq('user_id', dataUserId),

    supabase
      .from('agent_outputs')
      .select('agent, status, created_at')
      .eq('user_id', dataUserId),

    supabase
      .from('agent_outputs')
      .select('id, task_id, agent, output_type, title, content, status, created_at')
      .eq('user_id', dataUserId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  // Build scorecard stats per Command Center agent (legacy content agents roll into Content Posting)
  const latestTaskByAgent = new Map<string, ScorecardTaskRow>()
  for (const task of (scorecardTasks ?? []) as ScorecardTaskRow[]) {
    if (!latestTaskByAgent.has(task.agent)) latestTaskByAgent.set(task.agent, task)
  }

  const scorecard = COMMAND_CENTER_AGENTS.map(agent => {
    const agentIds = agent.id === 'content_posting'
      ? contentPostingStatsAgentIds()
      : [agent.id]
    const outputs = (allOutputs ?? []).filter(o => agentIds.includes(o.agent))
    const approved = outputs.filter(o => o.status === 'approved').length
    const approvalRequired = outputs.filter(o => o.status !== 'approved' || o.status === 'pending_approval').length + approved

    const lastTask = latestTaskForAgentIds(agentIds, latestTaskByAgent)
    const schedule = (schedules ?? []).find(s => agentIds.includes(s.agent))

    return {
      agentId: agent.id,
      name: agent.name,
      icon: agent.icon,
      lastRunAt: latestRunAt(
        taskTimestamp(lastTask),
        latestOutputAt(agentIds, (allOutputs ?? []) as Array<{ agent: string; created_at: string }>),
      ),
      lastRunStatus: lastTask?.status ?? null,
      lastRunError: lastTask?.error ?? null,
      totalOutputs: outputs.length,
      approvalRate: approvalRequired > 0 ? Math.round((approved / approvalRequired) * 100) : null,
      isScheduled: !!schedule?.is_active,
      scheduleId: schedule?.id ?? null,
    }
  })

  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8 text-sm text-text-sec">Loading agents…</div>}>
      <AgentsLegacyRedirects />
      <AgentCommandCenter
        profileId={dataUserId}
        companyName={workspaceProfile.company_name ?? 'Your business'}
        foundationComplete={!!workspaceProfile.foundation_complete}
        activeTasks={activeTasks ?? []}
        pendingApprovals={pendingApprovalsData}
        recentTasks={recentTasks ?? []}
        recentOutputs={recentOutputs ?? []}
        scorecard={scorecard}
      />
    </Suspense>
  )
}
