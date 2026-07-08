import { AGENTS, type AgentId } from '@/lib/agents/registry'
import { isLegacyContentAgent, type ContentPostingFlow } from '@/lib/agents/contentPosting'

export type RunTrackerPhase = 'generating' | 'done' | 'error'

export interface RunTracker {
  taskId: string
  agent: string
  contentFlow?: ContentPostingFlow
  phase: RunTrackerPhase
  message: string
  detail?: string
  primaryHref?: string
  primaryLabel?: string
}

export function agentDisplayName(agentId: string): string {
  if (isLegacyContentAgent(agentId)) return AGENTS.content_posting.name
  return AGENTS[agentId as AgentId]?.name ?? agentId
}

export function friendlyRunError(error: string | null | undefined): string {
  if (!error) return 'Agent run failed before producing output.'
  if (error.includes('Authentication Required') || error.includes('run-route error 401')) {
    return 'Agent run could not start on this deployment. Try again after the latest deploy finishes.'
  }
  if (error.includes('Unknown agent: content-posting')) {
    return 'Content Posting handler was not reachable on this deployment. Wait for the latest deploy, then try again.'
  }
  if (error.includes('INSUFFICIENT_CREDITS')) {
    return 'Not enough media credits to finish this run. Text agents stay free — top up or upgrade for images and video.'
  }
  const match = error.match(/run-route error \d+: (.+)/)
  if (match) {
    try {
      const parsed = JSON.parse(match[1]) as { error?: string }
      if (parsed.error) return parsed.error
    } catch {
      /* use raw error below */
    }
  }
  return error.length > 180 ? `${error.slice(0, 180)}…` : error
}

export function runTrackerGeneratingMessage(
  agent: string,
  contentFlow?: ContentPostingFlow,
  generatedCompose?: boolean,
): string {
  if (generatedCompose) {
    return 'Composing caption and submitting for approval…'
  }
  if (agent === 'content_posting' && contentFlow === 'single') {
    return 'Generating your post caption from your image…'
  }
  if (agent === 'content_posting' && contentFlow === 'weekly') {
    return 'Building your weekly content plan…'
  }
  return `Running ${agentDisplayName(agent)}…`
}

export function runTrackerDoneState(
  taskId: string,
  agent: string,
  contentFlow?: ContentPostingFlow,
  requiresApproval?: boolean,
  isTeamMember?: boolean,
): Pick<RunTracker, 'message' | 'detail' | 'primaryHref' | 'primaryLabel'> {
  if (agent === 'content_posting' && contentFlow === 'single') {
    return {
      message: 'Done — your caption is ready.',
      detail: isTeamMember
        ? 'It was sent to the account owner\'s approval queue. They will review it before anything publishes.'
        : 'It is in Approvals until you approve it. The Posts page only shows drafts after approval.',
      primaryHref: isTeamMember
        ? `/dashboard/agents/${agent}/outputs?task=${taskId}`
        : `/dashboard/agents/approvals?task=${taskId}&queue=post`,
      primaryLabel: isTeamMember ? 'View your output' : 'Review in Approvals',
    }
  }
  if (requiresApproval) {
    return {
      message: 'Done — output ready for review.',
      detail: isTeamMember
        ? 'Sent to the account owner\'s approval queue — they\'ll review and approve before it goes anywhere.'
        : 'Open Approvals to approve or edit before it goes anywhere.',
      primaryHref: isTeamMember
        ? `/dashboard/agents/${agent}/outputs?task=${taskId}`
        : `/dashboard/agents/approvals?task=${taskId}`,
      primaryLabel: isTeamMember ? 'View your output' : 'Review in Approvals',
    }
  }
  return {
    message: 'Done — run completed.',
    detail: 'Open the output archive to read the full result.',
    primaryHref: `/dashboard/agents/${agent}/outputs`,
    primaryLabel: 'View output',
  }
}
