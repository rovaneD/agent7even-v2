import type { SupabaseClient } from '@supabase/supabase-js'
import { agentDisplayName } from '@/lib/agents/digestPreview'

export type WorkspaceActivityItem = {
  id: string
  eventType: string
  title: string
  detail: string | null
  actorName: string
  actorProfileId: string | null
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
  page_view: 'Page view',
  assignment_created: 'Assignment',
  assignment_submitted: 'Assignment submitted',
  team_member_joined: 'Team member joined',
}

function actorDisplayName(profile: { full_name?: string | null; email?: string | null } | null): string {
  if (!profile) return 'Someone'
  return profile.full_name?.trim() || profile.email?.trim() || 'Team member'
}

function formatActivityDetail(
  eventType: string,
  metadata: Record<string, unknown> | null,
): string | null {
  if (!metadata) return null
  if (eventType === 'agent_run' && typeof metadata.agent === 'string') {
    return agentDisplayName(metadata.agent)
  }
  if (eventType === 'agent_approved' && metadata.publishScheduled === true) {
    return 'Approved and scheduled for publish'
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
  return null
}

function activityLink(eventType: string, metadata: Record<string, unknown> | null): string | null {
  if (eventType === 'agent_run' || eventType === 'agent_approved') {
    return '/dashboard/agents/approvals'
  }
  if (eventType === 'assignment_created' || eventType === 'assignment_submitted') {
    return '/dashboard/team'
  }
  if (eventType === 'team_member_joined') {
    return '/dashboard/team'
  }
  if (eventType === 'maya_message') {
    return '/maya'
  }
  if (eventType === 'foundation_updated') {
    return '/foundation'
  }
  if (metadata && typeof metadata.taskId === 'string') {
    return `/dashboard/agents/approvals?task=${metadata.taskId}`
  }
  return null
}

/** Owner Team Activity feed — last 7 days by default. */
export async function listWorkspaceActivity(
  supabase: SupabaseClient,
  workspaceId: string,
  opts?: { limit?: number; sinceDays?: number },
): Promise<WorkspaceActivityItem[]> {
  const limit = opts?.limit ?? 40
  const sinceDays = opts?.sinceDays ?? 7
  const since = new Date()
  since.setDate(since.getDate() - sinceDays)

  const { data: logRows, error: logErr } = await supabase
    .from('client_activity_log')
    .select('id, user_id, event_type, metadata, created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', since.toISOString())
    .neq('event_type', 'page_view')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (logErr) throw logErr

  const { data: joinNotifications } = await supabase
    .from('notifications')
    .select('id, title, body, type, created_at, sender_id')
    .eq('user_id', workspaceId)
    .eq('type', 'team_member_joined')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(10)

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

  const fromLog: WorkspaceActivityItem[] = (logRows ?? []).map(row => {
    const metadata = (row.metadata ?? null) as Record<string, unknown> | null
    const eventType = row.event_type as string
    return {
      id: `log-${row.id}`,
      eventType,
      title: EVENT_LABELS[eventType] ?? eventType.replace(/_/g, ' '),
      detail: formatActivityDetail(eventType, metadata),
      actorName: actorDisplayName(profileMap.get(row.user_id as string) ?? null),
      actorProfileId: (row.user_id as string) ?? null,
      createdAt: row.created_at as string,
      link: activityLink(eventType, metadata),
    }
  })

  const fromJoins: WorkspaceActivityItem[] = (joinNotifications ?? []).map(row => ({
    id: `notif-${row.id}`,
    eventType: 'team_member_joined',
    title: EVENT_LABELS.team_member_joined,
    detail: row.body as string,
    actorName: actorDisplayName(row.sender_id ? profileMap.get(row.sender_id as string) ?? null : null),
    actorProfileId: (row.sender_id as string) ?? null,
    createdAt: row.created_at as string,
    link: '/dashboard/team',
  }))

  return [...fromLog, ...fromJoins]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}
