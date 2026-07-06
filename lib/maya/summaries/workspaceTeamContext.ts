import type { SupabaseClient } from '@supabase/supabase-js'
import { agentDisplayName } from '@/lib/agents/digestPreview'
import { getPendingApprovalCount } from '@/lib/agents/pendingApprovals'
import { formatProfileDisplayName } from '@/lib/profiles/resolveActorName'
import { getTeamPermissions, type TeamPermissions } from '@/lib/teamPermissions'
import type { PermissionKey } from '@/lib/teamPermissionsShared'
import {
  listOpenWorkspaceAssignments,
  listTasksAssignedToMember,
  type AssignedTaskRow,
} from '@/lib/team/taskAssignments'
import { listWorkspaceActivity, type WorkspaceActivityItem } from '@/lib/team/workspaceActivity'

export type WorkspaceTeamContext = {
  memberId: string
  workspaceId: string
  memberName: string
  isOwner: boolean
  ownerCompanyName: string | null
  permissions: TeamPermissions
  assignedToMember: AssignedTaskRow[]
  openAssignments: AssignedTaskRow[]
  pendingApprovalCount: number
  recentActivity: WorkspaceActivityItem[]
}

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  billing: 'Billing',
  services: 'Services',
  ai_toolkit: 'AI Toolkit',
  analytics: 'Analytics',
  brand_kit: 'Brand Kit',
  deliverables: 'Deliverables',
  support: 'Support',
}

