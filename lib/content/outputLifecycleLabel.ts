/** User-facing lifecycle labels for saved agent outputs (Thread 3 explainability). */

export type OutputLifecycleInfo = {
  label: string
  hint: string | null
  href: string | null
}

function isPostCapableAgent(agent: string): boolean {
  return agent === 'post_caption' || agent === 'content_posting'
}

export function formatOutputLifecycle(
  status: string,
  agent: string,
  taskId?: string | null,
): OutputLifecycleInfo {
  if (status === 'pending_approval') {
    const href = taskId
      ? `/dashboard/agents/approvals?task=${encodeURIComponent(taskId)}`
      : '/dashboard/agents/approvals'
    return {
      label: 'In review',
      hint: 'Waiting in your approval queue',
      href,
    }
  }

  if (status === 'rejected') {
    return {
      label: 'Rejected',
      hint: 'Revise or re-run from Approvals',
      href: '/dashboard/agents/approvals',
    }
  }

  if (status === 'approved') {
    if (isPostCapableAgent(agent)) {
      return {
        label: 'Approved',
        hint: 'Approved posts save as drafts on Posts — schedule when ready',
        href: '/dashboard/posts?status=draft',
      }
    }
    return {
      label: 'Approved',
      hint: 'Saved to archive — reuse in campaigns or agents',
      href: null,
    }
  }

  return {
    label: status.replace(/_/g, ' '),
    hint: null,
    href: null,
  }
}
