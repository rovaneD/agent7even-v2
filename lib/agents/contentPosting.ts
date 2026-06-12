import type { AgentId } from '@/lib/agents/registry'
import { readPostMediaRef } from '@/lib/postAssetLimits'

export type ContentPostingFlow = 'single' | 'weekly'

export type ApprovalQueueKind = 'post' | 'plan' | 'other'

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

/** Classify approval-queue items for Posts vs Plans tabs. */
export function approvalQueueKind(task: {
  agent: string
  input?: Record<string, unknown>
  agent_outputs?: Array<{ content?: Record<string, unknown> }>
}): ApprovalQueueKind {
  const input = (task.input ?? {}) as Record<string, unknown>
  const content = (task.agent_outputs?.[0]?.content ?? {}) as Record<string, unknown>
  const agent = task.agent

  if (agent === 'post_caption') return 'post'
  if (agent === 'weekly_content') return 'plan'
  if (agent === 'content_posting') {
    return resolveContentPostingFlow(input) === 'weekly' ? 'plan' : 'post'
  }

  const media = readPostMediaRef({ ...input, ...content })
  if (content.image_caption_mode && media.media_storage_path) return 'post'

  return 'other'
}

/** Only single-post approvals with image + caption mode should create a Zernio draft. */
export function shouldPublishApprovedPost(opts: {
  agentId: string
  taskInput: Record<string, unknown>
  outputContent: Record<string, unknown>
  caption: string
}): boolean {
  const caption = opts.caption.trim()
  if (!caption) return false

  const media = readPostMediaRef(opts.outputContent)
  if (!media.media_storage_path) return false

  if (opts.agentId === 'post_caption') return true
  if (opts.agentId === 'weekly_content') return false
  if (opts.agentId === 'content_posting') {
    return resolveContentPostingFlow(opts.taskInput) === 'single'
      && opts.outputContent.image_caption_mode === true
  }

  return false
}
