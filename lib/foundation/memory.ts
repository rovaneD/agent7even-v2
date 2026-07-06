import { AGENTS } from '@/lib/agents/registry'

export type AgentMemoryStat = {
  agentId: string
  agentName: string
  total: number
  approved: number
  rejected: number
  pending: number
  approvalRate: number | null
  lastRunAt: string | null
}

export type FoundationMemoryResponse = {
  stats: AgentMemoryStat[]
  totalOutputs: number
  totalApproved: number
  totalRejected: number
  lastActivityAt: string | null
  hasData: boolean
  observations?: Array<{
    signalType: 'approved' | 'rejected' | 'edited'
    summary: string
    createdAt: string
    agentId: string | null
  }>
}

type OutputRow = {
  status: string
  created_at: string
  agent_tasks: { agent: string } | { agent: string }[] | null
}

function resolveAgent(agentTasks: OutputRow['agent_tasks']): string | undefined {
  if (!agentTasks) return undefined
  if (Array.isArray(agentTasks)) return agentTasks[0]?.agent
  return agentTasks.agent
}

export function computeMemoryStats(outputs: OutputRow[]): FoundationMemoryResponse {
  const byAgent: Record<string, { total: number; approved: number; rejected: number; pending: number; lastRunAt: string }> = {}

  for (const row of outputs) {
    const agentId = resolveAgent(row.agent_tasks)
    if (!agentId) continue
    if (!byAgent[agentId]) byAgent[agentId] = { total: 0, approved: 0, rejected: 0, pending: 0, lastRunAt: row.created_at }
    byAgent[agentId].total++
    if (row.status === 'approved') byAgent[agentId].approved++
    else if (row.status === 'rejected') byAgent[agentId].rejected++
    else byAgent[agentId].pending++
    if (row.created_at > byAgent[agentId].lastRunAt) byAgent[agentId].lastRunAt = row.created_at
  }

  const stats: AgentMemoryStat[] = Object.entries(byAgent)
    .map(([agentId, counts]) => {
      const reviewed = counts.approved + counts.rejected
      return {
        agentId,
        agentName: AGENTS[agentId as keyof typeof AGENTS]?.name ?? agentId,
        ...counts,
        approvalRate: reviewed > 0 ? Math.round((counts.approved / reviewed) * 100) : null,
      }
    })
    .sort((a, b) => b.total - a.total)

  const totalOutputs = outputs.length
  const totalApproved = stats.reduce((sum, agent) => sum + agent.approved, 0)
  const totalRejected = stats.reduce((sum, agent) => sum + agent.rejected, 0)
  const lastActivityAt = outputs[0]?.created_at ?? null

  return { stats, totalOutputs, totalApproved, totalRejected, lastActivityAt, hasData: stats.length > 0 }
}
