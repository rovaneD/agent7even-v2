import type { SupabaseClient } from '@supabase/supabase-js'
import { agentDisplayName } from '@/lib/agents/digestPreview'

export type WorkspaceActivityActorRole = 'owner' | 'member'

export type WorkspaceActivityItem = {
  id: string
  eventType: string
  title: string
  summary: string
  detail: string | null
  actorName: string
  actorProfileId: string | null
  actorRole: WorkspaceActivityActorRole
  createdAt: string
  link: string | null
}

const EVENT_LABELS: Record<string, string> = {
  agent_run: 'Agent run',
  agent_approved: 'Approval',
  agent_bulk_approved: 'Bulk approval',
  agent_bulk_rejected: 'Bulk rejection',
  maya_message: 'Maya chat',
  foundation_updated: 'Foundation update',
  assignment_created: 'Assignment',
  assignment_submitted: 'Assignment submitted',
  team_member_joined: 'Team member joined',
  task_note: 'Assignment note',
  approval_note: 'Approval note',
}

/** Low-signal owner actions — hidden from default Team tab. */
const OWNER_NOISE_EVENTS = new Set(['maya_message', 'page_view'])

function actorDisplayName(profile: { full_name?: string | null; email?: string | null } | null): string {
  if (!profile) return 'Team member'
  return profile.full_name?.trim() || profile.email?.trim() || 'Team member'
}

function parseJoinerNameFromBody(body: string | null | undefined): string | null {
  if (!body?.trim()) return null
  const match = body.match(/^(.+?)\s+accepted your team invitation/i)
  return match?.[1]?.trim() ?? null
}

function formatActivityDetail(
  eventType: string,
  metadata: Record<string, unknown> | null,
  taskAgentMap: Map<string, string>,
): string | null {
  if (!metadata) return null

  if (eventType === 'agent_run' && typeof metadata.agent === 'string') {
    return agentDisplayName(metadata.agent)
  }

  if (eventType === 'agent_approved') {
    const taskId = typeof metadata.taskId === 'string' ? metadata.taskId : null
    const agentId = typeof metadata.agent === 'string'
      ? metadata.agent
      : taskId
        ? taskAgentMap.get(taskId)
        : null
    if (agentId) return agentDisplayName(agentId)
    if (metadata.publishScheduled === true) return 'Scheduled for publish after approval'
    return null
  }

  if (eventType === 'agent_bulk_approved' && typeof metadata.count === 'number') {
    return `${metadata.count} item${metadata.count === 1 ? '' : 's'} approved`
  }
  if (eventType === 'agent_bulk_rejected' && typeof metadata.count === 'number') {
    return `${metadata.count} item${metadata.count === 1 ? '' : 's'} rejected`
  }
  if (eventType === 'assignment_created' && typeof metadata.agent === 'string') {
    return agentDisplayName(metadata.agent)
  }
  if (eventType === 'assignment_submitted' && typeof metadata.agent === 'string') {
    return agentDisplayName(metadata.agent)
  }
  if (eventType === 'foundation_updated' && typeof metadata.score === 'number') {
    return `Foundation score ${metadata.score}`
  }
  if (eventType === 'assignment_created' && typeof metadata.assigneeProfileId === 'string') {
    return 'Waiting for assignee to start'
  }

  return null
}