function formatAssignmentLine(row: AssignedTaskRow, perspective: 'owner' | 'member'): string {
  const agent = assignmentAgentLabel(row.agent)
  const note = row.assignment_note?.trim()
  const due = row.assignment_due_at
    ? ` due ${new Date(row.assignment_due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : ''

  if (perspective === 'member') {
    const from = row.assignerName ?? 'Account owner'
    return `${agent} from ${from}${due}${note ? ` — "${note.slice(0, 120)}"` : ''}`
  }

  const to = row.assigneeName ?? 'Team member'
  return `${agent} → ${to}${due}${note ? ` — "${note.slice(0, 120)}"` : ''}`
}

function assignmentAgentLabel(agentId: string): string {
  return agentDisplayName(agentId)
}

function formatPermissionSummary(permissions: TeamPermissions): string {
  if (permissions.isOwner) return 'Account owner — full workspace access'

  const enabled = (Object.keys(PERMISSION_LABELS) as PermissionKey[])
    .filter(key => permissions.permissions[key])
    .map(key => PERMISSION_LABELS[key])

  const disabled = (Object.keys(PERMISSION_LABELS) as PermissionKey[])
    .filter(key => !permissions.permissions[key] && key !== 'support')
    .map(key => PERMISSION_LABELS[key])

  const enabledLine = enabled.length ? `Can access: ${enabled.join(', ')}.` : 'Minimal module access.'
  const disabledLine = disabled.length ? ` Cannot access: ${disabled.join(', ')}.` : ''
  return `${enabledLine}${disabledLine}`
}

function formatOwnerRestrictions(): string {
  return [
    'TEAM PERMISSIONS (account owner):',
    '- You can invite/remove team members, connect integrations (Google Analytics, social publishing), and manage billing.',
    '- When asked what the team is working on, cite open assignments and recent team activity below.',
    '- Pending agent approvals in the shared queue need your sign-off before publish.',
  ].join('\n')
}

function formatMemberRestrictions(permissions: TeamPermissions): string {
  const lines = [
    'TEAM PERMISSIONS (team member — not the account owner):',
    formatPermissionSummary(permissions),
    '- Never offer to connect Google Analytics, Meta Ads, Zernio/social publishing, or Stripe billing — owner only.',
    '- Never offer to invite/remove team members or change seat billing.',
    '- You share the owner\'s Foundation, campaigns, agents, and approval queue data — speak as part of their team.',
  ]

  if (!permissions.permissions.billing) {
    lines.push('- If asked about plan, invoices, or credits billing: direct them to the account owner or Billing (owner-only).')
  }
  if (!permissions.permissions.analytics) {
    lines.push('- If asked to connect analytics: explain only the owner can connect integrations.')
  }

  return lines.join('\n')
}

function formatActivityLine(item: WorkspaceActivityItem): string {
  const when = new Date(item.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return `${when}: ${item.summary}`
}

export async function loadWorkspaceTeamContext(
  supabase: SupabaseClient,
  memberId: string,
  workspaceId: string,
): Promise<WorkspaceTeamContext | null> {
  const [{ data: memberProfile }, { data: ownerProfile }, permissions] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, is_account_owner').eq('id', memberId).maybeSingle(),
    workspaceId !== memberId
      ? supabase.from('profiles').select('company_name').eq('id', workspaceId).maybeSingle()
      : Promise.resolve({ data: null }),
    getTeamPermissions(memberId),
  ])

  if (!memberProfile) return null

  const isOwner = permissions.isOwner || memberId === workspaceId

  const [assignedToMember, openAssignments, pendingApprovalCount, activityResult] =
    await Promise.all([
      isOwner ? Promise.resolve([]) : listTasksAssignedToMember(supabase, memberId, workspaceId),
      isOwner ? listOpenWorkspaceAssignments(supabase, workspaceId) : Promise.resolve([]),
      getPendingApprovalCount(supabase, workspaceId),
      listWorkspaceActivity(supabase, workspaceId, {
        limit: 8,
        sinceDays: 7,
        teamOnly: true,
      }),
    ])

  return {
    memberId,
    workspaceId,
    memberName: formatProfileDisplayName(memberProfile),
    isOwner,
    ownerCompanyName: ownerProfile?.company_name ?? null,
    permissions,
    assignedToMember,
    openAssignments,
    pendingApprovalCount,
    recentActivity: activityResult.items.slice(0, 6),
  }
}

/** System-prompt block for Maya chat — workspace team brain (Phase 4). */
export function formatWorkspaceTeamContextForMaya(ctx: WorkspaceTeamContext): string {
  const company = ctx.ownerCompanyName ?? 'this workspace'
  const sections: string[] = [
    ctx.isOwner
      ? formatOwnerRestrictions()
      : formatMemberRestrictions(ctx.permissions),
    `\nSigned-in user: ${ctx.memberName}${ctx.isOwner ? ' (account owner)' : ' (team member)'}.`,
    `Workspace company: ${company}.`,
  ]

  if (ctx.pendingApprovalCount > 0) {
    sections.push(
      ctx.isOwner
        ? `Pending approvals in shared queue: ${ctx.pendingApprovalCount} — route owner to Agents → Approvals.`
        : `Shared approval queue has ${ctx.pendingApprovalCount} item(s) awaiting owner review.`,
    )
  }

  if (ctx.isOwner) {
    if (ctx.openAssignments.length > 0) {
      sections.push(
        `Open team assignments (${ctx.openAssignments.length}):\n${ctx.openAssignments
          .slice(0, 5)
          .map(row => `- ${formatAssignmentLine(row, 'owner')}`)
          .join('\n')}`,
      )
    } else {
      sections.push('Open team assignments: none right now.')
    }
  } else if (ctx.assignedToMember.length > 0) {
    sections.push(
      `Assigned to this member (${ctx.assignedToMember.length}):\n${ctx.assignedToMember
        .slice(0, 5)
        .map(row => `- ${formatAssignmentLine(row, 'member')}`)
        .join('\n')}`,
    )
  } else {
    sections.push('Assigned to this member: none right now.')
  }

  if (ctx.recentActivity.length > 0) {
    sections.push(
      `Recent workspace activity:\n${ctx.recentActivity.map(item => `- ${formatActivityLine(item)}`).join('\n')}`,
    )
  }

  sections.push(
    ctx.isOwner
      ? 'Owner team prompts: answer "What\'s my team working on?" using assignments + activity above.'
      : 'Member team prompts: answer "What\'s assigned to me?" using assignments above; do not claim owner-only actions.',
  )

  return sections.join('\n')
}

/** Lighter advisory for agent system prompts when a team member runs an agent. */
export function formatWorkspaceTeamContextForAgents(ctx: WorkspaceTeamContext): string | null {
  if (ctx.isOwner) return null

  const assignmentNote =
    ctx.assignedToMember.length > 0
      ? ` Active assignment: ${formatAssignmentLine(ctx.assignedToMember[0], 'member')}.`
      : ''

  return `## Team workspace context
The current user is a team member (${ctx.memberName}), not the account owner. Output is for the shared ${ctx.ownerCompanyName ?? 'workspace'} account.${assignmentNote}
${formatPermissionSummary(ctx.permissions)}`
}
