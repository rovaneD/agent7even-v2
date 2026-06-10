import type { MayaPageContext } from '@/lib/maya/contextTypes'
import { MAYA_ADMIN_VOICE_RULE } from '@/lib/maya/voiceRules'

export function buildAdminCommandCenterMayaContext(input: {
  totalClients: number
  activeClients: number
  atRiskClients: number
  pendingOrderCount: number
  openTickets: number
  agentRunsThisMonth: number
  apiCostThisMonth: number
  recentOrders: { title: string; status: string }[]
  recentClients: { company_name?: string | null; full_name?: string | null; email?: string | null }[]
}): MayaPageContext {
  return {
    page: 'ADMIN — COMMAND CENTER',
    dataSource: 'live',
    metrics: [
      `Total clients: ${input.totalClients} (${input.activeClients} active, ${input.atRiskClients} at-risk)`,
      `Pending orders: ${input.pendingOrderCount}`,
      `Open support tickets: ${input.openTickets}`,
      `Agent runs this month: ${input.agentRunsThisMonth}`,
      `API cost this month: $${input.apiCostThisMonth.toFixed(2)}`,
      `Recent orders: ${input.recentOrders.map(o => `${o.title} [${o.status}]`).join('; ') || 'none'}`,
      `Recent clients: ${input.recentClients.map(c => c.company_name || c.full_name || c.email || '—').join('; ') || 'none'}`,
    ],
    affordance: MAYA_ADMIN_VOICE_RULE,
  }
}

export function buildAdminRevenueMayaContext(input: {
  mrr: number
  activeCount: number
  pausedCount: number
  planCounts: Record<string, number>
  recentChargesTotal: string
  recentChargesCount: number
  activeSubscribers: string
}): MayaPageContext {
  return {
    page: 'ADMIN — REVENUE',
    dataSource: 'live',
    metrics: [
      `MRR: $${input.mrr.toLocaleString()} | ARR: $${(input.mrr * 12).toLocaleString()}`,
      `Active clients: ${input.activeCount} | Paused: ${input.pausedCount}`,
      `Plans — Starter: ${input.planCounts.starter ?? 0}, Growth: ${input.planCounts.growth ?? 0}, ProAgent: ${input.planCounts.proagent ?? 0}`,
      `Recent Stripe charges (20): ${input.recentChargesTotal} across ${input.recentChargesCount} payments`,
      `Active subscribers: ${input.activeSubscribers}`,
    ],
    affordance: MAYA_ADMIN_VOICE_RULE,
  }
}

export function buildAdminOrdersMayaContext(input: {
  total: number
  activeCount: number
  completedCount: number
  activeSummary: string
}): MayaPageContext {
  return {
    page: 'ADMIN — ORDERS',
    dataSource: 'live',
    metrics: [
      `Total: ${input.total} (${input.activeCount} active, ${input.completedCount} completed)`,
      `Active orders: ${input.activeSummary}`,
    ],
    affordance: MAYA_ADMIN_VOICE_RULE,
  }
}

export function buildAdminSupportListMayaContext(input: {
  total: number
  openCount: number
  closedCount: number
  openSummary: string
}): MayaPageContext {
  return {
    page: 'ADMIN — SUPPORT',
    dataSource: 'live',
    metrics: [
      `Total tickets: ${input.total} (${input.openCount} open, ${input.closedCount} closed)`,
      `Open tickets: ${input.openSummary}`,
    ],
    affordance: MAYA_ADMIN_VOICE_RULE,
  }
}

export function buildAdminInquiriesListMayaContext(input: {
  total: number
  activeCount: number
  closedCount: number
  activeSummary: string
}): MayaPageContext {
  return {
    page: 'ADMIN — PROJECT INQUIRIES',
    dataSource: 'live',
    metrics: [
      `Total: ${input.total} (${input.activeCount} active, ${input.closedCount} closed)`,
      `Active: ${input.activeSummary}`,
    ],
    affordance: MAYA_ADMIN_VOICE_RULE,
  }
}

export function buildAdminSettingsMayaContext(input: {
  notifyEmail: string
  starterAiLimit: number
  bannerActive: boolean
  bannerMessage?: string
  bannerType?: string
  promptCount: number
  activePromptCount: number
  serviceCount: number
  activeServiceCount: number
  userCount: number
  clientCount?: number
  adminCount?: number
}): MayaPageContext {
  const banner = input.bannerActive
    ? `ACTIVE — "${input.bannerMessage}" (${input.bannerType})`
    : 'disabled'
  const userDetail = input.clientCount != null && input.adminCount != null
    ? `${input.userCount} (${input.clientCount} clients, ${input.adminCount} admins)`
    : `${input.userCount}`
  return {
    page: 'ADMIN — SETTINGS',
    dataSource: 'live',
    metrics: [
      `Notification email: ${input.notifyEmail}`,
      `Starter AI run limit: ${input.starterAiLimit} runs/month`,
      `Platform banner: ${banner}`,
      `Prompt library: ${input.promptCount} prompts (${input.activePromptCount} active)`,
      `Service catalogue: ${input.serviceCount} services (${input.activeServiceCount} active)`,
      `Total users: ${userDetail}`,
    ],
    affordance: MAYA_ADMIN_VOICE_RULE,
  }
}

