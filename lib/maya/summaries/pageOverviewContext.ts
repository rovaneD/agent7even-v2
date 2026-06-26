import type { MayaPageContext } from '@/lib/maya/contextTypes'
import { MAYA_VOICE_RULE } from '@/lib/maya/voiceRules'

export function buildDashboardOverviewMayaContext(input: {
  displayName: string
  plan: string | null | undefined
  hasPlan: boolean
  pendingApprovals?: number
  activeCampaigns?: number
  agentsRun?: number
  topGoal?: string | null
}): MayaPageContext {
  const metrics = [
    `Plan: ${input.plan ?? 'none'}`,
    input.hasPlan
      ? `Plan active: ${input.plan}`
      : 'No active plan — user needs a plan to unlock agents and campaigns',
  ]
  if (typeof input.pendingApprovals === 'number') {
    metrics.push(`Pending approvals: ${input.pendingApprovals}`)
  }
  if (typeof input.activeCampaigns === 'number') {
    metrics.push(`Active campaigns: ${input.activeCampaigns}`)
  }
  if (typeof input.agentsRun === 'number') {
    metrics.push(`Completed agent runs: ${input.agentsRun}`)
  }
  if (input.topGoal) {
    metrics.push(`Top goal: ${input.topGoal}`)
  }

  return {
    page: 'DASHBOARD PAGE',
    dataSource: 'live',
    company: input.displayName,
    metrics,
    affordance: `${MAYA_VOICE_RULE} User landed on the dashboard morning brief — summarize what needs attention (approvals, today's plan, next move). Do not recite all metrics. One practical next step only.`,
  }
}

type Campaign = { title: string; status: string }

export function buildCampaignsMayaContext(campaigns: Campaign[]): MayaPageContext {
  const lines = campaigns.length
    ? campaigns.map(c => `${c.title} [${c.status}]`).join('; ')
    : 'none yet'
  return {
    page: 'CAMPAIGNS PAGE',
    dataSource: 'live',
    metrics: [`Total campaigns: ${campaigns.length}`, `Campaigns: ${lines}`],
    affordance: `${MAYA_VOICE_RULE} User can create campaigns or review existing ones.`,
  }
}

type CalendarCampaign = { title: string; status: string }
type CalendarEntry = { week: number; day: string; channel: string; type: string; content: string }

export function buildCalendarMayaContext(input: {
  companyName: string
  activeCampaigns: CalendarCampaign[]
  entries: CalendarEntry[]
}): MayaPageContext {
  const campaignLines = input.activeCampaigns.length
    ? input.activeCampaigns.map(c => `${c.title} (${c.status})`).join('; ')
    : 'none'
  const nextActions = input.entries.slice(0, 5).map(
    e => `Week ${e.week} ${e.day}: ${e.channel} ${e.type} — ${e.content}`,
  )
  return {
    page: 'CONTENT CALENDAR PAGE',
    dataSource: 'live',
    company: input.companyName,
    metrics: [
      `Active campaigns: ${input.activeCampaigns.length}`,
      `Planned content items: ${input.entries.length}`,
      `Campaigns: ${campaignLines}`,
      `Upcoming items: ${nextActions.length ? nextActions.join('; ') : 'none'}`,
    ],
    affordance: `${MAYA_VOICE_RULE} User reviews planned campaign content — help turn items into captions, emails, posts, or schedule-ready assets.`,
  }
}
