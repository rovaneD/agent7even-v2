import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { openrouter } from '@/lib/ai/client'
import {
  updateTaskStatus,
  saveAgentOutput,
  buildSystemPrompt,
  chargeAgentRun,
} from '@/lib/agents/runner'
import { AGENTS, type AgentId } from '@/lib/agents/registry'

export const maxDuration = 120

export async function POST(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId: rawAgentId } = await params
  const { taskId, input } = await req.json()

  // URL uses hyphens; registry uses underscores
  const agentId = rawAgentId.replace(/-/g, '_') as AgentId
  const agent = AGENTS[agentId]

  if (!agent) {
    if (taskId) await updateTaskStatus(taskId, 'failed').catch(() => {})
    return NextResponse.json({ error: `Unknown agent: ${rawAgentId}` }, { status: 400 })
  }

  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

  const userId = input.userId as string

  await updateTaskStatus(taskId, 'running')

  try {
    let system = await buildSystemPrompt(userId, agentId)

    if (input.rejection_feedback) {
      system += `\n\nIMPORTANT — Previous version was rejected with this feedback: "${input.rejection_feedback}". Address this directly before anything else.`
    }

    const userMessage = input.instructions
      ? String(input.instructions)
      : `Run your standard ${agent.name} analysis now.`

    const { text, usage } = await generateText({
      model:            openrouter(agent.model),
      system,
      messages:         [{ role: 'user', content: userMessage }],
      maxOutputTokens:  2000,
    })

    await saveAgentOutput({
      taskId,
      userId,
      agent:      agentId,
      outputType: agent.outputType,
      title:      `${agent.name} — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      content:    { raw: text },
    })

    await chargeAgentRun({
      taskId,
      userId,
      inputTokens:  usage.inputTokens  ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      model:        agent.model,
    })

    await updateTaskStatus(taskId, 'completed')
    return NextResponse.json({ success: true })

  } catch (err) {
    await updateTaskStatus(taskId, 'failed').catch(() => {})
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'INSUFFICIENT_CREDITS') {
      return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
    }
    console.error(`[agents/run/${agentId}]`, err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
