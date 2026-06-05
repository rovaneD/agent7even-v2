import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { AGENTS } from '@/lib/agents/registry'

export type AgentMemoryStat = {
  agentId: string
  agentName: string
  total: number
  approved: number
  rejected: number
  pending: number
  approvalRate: number | null  // null when no reviewed outputs yet
  lastRunAt: string | null
}

export type FoundationMemoryResponse = {
  stats: AgentMemoryStat[]
  totalOutputs: number
  totalApproved: number
  totalRejected: number
  lastActivityAt: string | null
  hasData: boolean
}

type OutputRow = {
  status: string
  created_at: string
  agent_tasks: { agent: string } | { agent: string }[] | null
}

function resolveAgent(agent_tasks: OutputRow['agent_tasks']): string | undefined {
  if (!agent_tasks) return undefined
  if (Array.isArray(agent_tasks)) return agent_tasks[0]?.agent
  return agent_tasks.agent
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

  const stats: AgentMemoryStat[] = Object.entries(byAgent).map(([agentId, counts]) => {
    const reviewed = counts.approved + counts.rejected
    return {
      agentId,
      agentName: AGENTS[agentId as keyof typeof AGENTS]?.name ?? agentId,
      ...counts,
      approvalRate: reviewed > 0 ? Math.round((counts.approved / reviewed) * 100) : null,
    }
  }).sort((a, b) => b.total - a.total)

  const totalOutputs = outputs.length
  const totalApproved = stats.reduce((s, a) => s + a.approved, 0)
  const totalRejected = stats.reduce((s, a) => s + a.rejected, 0)
  const lastActivityAt = outputs[0]?.created_at ?? null

  return { stats, totalOutputs, totalApproved, totalRejected, lastActivityAt, hasData: stats.length > 0 }
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServiceClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: outputs } = await supabase
      .from('agent_outputs')
      .select('status, created_at, agent_tasks(agent)')
      .eq('user_id', profile.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    return NextResponse.json(computeMemoryStats((outputs ?? []) as unknown as OutputRow[]))
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
