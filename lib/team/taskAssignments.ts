import type { SupabaseClient } from '@supabase/supabase-js'
import { createTask } from '@/lib/agents/runner'
import type { AgentId } from '@/lib/agents/registry'
import { agentDisplayName } from '@/lib/agents/digestPreview'
import { formatProfileDisplayName } from '@/lib/profiles/resolveActorName'
import { logActivity } from '@/lib/activity'
import { notifyAssignmentCreated } from '@/lib/team/notifyAssignment'

export type AssignedTaskRow = {
  id: string
  agent: string
  status: string
  input: Record<string, unknown>
  assignment_note: string | null
  assignment_due_at: string | null
  assigned_to_profile_id: string | null
  assigned_by_profile_id: string | null
  created_at: string
  assignerName?: string
  assigneeName?: string
}

export async function assertActiveTeamMember(
  supabase: SupabaseClient,
  workspaceId: string,
  memberProfileId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data } = await supabase
    .from('team_members')
    .select('id')
    .eq('account_id', workspaceId)
    .eq('member_profile_id', memberProfileId)
    .eq('status', 'active')
    .maybeSingle()

  if (!data) return { ok: false, error: 'Assignee is not an active team member' }
  return { ok: true }
}

export async function createAssignedAgentTask(opts: {
  supabase: SupabaseClient
  workspaceId: string
  assignerProfileId: string
  assigneeProfileId: string
  agent: AgentId
  assignmentNote: string
  assignmentDueAt?: string | null
  input?: Record<string, unknown>
}) {
  const memberCheck = await assertActiveTeamMember(
    opts.supabase,
    opts.workspaceId,
    opts.assigneeProfileId,
  )
  if (!memberCheck.ok) throw new Error(memberCheck.error)

  const task = await createTask({
    userId: opts.workspaceId,
    actorProfileId: opts.assignerProfileId,
    agent: opts.agent,
    input: {
      assignment_handoff: opts.assignmentNote.trim(),
      ...(opts.input ?? {}),
    },
    triggerType: 'assignment',
    assignedToProfileId: opts.assigneeProfileId,
    assignedByProfileId: opts.assignerProfileId,
    assignmentNote: opts.assignmentNote.trim(),
    assignmentDueAt: opts.assignmentDueAt ? new Date(opts.assignmentDueAt) : undefined,
  })

  await notifyAssignmentCreated({
    workspaceId: opts.workspaceId,
    assignerProfileId: opts.assignerProfileId,
    assigneeProfileId: opts.assigneeProfileId,
    taskId: task.id,
    agentId: opts.agent,
    assignmentNote: opts.assignmentNote.trim(),
  }).catch(err => console.error('[taskAssignments] notify failed:', err))

  logActivity(opts.assignerProfileId, 'assignment_created', {
    taskId: task.id,
    agent: opts.agent,
    assigneeProfileId: opts.assigneeProfileId,
  }, opts.workspaceId).catch(() => {})

  return task
}

export async function listTasksAssignedToMember(
  supabase: SupabaseClient,
  memberProfileId: string,
  workspaceId: string,
): Promise<AssignedTaskRow[]> {
  const { data, error } = await supabase
    .from('agent_tasks')
    .select('id, agent, status, input, assignment_note, assignment_due_at, assigned_to_profile_id, assigned_by_profile_id, created_at')
    .eq('user_id', workspaceId)
    .eq('assigned_to_profile_id', memberProfileId)
    .eq('status', 'pending')
    .eq('trigger_type', 'assignment')
    .is('started_at', null)
    .order('assignment_due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  const rows = (data ?? []) as AssignedTaskRow[]
  if (rows.length === 0) return rows

  const assignerIds = [...new Set(rows.map(r => r.assigned_by_profile_id).filter(Boolean))] as string[]
  const { data: profiles } = assignerIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', assignerIds)
    : { data: [] }

  const nameMap = new Map((profiles ?? []).map(p => [p.id, formatProfileDisplayName(p)]))

  return rows.map(row => ({
    ...row,
    input: (row.input ?? {}) as Record<string, unknown>,
    assignerName: row.assigned_by_profile_id
      ? nameMap.get(row.assigned_by_profile_id) ?? 'Account owner'
      : 'Account owner',
  }))
}

export async function listOpenWorkspaceAssignments(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<AssignedTaskRow[]> {
  const { data, error } = await supabase
    .from('agent_tasks')
    .select('id, agent, status, input, assignment_note, assignment_due_at, assigned_to_profile_id, assigned_by_profile_id, created_at')
    .eq('user_id', workspaceId)
    .not('assigned_to_profile_id', 'is', null)
    .eq('status', 'pending')
    .eq('trigger_type', 'assignment')
    .is('started_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error
  const rows = (data ?? []) as AssignedTaskRow[]
  const profileIds = [
    ...new Set(
      rows.flatMap(r => [r.assigned_to_profile_id, r.assigned_by_profile_id]).filter(Boolean),
    ),
  ] as string[]

  const { data: profiles } = profileIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', profileIds)
    : { data: [] }

  const nameMap = new Map((profiles ?? []).map(p => [p.id, formatProfileDisplayName(p)]))

  return rows.map(row => ({
    ...row,
    input: (row.input ?? {}) as Record<string, unknown>,
    assigneeName: row.assigned_to_profile_id
      ? nameMap.get(row.assigned_to_profile_id) ?? 'Team member'
      : undefined,
    assignerName: row.assigned_by_profile_id
      ? nameMap.get(row.assigned_by_profile_id) ?? 'Account owner'
      : undefined,
  }))
}

export function assignmentAgentLabel(agentId: string): string {
  return agentDisplayName(agentId)
}

export async function maybeNotifyAssignmentSubmitted(opts: {
  supabase: SupabaseClient
  taskId: string
  workspaceId: string
  outputTitle?: string | null
}) {
  const { data: task } = await opts.supabase
    .from('agent_tasks')
    .select('agent, assigned_to_profile_id, trigger_type')
    .eq('id', opts.taskId)
    .eq('user_id', opts.workspaceId)
    .maybeSingle()

  if (!task?.assigned_to_profile_id || task.trigger_type !== 'assignment') return

  const { notifyAssignmentSubmitted } = await import('@/lib/team/notifyAssignment')
  await notifyAssignmentSubmitted({
    workspaceId: opts.workspaceId,
    assigneeProfileId: task.assigned_to_profile_id as string,
    taskId: opts.taskId,
    agentId: task.agent as string,
    title: opts.outputTitle,
  })

  const { logActivity } = await import('@/lib/activity')
  await logActivity(
    task.assigned_to_profile_id as string,
    'assignment_submitted',
    { taskId: opts.taskId, agent: task.agent },
    opts.workspaceId,
  ).catch(() => {})
}
