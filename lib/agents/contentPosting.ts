import type { AgentId } from '@/lib/agents/registry'

export type ContentPostingFlow = 'single' | 'weekly'

/** Legacy agent ids replaced in Command Center by `content_posting`. */
export const LEGACY_CONTENT_AGENT_IDS = ['weekly_content', 'post_caption'] as const

export const CONTENT_POSTING_FLOW_LABELS: Record<ContentPostingFlow, string> = {
  single: 'Single post',
  weekly: 'Weekly content',
}

export function resolveContentPostingFlow(input: Record<string, unknown>): ContentPostingFlow {
  const raw = input.contentFlow ?? input.content_flow
  return raw === 'weekly' ? 'weekly' : 'single'
}

export function isSinglePostRun(agentId: string, input: Record<string, unknown>): boolean {
  if (agentId === 'post_caption') return true
  if (agentId === 'weekly_content') return false
  if (agentId === 'content_posting') return resolveContentPostingFlow(input) === 'single'
  return false
}

export function isWeeklyContentRun(agentId: string, input: Record<string, unknown>): boolean {
  if (agentId === 'weekly_content') return true
  if (agentId === 'post_caption') return false
  if (agentId === 'content_posting') return resolveContentPostingFlow(input) === 'weekly'
  return false
}

/** Agent ids to aggregate for Content Posting scorecard / history. */
export function contentPostingStatsAgentIds(): AgentId[] {
  return ['content_posting', 'weekly_content', 'post_caption']
}

export function isLegacyContentAgent(id: string): boolean {
  return (LEGACY_CONTENT_AGENT_IDS as readonly string[]).includes(id)
}

export function isCommandCenterAgent(id: AgentId): boolean {
  return !isLegacyContentAgent(id)
}