export function buildAdminClientDetailMayaContext(input: {
  clientName: string
  companyName?: string | null
  email?: string | null
  plan?: string | null
  status?: string | null
  foundationScore?: number | null
  engagementScore?: number | null
  foundationComplete?: boolean | null
  lastActive?: string | null
  recentActivity?: string
  supportTickets?: string
}): MayaPageContext {
  return {
    page: `ADMIN — CLIENT DETAIL: ${input.clientName}`,
    dataSource: 'live',
    metrics: [
      `Company: ${input.companyName ?? '—'}`,
      `Email: ${input.email ?? '—'}`,
      `Plan: ${input.plan ?? 'none'} | Status: ${input.status ?? '—'}`,
      `Foundation score: ${input.foundationScore ?? 0} | Engagement: ${input.engagementScore ?? 0}`,
      `Foundation complete: ${input.foundationComplete ? 'yes' : 'no'}`,
      `Last active: ${input.lastActive ?? 'never'}`,
      ...(input.recentActivity ? [`Recent activity: ${input.recentActivity}`] : []),
      ...(input.supportTickets ? [`Support tickets: ${input.supportTickets}`] : []),
    ],
    affordance: MAYA_ADMIN_VOICE_RULE,
  }
}

type ClientRow = {
  full_name?: string | null
  email?: string | null
  company_name?: string | null
  plan?: string | null
  foundation_score?: number | null
  engagement_score?: number | null
  last_active_at?: string | null
}

export function buildAdminClientsListMayaContext(clients: ClientRow[]): MayaPageContext {
  const lines = clients.slice(0, 25).map(
    c =>
      `${c.full_name || c.email || '—'} | ${c.company_name || '—'} | plan: ${c.plan ?? 'none'} | foundation: ${c.foundation_score ?? 0} | engagement: ${c.engagement_score ?? 0}`,
  )
  return {
    page: 'ADMIN — CLIENTS PAGE',
    dataSource: 'live',
    metrics: [`${clients.length} clients`, ...lines],
    affordance: MAYA_ADMIN_VOICE_RULE,
  }
}

export function buildAdminAgentCostsMayaContext(input: {
  totalCost: number
  modelSummary: string
  orchestrationSummary: string
}): MayaPageContext {
  return {
    page: 'ADMIN — REVENUE: AGENT COSTS',
    dataSource: 'live',
    metrics: [
      `Total agent API cost this month: $${input.totalCost.toFixed(4)}`,
      `Cost by model: ${input.modelSummary}`,
      `Recent orchestrations: ${input.orchestrationSummary}`,
    ],
    affordance: MAYA_ADMIN_VOICE_RULE,
  }
}

export function buildAdminInquiryDetailMayaContext(input: {
  projectName: string
  serviceLabel: string
  clientLabel: string
  status: string
  timeline?: string | null
  budgetRange?: string | null
  hasExistingBrand: boolean | null
  proposalUrl?: string | null
}): MayaPageContext {
  return {
    page: `ADMIN — INQUIRY DETAIL: ${input.projectName}`,
    dataSource: 'live',
    metrics: [
      `Service type: ${input.serviceLabel}`,
      `Client: ${input.clientLabel}`,
      `Status: ${input.status}`,
      `Timeline: ${input.timeline ?? 'not specified'} | Budget: ${input.budgetRange ?? 'not specified'}`,
      `Existing brand: ${input.hasExistingBrand === null ? 'not specified' : input.hasExistingBrand ? 'yes' : 'no'}`,
      input.proposalUrl ? `Proposal: ${input.proposalUrl}` : 'No proposal link yet',
    ],
    affordance: MAYA_ADMIN_VOICE_RULE,
  }
}

export function buildAdminSupportThreadMayaContext(input: {
  subject: string
  clientLabel: string
  status: string
  priority?: string | null
  messageCount: number
  latestPreview?: string
}): MayaPageContext {
  return {
    page: `ADMIN — SUPPORT THREAD: "${input.subject}"`,
    dataSource: 'live',
    metrics: [
      `Client: ${input.clientLabel}`,
      `Status: ${input.status} | Priority: ${input.priority ?? 'low'}`,
      `Messages: ${input.messageCount}`,
      input.latestPreview ? `Latest: ${input.latestPreview}` : 'No messages yet',
    ],
    affordance: MAYA_ADMIN_VOICE_RULE,
  }
}

export function buildAdminCostActivityMayaContext(input: {
  mrr: number
  totalCost: number
  activeAccounts: number
  totalTasks: number
  topAccountsSummary: string
}): MayaPageContext {
  return {
    page: 'ADMIN — COST & USAGE',
    dataSource: 'live',
    metrics: [
      `MRR: $${input.mrr} | AI cost this month: $${input.totalCost.toFixed(4)}`,
      `Active accounts: ${input.activeAccounts} | Total tasks: ${input.totalTasks}`,
      `Gross margin: $${(input.mrr - input.totalCost).toFixed(2)}`,
      `Top accounts by cost: ${input.topAccountsSummary}`,
    ],
    affordance: MAYA_ADMIN_VOICE_RULE,
  }
}
