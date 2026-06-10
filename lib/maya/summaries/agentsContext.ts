import type { MayaPageContext } from '@/lib/maya/contextTypes'
import { MAYA_VOICE_RULE } from '@/lib/maya/voiceRules'

type AgentScorecard = {
  name: string
  lastRunAt?: string | null
  totalOutputs: number
  isScheduled: boolean
}

export function buildAgentCommandCenterMayaContext(input: {
  companyName: string
  activeTaskCount: number
  pendingApprovalCount: number
  scorecard: AgentScorecard[]
}): MayaPageContext {
  const agentLines = input.scorecard.length
    ? input.scorecard.map(
        e =>
          `${e.name}: last run ${e.lastRunAt ?? 'never'}, ${e.totalOutputs} output(s), ${e.isScheduled ? 'scheduled' : 'idle'}`,
      ).join('; ')
    : 'no agent activity yet'
  return {
    page: 'AGENT COMMAND CENTER PAGE',
    dataSource: 'live',
    company: input.companyName,
    metrics: [
      `Active tasks: ${input.activeTaskCount}`,
      `Pending approvals: ${input.pendingApprovalCount}`,
      `Agents: ${agentLines}`,
    ],
    affordance: `${MAYA_VOICE_RULE} User can run agents, approve/reject outputs, and manage agent constraints.`,
  }
}

export function buildApprovalsMayaContext(pendingCount: number): MayaPageContext {
  return {
    page: 'APPROVAL QUEUE',
    dataSource: 'live',
    metrics: [`Pending approvals: ${pendingCount}`],
    affordance: `${MAYA_VOICE_RULE} User reviews agent outputs — approve, edit-and-approve, reject-and-redo, or bulk actions after expanding an item.`,
  }
}
