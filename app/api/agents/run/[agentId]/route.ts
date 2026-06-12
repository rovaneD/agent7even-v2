import { NextResponse } from 'next/server'
import { executeAgentRun } from '@/lib/agents/executeAgentRun'
import { AGENTS, type AgentId } from '@/lib/agents/registry'

export const maxDuration = 120

export async function POST(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const secret = process.env.INTERNAL_JOB_SECRET
  if (!secret || req.headers.get('x-internal-secret') !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { agentId: rawAgentId } = await params
  const { taskId, input } = await req.json()

  const agentId = rawAgentId.replace(/-/g, '_') as AgentId
  if (!AGENTS[agentId]) {
    return NextResponse.json({ error: `Unknown agent: ${rawAgentId}` }, { status: 400 })
  }

  const userId = input?.userId as string
  const result = await executeAgentRun({
    agentId,
    taskId,
    userId,
    taskInput: (input ?? {}) as Record<string, unknown>,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true })
}