function buildActivitySummary(
  eventType: string,
  actorName: string,
  actorRole: WorkspaceActivityActorRole,
  metadata: Record<string, unknown> | null,
  taskAgentMap: Map<string, string>,
  joinBody?: string | null,
): string {
  const roleLabel = actorRole === 'owner' ? 'Account owner' : actorName

  switch (eventType) {
    case 'agent_run': {
      const agent = typeof metadata?.agent === 'string'
        ? agentDisplayName(metadata.agent)
        : 'an agent'
      return actorRole === 'owner'
        ? `You ran ${agent}`
        : `${actorName} ran ${agent}`
    }
    case 'agent_approved': {
      const taskId = typeof metadata?.taskId === 'string' ? metadata.taskId : null
      const agentId = typeof metadata?.agent === 'string'
        ? metadata.agent
        : taskId
          ? taskAgentMap.get(taskId)
          : null
      const target = agentId ? agentDisplayName(agentId) : 'agent output'
      const publish = metadata?.publishScheduled === true ? ' and scheduled publish' : ''
      return actorRole === 'owner'
        ? `You approved ${target}${publish}`
        : `${actorName} approved ${target}${publish}`
    }
    case 'agent_bulk_approved': {
      const count = typeof metadata?.count === 'number' ? metadata.count : 0
      return actorRole === 'owner'
        ? `You bulk-approved ${count} item${count === 1 ? '' : 's'}`
        : `${actorName} bulk-approved ${count} item${count === 1 ? '' : 's'}`
    }
    case 'agent_bulk_rejected': {
      const count = typeof metadata?.count === 'number' ? metadata.count : 0
      return actorRole === 'owner'
        ? `You bulk-rejected ${count} item${count === 1 ? '' : 's'}`
        : `${actorName} bulk-rejected ${count} item${count === 1 ? '' : 's'}`
    }
    case 'maya_message':
      return actorRole === 'owner'
        ? 'You chatted with Maya'
        : `${actorName} chatted with Maya`
    case 'foundation_updated':
      return actorRole === 'owner'
        ? 'You updated Foundation'
        : `${actorName} updated Foundation`
    case 'assignment_created': {
      const agent = typeof metadata?.agent === 'string'
        ? agentDisplayName(metadata.agent)
        : 'agent work'
      return actorRole === 'owner'
        ? `You assigned ${agent} to a team member`
        : `${roleLabel} assigned ${agent}`
    }
    case 'assignment_submitted': {
      const agent = typeof metadata?.agent === 'string'
        ? agentDisplayName(metadata.agent)
        : 'assigned work'
      return `${actorName} submitted ${agent} for your review`
    }
    case 'team_member_joined': {
      const joiner = parseJoinerNameFromBody(joinBody) ?? actorName
      return `${joiner} joined the workspace`
    }
    case 'task_note': {
      const agent = typeof metadata?.agent === 'string'
        ? agentDisplayName(metadata.agent)
        : 'an assignment'
      return actorRole === 'owner'
        ? `You commented on ${agent}`
        : `${actorName} commented on ${agent}`
    }
    case 'approval_note': {
      const agent = typeof metadata?.agent === 'string'
        ? agentDisplayName(metadata.agent)
        : 'an approval'
      const kind = metadata?.noteKind
      if (kind === 'approved') {
        return actorRole === 'owner'
          ? `You approved ${agent} with a note`
          : `${actorName} approved ${agent} with a note`
      }
      if (kind === 'rejected') {
        return actorRole === 'owner'
          ? `You rejected ${agent} with feedback`
          : `${actorName} rejected ${agent} with feedback`
      }
      return actorRole === 'owner'
        ? `You commented on ${agent} approval`
        : `${actorName} commented on ${agent} approval`
    }
    default:
      return EVENT_LABELS[eventType] ?? eventType.replace(/_/g, ' ')
  }
}

function activityLink(eventType: string, metadata: Record<string, unknown> | null): string | null {
  if (metadata && typeof metadata.taskId === 'string') {
    if (eventType === 'agent_run' || eventType === 'assignment_submitted') {
      return `/dashboard/agents/approvals?task=${metadata.taskId}`
    }
    if (eventType === 'agent_approved') {
      return `/dashboard/agents/approvals?task=${metadata.taskId}`
    }
  }
  if (eventType === 'agent_run') return '/dashboard/agents'
  if (eventType === 'agent_approved' || eventType === 'agent_bulk_approved') {
    return '/dashboard/agents/approvals'
  }
  if (eventType === 'assignment_created') return '/dashboard/team'
  if (eventType === 'assignment_submitted') return '/dashboard/agents/approvals'
  if (eventType === 'team_member_joined') return '/dashboard/team'
  if (eventType === 'maya_message') return '/maya'
  if (eventType === 'foundation_updated') return '/foundation'
  if (eventType === 'task_note' && typeof metadata?.taskId === 'string') {
    return `/dashboard/team/tasks/${metadata.taskId}`
  }
  if (eventType === 'approval_note' && typeof metadata?.taskId === 'string') {
    return `/dashboard/agents/approvals?task=${metadata.taskId}`
  }
  return null
}

async function loadTeamMemberProfileIds(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('team_members')
    .select('member_profile_id')
    .eq('account_id', workspaceId)
    .eq('status', 'active')

  return new Set(
    (data ?? [])
      .map(row => row.member_profile_id as string | null)
      .filter(Boolean) as string[],
  )
}

