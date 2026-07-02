/** User-facing lifecycle labels for saved agent outputs (Thread 3 explainability). */

import {
  lifecycleStageFromOutputStatus,
  lifecycleStageLabel,
  type ContentLifecycleStage,
} from '@/lib/content/agentOutputLifecycle'

export type OutputLifecycleInfo = {
  label: string
  hint: string | null
  href: string | null
}

function isPostCapableAgent(agent: string): boolean {
  return agent === 'post_caption' || agent === 'content_posting'
}

function hrefForStage(stage: ContentLifecycleStage, taskId?: string | null): string | null {
  if (stage === 'review') {
    return taskId
      ? `/dashboard/agents/approvals?task=${encodeURIComponent(taskId)}`
      : '/dashboard/agents/approvals'
  }
  if (stage === 'rejected') return '/dashboard/agents/approvals'
  if (stage === 'approved') return '/dashboard/posts?status=draft'
  if (stage === 'draft') return '/dashboard/posts?status=draft'
  if (stage === 'scheduled') return '/dashboard/posts?status=scheduled'
  if (stage === 'published') return '/dashboard/posts?status=published'
  return null
}

function hintForStage(stage: ContentLifecycleStage, agent: string): string | null {
  switch (stage) {
    case 'review':
      return 'Waiting in your approval queue'
    case 'approved':
      return isPostCapableAgent(agent)
        ? 'Approved — send to Posts or schedule when ready'
        : 'Saved to archive — reuse in campaigns or agents'
    case 'draft':
      return 'Draft on Posts — schedule when ready'
    case 'scheduled':
      return 'Queued to publish'
    case 'published':
      return 'Live on connected accounts'
    case 'rejected':
      return 'Revise or re-run from Approvals'
  }
}

export function formatOutputLifecycle(
  status: string,
  agent: string,
  taskId?: string | null,
  lifecycleStage?: string | null,
): OutputLifecycleInfo {
  const stage = (lifecycleStage as ContentLifecycleStage | null)
    ?? lifecycleStageFromOutputStatus(status)

  return {
    label: lifecycleStageLabel(stage),
    hint: hintForStage(stage, agent),
    href: hrefForStage(stage, taskId),
  }
}
