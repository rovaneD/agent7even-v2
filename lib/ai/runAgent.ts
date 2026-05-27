import { streamText } from 'ai'
import { models, AgentName } from './client'

interface RunAgentParams {
  agent: AgentName
  system: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[]
  maxOutputTokens?: number
}

export async function runAgent({ agent, system, messages, maxOutputTokens = 2000 }: RunAgentParams) {
  const result = await streamText({
    model: models[agent],
    system,
    messages,
    maxOutputTokens,
  })
  return result.toUIMessageStreamResponse()
}