function truncateNotePreview(body: string, max = 120): string {
  const trimmed = body.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

type NoteActivityRow = {
  id: string
  task_id: string
  author_profile_id: string
  body: string
  note_kind: string | null
  created_at: string
  agent: string | null
}

async function loadWorkspaceNoteActivityItems(
  supabase: SupabaseClient,
  workspaceId: string,
  sinceIso: string,
  teamMemberIds: Set<string>,
  profileMap: Map<string, { full_name: string | null; email: string | null }>,
  limit: number,
): Promise<WorkspaceActivityItem[]> {
  const [assignmentNotes, approvalNotes] = await Promise.all([
    supabase
      .from('team_task_notes')
      .select('id, task_id, author_profile_id, body, created_at, agent_tasks!inner(agent)')
      .eq('workspace_id', workspaceId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('approval_task_notes')
      .select('id, task_id, author_profile_id, body, note_kind, created_at, agent_tasks!inner(agent)')
      .eq('workspace_id', workspaceId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  const authorIds = new Set<string>()
  for (const row of [...(assignmentNotes.data ?? []), ...(approvalNotes.data ?? [])]) {
    if (row.author_profile_id) authorIds.add(row.author_profile_id as string)
  }
  const missingAuthorIds = [...authorIds].filter(id => !profileMap.has(id))
  if (missingAuthorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', missingAuthorIds)
    for (const p of profiles ?? []) {
      profileMap.set(p.id, { full_name: p.full_name, email: p.email })
    }
  }

  function resolveActorRole(actorProfileId: string | null): WorkspaceActivityActorRole {
    if (!actorProfileId || actorProfileId === workspaceId) return 'owner'
    return teamMemberIds.has(actorProfileId) ? 'member' : 'owner'
  }

  function mapNoteRow(
    row: NoteActivityRow,
    eventType: 'task_note' | 'approval_note',
    idPrefix: string,
  ): WorkspaceActivityItem {
    const actorProfileId = row.author_profile_id
    const actorRole = resolveActorRole(actorProfileId)
    const actorName = actorDisplayName(profileMap.get(actorProfileId) ?? null)
    const agent = row.agent ?? undefined
    const metadata: Record<string, unknown> = {
      taskId: row.task_id,
      agent,
      noteKind: row.note_kind,
    }
    const taskAgentMap = new Map<string, string>()

    return {
      id: `${idPrefix}-${row.id}`,
      eventType,
      title: EVENT_LABELS[eventType] ?? eventType,
      summary: buildActivitySummary(eventType, actorName, actorRole, metadata, taskAgentMap),
      detail: truncateNotePreview(row.body),
      actorName,
      actorProfileId,
      actorRole,
      createdAt: row.created_at,
      link: activityLink(eventType, metadata),
    }
  }

  const items: WorkspaceActivityItem[] = []

  for (const row of assignmentNotes.data ?? []) {
    const taskJoin = row.agent_tasks as { agent?: string } | { agent?: string }[] | null
    const agent = Array.isArray(taskJoin) ? taskJoin[0]?.agent : taskJoin?.agent
    items.push(mapNoteRow(
      {
        id: row.id as string,
        task_id: row.task_id as string,
        author_profile_id: row.author_profile_id as string,
        body: row.body as string,
        note_kind: null,
        created_at: row.created_at as string,
        agent: (agent as string | null) ?? null,
      },
      'task_note',
      'task-note',
    ))
  }

  for (const row of approvalNotes.data ?? []) {
    const taskJoin = row.agent_tasks as { agent?: string } | { agent?: string }[] | null
    const agent = Array.isArray(taskJoin) ? taskJoin[0]?.agent : taskJoin?.agent
    items.push(mapNoteRow(
      {
        id: row.id as string,
        task_id: row.task_id as string,
        author_profile_id: row.author_profile_id as string,
        body: row.body as string,
        note_kind: (row.note_kind as string | null) ?? null,
        created_at: row.created_at as string,
        agent: (agent as string | null) ?? null,
      },
      'approval_note',
      'approval-note',
    ))
  }

  return items
}

export type WorkspaceActivityResult = {
  items: WorkspaceActivityItem[]
  teamActionCount: number
  ownerActionCount: number
}

/** Owner Team Activity feed — last 7 days by default. */
export async function listWorkspaceActivity(
  supabase: SupabaseClient,
  workspaceId: string,
  opts?: { limit?: number; sinceDays?: number; teamOnly?: boolean },
): Promise<WorkspaceActivityResult> {
  const limit = opts?.limit ?? 40
  const sinceDays = opts?.sinceDays ?? 7
  const teamOnly = opts?.teamOnly ?? false
  const since = new Date()
  since.setDate(since.getDate() - sinceDays)

  const teamMemberIds = await loadTeamMemberProfileIds(supabase, workspaceId)

  const { data: logRows, error: logErr } = await supabase
    .from('client_activity_log')
    .select('id, user_id, event_type, metadata, created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', since.toISOString())
    .neq('event_type', 'page_view')
    .order('created_at', { ascending: false })
    .limit(limit * 2)

  if (logErr) throw logErr

  const { data: joinNotifications } = await supabase
    .from('notifications')
    .select('id, title, body, type, created_at, sender_id')
    .eq('user_id', workspaceId)
    .eq('type', 'team_member_joined')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(10)

  const approvalTaskIds = (logRows ?? [])
    .filter(row => row.event_type === 'agent_approved')
    .map(row => (row.metadata as Record<string, unknown> | null)?.taskId)
    .filter((id): id is string => typeof id === 'string')

  const taskAgentMap = new Map<string, string>()
  if (approvalTaskIds.length > 0) {
    const { data: tasks } = await supabase
      .from('agent_tasks')
      .select('id, agent')
      .in('id', [...new Set(approvalTaskIds)])
    for (const task of tasks ?? []) {
      taskAgentMap.set(task.id as string, task.agent as string)
    }
  }

  const actorIds = new Set<string>()
  for (const row of logRows ?? []) {
    if (row.user_id) actorIds.add(row.user_id as string)
  }
  for (const row of joinNotifications ?? []) {
    if (row.sender_id) actorIds.add(row.sender_id as string)
  }

  const profileMap = new Map<string, { full_name: string | null; email: string | null }>()
  if (actorIds.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', [...actorIds])
    for (const p of profiles ?? []) {
      profileMap.set(p.id, { full_name: p.full_name, email: p.email })
    }
  }

  function resolveActorRole(actorProfileId: string | null): WorkspaceActivityActorRole {
    if (!actorProfileId || actorProfileId === workspaceId) return 'owner'
    return teamMemberIds.has(actorProfileId) ? 'member' : 'owner'
  }

  const fromLog: WorkspaceActivityItem[] = (logRows ?? [])
    .filter(row => !OWNER_NOISE_EVENTS.has(row.event_type as string))
    .map(row => {
      const metadata = (row.metadata ?? null) as Record<string, unknown> | null
      const eventType = row.event_type as string
      const actorProfileId = (row.user_id as string) ?? null
      const actorRole = resolveActorRole(actorProfileId)
      const actorName = actorDisplayName(profileMap.get(actorProfileId ?? '') ?? null)
      const detail = formatActivityDetail(eventType, metadata, taskAgentMap)

      return {
        id: `log-${row.id}`,
        eventType,
        title: EVENT_LABELS[eventType] ?? eventType.replace(/_/g, ' '),
        summary: buildActivitySummary(eventType, actorName, actorRole, metadata, taskAgentMap),
        detail,
        actorName,
        actorProfileId,
        actorRole,
        createdAt: row.created_at as string,
        link: activityLink(eventType, metadata),
      }
    })

  const fromJoins: WorkspaceActivityItem[] = (joinNotifications ?? []).map(row => {
    const joinerFromBody = parseJoinerNameFromBody(row.body as string)
    const actorProfileId = (row.sender_id as string) ?? null
    const actorName = joinerFromBody
      ?? actorDisplayName(actorProfileId ? profileMap.get(actorProfileId) ?? null : null)

    return {
      id: `notif-${row.id}`,
      eventType: 'team_member_joined',
      title: EVENT_LABELS.team_member_joined,
      summary: `${actorName} joined the workspace`,
      detail: row.body as string,
      actorName,
      actorProfileId,
      actorRole: 'member' as const,
      createdAt: row.created_at as string,
      link: '/dashboard/team',
    }
  })

  let noteItems: WorkspaceActivityItem[] = []
  try {
    noteItems = await loadWorkspaceNoteActivityItems(
      supabase,
      workspaceId,
      since.toISOString(),
      teamMemberIds,
      profileMap,
      limit,
    )
  } catch (err) {
    console.warn('[workspaceActivity] note feed skipped:', err)
  }

  const allItems = [...fromLog, ...fromJoins, ...noteItems]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const teamActionCount = allItems.filter(item => item.actorRole === 'member').length
  const ownerActionCount = allItems.filter(item => item.actorRole === 'owner').length

  const filtered = teamOnly
    ? allItems.filter(item => item.actorRole === 'member')
    : allItems

  return {
    items: filtered.slice(0, limit),
    teamActionCount,
    ownerActionCount,
  }
}
