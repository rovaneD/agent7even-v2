import type { AgentId } from '@/lib/agents/registry'
import { captionLimitForPlatform, primaryPlatformFromTaskInput } from '@/lib/social/postConstraints'
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

/** Prefer the newest output when a task has more than one row. */
export function latestAgentOutput<T extends { created_at?: string | null }>(
  outputs: T[] | null | undefined,
): T | undefined {
  if (!outputs?.length) return undefined
  return [...outputs].sort((a, b) => {
    const da = a.created_at ? new Date(a.created_at).getTime() : 0
    const db = b.created_at ? new Date(b.created_at).getTime() : 0
    return db - da
  })[0]
}

/** Classify approval-queue items for Posts vs Plans tabs. */
export function approvalQueueKind(task: {
  agent: string
  input?: Record<string, unknown>
  agent_outputs?: Array<{ content?: Record<string, unknown>; created_at?: string | null }>
}): ApprovalQueueKind {
  const input = (task.input ?? {}) as Record<string, unknown>
  const content = (latestAgentOutput(task.agent_outputs)?.content ?? {}) as Record<string, unknown>
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

/** Heuristic: model returned a weekly plan instead of one caption. */
export function looksLikeWeeklyContentPlan(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/^#\s*7-?\s*day/i.test(t)) return true
  if (/\*\*Week Goal:/i.test(t)) return true
  if (/(?:^|\n)\s*(?:Day|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*[1-7]/i.test(t) && t.length > 800) return true
  if (t.includes('7-day') && t.includes('content plan')) return true
  return false
}

/** Why a single-post approval cannot create a Zernio draft (null = ok to publish). */
export function singlePostPublishBlockReason(opts: {
  agentId: string
  taskInput: Record<string, unknown>
  outputContent: Record<string, unknown>
  caption: string
}): string | null {
  const caption = opts.caption.trim()
  if (!caption) return 'Caption is empty.'

  const media = readPostMediaRef(opts.outputContent)
  if (!media.media_storage_path) return 'No post image attached to this output.'

  if (opts.agentId === 'weekly_content') return 'Weekly plans stay in your output archive — they are not published to Posts.'
  if (opts.agentId === 'content_posting' && resolveContentPostingFlow(opts.taskInput) === 'weekly') {
    return 'Weekly plans stay in your output archive — they are not published to Posts.'
  }
  if (opts.agentId === 'content_posting' && resolveContentPostingFlow(opts.taskInput) !== 'single') {
    return 'Only Single post approvals with an attached image create a Posts draft.'
  }
  if (opts.agentId === 'content_posting' && opts.outputContent.image_caption_mode !== true) {
    return 'This output is not marked as a single-post caption.'
  }

  if (looksLikeWeeklyContentPlan(caption)) {
    return 'Output looks like a weekly content plan, not one social caption. Edit it or reject and re-run Single post.'
  }

  const platform = primaryPlatformFromTaskInput(opts.taskInput)
  const limit = captionLimitForPlatform(platform)
  if (caption.length > limit) {
    return `Caption is ${caption.length.toLocaleString()} characters — over the ${platform} limit of ${limit.toLocaleString()}. Shorten it before approving.`
  }

  if (opts.agentId === 'post_caption') return null
  if (opts.agentId === 'content_posting' && resolveContentPostingFlow(opts.taskInput) === 'single') return null
  return 'This approval type does not publish to Posts.'
}

/** Only valid single-post approvals with image + caption should create a Zernio draft. */
export function shouldPublishApprovedPost(opts: {
  agentId: string
  taskInput: Record<string, unknown>
  outputContent: Record<string, unknown>
  caption: string
}): boolean {
  return singlePostPublishBlockReason(opts) === null
}
