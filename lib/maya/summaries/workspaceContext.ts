import type { MayaPageContext } from '@/lib/maya/contextTypes'
import { formatActiveFormState, truncateForMaya } from '@/lib/maya/formStateContext'
import { MAYA_VOICE_RULE } from '@/lib/maya/voiceRules'
import {
  labelAnnualRevenueBucket,
  labelEmployeeCountBucket,
} from '@/lib/profile/businessSizing'

type Invoice = {
  number?: string | null
  amount_paid?: number | null
  status?: string | null
  created?: number | null
}

type PlanInfo = { name: string; monthlyPrice: number } | null

export function buildBillingMayaContext(input: {
  currentPlan: PlanInfo
  status: string | null
  subscriptionId: string | null
  invoices: Invoice[]
  formatAmount: (cents: number | null | undefined) => string
  formatDate: (unix: number | null | undefined) => string
}): MayaPageContext {
  const invoiceLines = input.invoices.slice(0, 5).map(
    inv =>
      `${inv.number ?? 'Invoice'}: ${input.formatAmount(inv.amount_paid)} (${inv.status ?? 'unknown'}) — ${input.formatDate(inv.created)}`,
  )
  return {
    page: 'BILLING PAGE',
    dataSource: 'live',
    metrics: [
      `Current plan: ${input.currentPlan ? `${input.currentPlan.name} ($${input.currentPlan.monthlyPrice}/mo)` : 'No active plan'}`,
      `Subscription status: ${input.status ?? 'none'}`,
      `Recent invoices (${input.invoices.length} total): ${invoiceLines.length ? invoiceLines.join('; ') : 'none yet'}`,
    ],
    affordance: `${MAYA_VOICE_RULE} User can view their plan, upgrade tiers, and open the Stripe billing portal.`,
  }
}

type ServiceOrder = { title: string; status: string }
type ServiceCatalogItem = { name: string; price: string; type: string }
const CLOSED_ORDER_STATUSES = ['approved', 'cancelled', 'completed']

export function buildServicesMayaContext(input: {
  plan: string | null | undefined
  orders: ServiceOrder[]
  services: ServiceCatalogItem[]
}): MayaPageContext {
  const activeOrders = input.orders.filter(o => !CLOSED_ORDER_STATUSES.includes(o.status))
  return {
    page: 'SERVICES PAGE',
    dataSource: 'live',
    metrics: [
      `Plan: ${input.plan ?? 'none'}`,
      `Active orders (${activeOrders.length}): ${activeOrders.length ? activeOrders.map(o => `${o.title} [${o.status}]`).join('; ') : 'none'}`,
      `Available services: ${input.services.map(s => `${s.name} (${s.price}, ${s.type})`).join('; ')}`,
    ],
    affordance: `${MAYA_VOICE_RULE} User can request marketing services or track existing orders.`,
  }
}

type TeamMember = {
  role: string
  status: string
  profiles?: { full_name?: string | null } | null
  invited_email?: string | null
}

export function buildTeamMayaContext(input: {
  companyName: string
  plan: string
  includedSeats: number
  totalMembers: number
  activeMembers: number
  pendingMembers: number
  extraSeats: number
  members: TeamMember[]
}): MayaPageContext {
  const memberLines = input.members.length
    ? input.members.map(m => `${m.profiles?.full_name ?? m.invited_email} (${m.role}, ${m.status})`).join('; ')
    : 'only the account owner'
  return {
    page: 'TEAM PAGE',
    dataSource: 'live',
    company: input.companyName,
    metrics: [
      `Plan: ${input.plan}`,
      `Seats included: ${input.includedSeats}`,
      `Seats used: ${input.totalMembers + 1} (${input.activeMembers} active + ${input.pendingMembers} pending + owner)`,
      `Extra paid seats: ${input.extraSeats}`,
      `Members: ${memberLines}`,
    ],
    affordance: `${MAYA_VOICE_RULE} User can invite team members and manage roles.`,
  }
}

type ProfileSettings = {
  full_name?: string | null
  email?: string | null
  company_name?: string | null
  website_url?: string | null
  instagram_handle?: string | null
  employee_count_bucket?: string | null
  annual_revenue_bucket?: string | null
  business_type?: string | null
  plan?: string | null
  status?: string | null
}

export type SettingsFormState = {
  companyName: string
  websiteUrl: string
  instagramHandle: string
  employeeCountBucket: string
  annualRevenueBucket: string
  emailDigest: boolean
  emailApprovals: boolean
  emailWeekly: boolean
  isDirty: boolean
}

export function buildSettingsMayaContext(
  profile: ProfileSettings,
  form?: SettingsFormState,
): MayaPageContext {
  const metrics = [
    `Full name: ${profile.full_name ?? 'not set'}`,
    `Email: ${profile.email ?? 'not set'}`,
    `Company: ${profile.company_name ?? 'not set'}`,
    `Website: ${profile.website_url ?? 'not set'}`,
    `Instagram: ${profile.instagram_handle ? `@${profile.instagram_handle}` : 'not set'}`,
    `Team size: ${labelEmployeeCountBucket(profile.employee_count_bucket ?? null)}`,
    `Annual revenue: ${labelAnnualRevenueBucket(profile.annual_revenue_bucket ?? null)}`,
    `Business type: ${profile.business_type ?? 'not set'}`,
    `Plan: ${profile.plan ?? 'none'}`,
    `Account status: ${profile.status ?? 'unknown'}`,
  ]

  const baseAffordance =
    `${MAYA_VOICE_RULE} User can update company, website, and Instagram. Name and email are managed via Clerk.`

  if (form) {
    const businessFields = [
      { label: 'Company name', value: form.companyName },
      { label: 'Website URL', value: form.websiteUrl },
      {
        label: 'Instagram handle',
        value: form.instagramHandle.trim() ? `@${form.instagramHandle.replace(/^@/, '')}` : '',
      },
      {
        label: 'Team size',
        value: form.employeeCountBucket.trim()
          ? labelEmployeeCountBucket(form.employeeCountBucket)
          : '',
      },
      {
        label: 'Annual revenue',
        value: form.annualRevenueBucket.trim()
          ? labelAnnualRevenueBucket(form.annualRevenueBucket)
          : '',
      },
    ]
    const filled = businessFields
      .filter(f => f.value.trim())
      .map(f => `${f.label}: ${truncateForMaya(f.value)}`)
    const empty = businessFields.filter(f => !f.value.trim()).map(f => f.label)
    const prefs = [
      `Morning digest: ${form.emailDigest ? 'on' : 'off'}`,
      `Approval alerts: ${form.emailApprovals ? 'on' : 'off'}`,
      `Weekly summary: ${form.emailWeekly ? 'on' : 'off'}`,
    ]
    const dirtyNote = form.isDirty ? ' · Unsaved changes on screen' : ''

    return {
      page: 'SETTINGS PAGE',
      dataSource: 'live',
      activeView: {
        label: 'Account settings form',
        state: `${formatActiveFormState(filled, empty)} · ${prefs.join(' · ')}${dirtyNote}`,
      },
      metrics,
      affordance:
        `${baseAffordance} The user has the settings form on screen. Use visible field values — do not re-ask for information already shown (e.g. website URL in the Website URL field).`,
    }
  }

  return {
    page: 'SETTINGS PAGE',
    dataSource: 'live',
    metrics,
    affordance: baseAffordance,
  }
}

type Notification = { type: string; title: string; read: boolean }

export function buildNotificationsMayaContext(input: {
  notifications: Notification[]
  typeLabel: (type: string) => string
}): MayaPageContext {
  const unread = input.notifications.filter(n => !n.read).length
  const recent = input.notifications.slice(0, 5).map(
    n => `[${input.typeLabel(n.type)}] "${n.title}" (${n.read ? 'read' : 'unread'})`,
  )
  return {
    page: 'NOTIFICATIONS PAGE',
    dataSource: 'live',
    metrics: [
      `Unread: ${unread}`,
      `Total: ${input.notifications.length}`,
      `Recent: ${recent.length ? recent.join('; ') : 'none yet'}`,
    ],
    affordance: `${MAYA_VOICE_RULE} User can mark notifications read and follow links to relevant pages.`,
  }
}

export function buildDeliverablesMayaContext(input: {
  companyName: string
  deliverables: { project_name: string }[]
}): MayaPageContext {
  const grouped = input.deliverables.reduce<Record<string, number>>((acc, d) => {
    acc[d.project_name] = (acc[d.project_name] ?? 0) + 1
    return acc
  }, {})
  const projects = Object.entries(grouped).map(([name, count]) => `${name}: ${count} file(s)`)
  return {
    page: 'DELIVERABLES PAGE',
    dataSource: 'live',
    company: input.companyName,
    metrics: [
      `Total files: ${input.deliverables.length}`,
      `Projects: ${projects.length ? projects.join('; ') : 'none yet'}`,
    ],
    affordance: `${MAYA_VOICE_RULE} User can download Agent7even files and upload briefs and assets.`,
  }
}

type SupportTicket = { subject: string; status: string; priority?: string | null }

export function buildSupportMayaContext(input: {
  companyName: string
  tickets: SupportTicket[]
}): MayaPageContext {
  const open = input.tickets.filter(t => t.status === 'open').length
  const lines = input.tickets.length
    ? input.tickets.map(t => `"${t.subject}" [${t.status}, ${t.priority ?? 'low'}]`).join('; ')
    : 'none yet'
  return {
    page: 'SUPPORT PAGE',
    dataSource: 'live',
    company: input.companyName,
    metrics: [`Open tickets: ${open}`, `All tickets (${input.tickets.length}): ${lines}`],
    affordance: `${MAYA_VOICE_RULE} User can view tickets or open a new support ticket with the Agent7even team.`,
  }
}
