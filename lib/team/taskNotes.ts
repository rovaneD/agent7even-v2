import type { SupabaseClient } from '@supabase/supabase-js'
import { agentDisplayName } from '@/lib/agents/digestPreview'
import { formatProfileDisplayName } from '@/lib/profiles/resolveActorName'
import { listWorkspaceTeamMembers } from '@/lib/team/teamRoster'
import { notifyTaskNote } from '@/lib/team/notifyTaskNote'

export type TaskNoteRow = {
  id: string
  task_id: string
  workspace_id: string
  author_profile_id: string
  body: string
  created_at: string
  authorName?: string
}

export type AssignmentTaskRow = {
  id: string
  agent: string
  status: string
  assignment_note: string | null
  assignment_due_at: string | null
  assigned_to_profile_id: string | null
  assigned_by_profile_id: string | null
  created_at: string
  assigneeName?: string
  assignerName?: string
}

export type TaskNoteSummary = {
  count: number
  lastBody: string | null
  lastAt: string | null
}

type MentionCandidate = {
  profileId: string
  tokens: string[]
}

function mentionTokens(name: string, email: string): string[] {
  const tokens = new Set<string>()
  const normalizedName = name.trim().toLowerCase()
  const normalizedEmail = email.trim().toLowerCase()
  if (normalizedName) {
    tokens.add(normalizedName.replace(/\s+/g, ''))
    for (const part of normalizedName.split(/\s+/)) {
      if (part.length >= 2) tokens.add(part)
    }
  }
  if (normalizedEmail) {
    tokens.add(normalizedEmail)
    const local = normalizedEmail.split('@')[0]
    if (local.length >= 2) tokens.add(local)
  }
  return [...tokens]
}

export function parseMentionedProfileIds(
  body: string,
  candidates: MentionCandidate[],
): string[] {
  const matches = body.match(/@([A-Za-z0-9._-]+)/g) ?? []
  if (matches.length === 0) return []

  const mentioned = new Set<string>()
  for (const raw of matches) {
    const token = raw.slice(1).toLowerCase()
    for (const candidate of candidates) {
      if (candidate.tokens.some(t => t === token || t.startsWith(token) || token.startsWith(t))) {
        mentioned.add(candidate.profileId)
      }
    }
  }
  return [...mentioned]
}

export async function assertWorkspaceTeamParticipant(
  supabase: SupabaseClient,
  workspaceId: string,
  memberProfileId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (memberProfileId === workspaceId) return { ok: true }

  const { data } = await supabase
    .from('team_members')
    .select('id')
    .eq('account_id', workspaceId)
    .eq('member_profile_id', memberProfileId)
    .eq('status', 'active')
    .maybeSingle()

  if (!data) return { ok: false, error: 'Not a member of this workspace' }
  return { ok: true }
}

export async function loadAssignmentTask(
  supabase: SupabaseClient,
  workspaceId: string,
  taskId: string,
): Promise<AssignmentTaskRow | null> {
  const { data, error } = await supabase
    .from('agent_tasks')
    .select('id, agent, status, assignment_note, assignment_due_at, assigned_to_profile_id, assigned_by_profile_id, created_at, trigger_type')
    .eq('id', taskId)
    .eq('user_id', workspaceId)
    .maybeSingle()

  if (error || !data) return null
  if (!data.assigned_to_profile_id || data.trigger_type !== 'assignment') return null

  const profileIds = [
    data.assigned_to_profile_id,
    data.assigned_by_profile_id,
  ].filter(Boolean) as string[]

  const { data: profiles } = profileIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', profileIds)
    : { data: [] }

  const nameMap = new Map((profiles ?? []).map(p => [p.id, formatProfileDisplayName(p)]))

  return {
    id: data.id as string,
    agent: data.agent as string,
    status: data.status as string,
    assignment_note: data.assignment_note as string | null,
    assignment_due_at: data.assignment_due_at as string | null,
    assigned_to_profile_id: data.assigned_to_profile_id as string | null,
    assigned_by_profile_id: data.assigned_by_profile_id as string | null,
    created_at: data.created_at as string,
    assigneeName: data.assigned_to_profile_id
      ? nameMap.get(data.assigned_to_profile_id) ?? 'Team member'
      : undefined,
    assignerName: data.assigned_by_profile_id
      ? nameMap.get(data.assigned_by_profile_id) ?? 'Account owner'
      : 'Account owner',
  }
}

async function buildMentionCandidates(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<MentionCandidate[]> {
  const roster = await listWorkspaceTeamMembers(supabase, workspaceId)
  const { data: owner } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', workspaceId)
    .maybeSingle()

  const candidates: MentionCandidate[] = []
  if (owner) {
    candidates.push({
      profileId: owner.id as string,
      tokens: mentionTokens(formatProfileDisplayName(owner), owner.email ?? ''),
    })
  }

  for (const member of roster) {
    if (!member.profileId || member.status !== 'active') continue
    candidates.push({
      profileId: member.profileId,
      tokens: mentionTokens(member.name, member.email),
    })
  }

  return candidates
}

export async function listTaskNotes(
  supabase: SupabaseClient,
  taskId: string,
): Promise<TaskNoteRow[]> {
  const { data, error } = await supabase
    .from('team_task_notes')
    .select('id, task_id, workspace_id, author_profile_id, body, created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) throw error
  const rows = (data ?? []) as TaskNoteRow[]
  if (rows.length === 0) return rows

  const authorIds = [...new Set(rows.map(r => r.author_profile_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', authorIds)

  const nameMap = new Map((profiles ?? []).map(p => [p.id, formatProfileDisplayName(p)]))

  return rows.map(row => ({
    ...row,
    authorName: nameMap.get(row.author_profile_id) ?? 'Team member',
  }))
}

export async function listTaskNoteSummaries(
  supabase: SupabaseClient,
  taskIds: string[],
): Promise<Record<string, TaskNoteSummary>> {
  if (taskIds.length === 0) return {}

  const { data, error } = await supabase
    .from('team_task_notes')
    .select('task_id, body, created_at')
    .in('task_id', taskIds)
    .order('created_at', { ascending: false })

  if (error) throw error

  const out: Record<string, TaskNoteSummary> = {}
  for (const row of data ?? []) {
    const taskId = row.task_id as string
    if (!out[taskId]) {
      out[taskId] = {
        count: 1,
        lastBody: row.body as string,
        lastAt: row.created_at as string,
      }
    } else {
      out[taskId].count += 1
    }
  }
  return out
}

async function listNoteRecipientProfileIds(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<string[]> {
  const roster = await listWorkspaceTeamMembers(supabase, workspaceId)
  const ids = new Set<string>([workspaceId])
  for (const member of roster) {
    if (member.profileId && member.status === 'active') ids.add(member.profileId)
  }
  return [...ids]
}

export async function createTaskNote(opts: {
  supabase: SupabaseClient
  workspaceId: string
  authorProfileId: string
  taskId: string
  body: string
}): Promise<TaskNoteRow> {
  const trimmed = opts.body.trim()
  if (!trimmed) throw new Error('Note cannot be empty')

  const participant = await assertWorkspaceTeamParticipant(
    opts.supabase,
    opts.workspaceId,
    opts.authorProfileId,
  )
  if (!participant.ok) throw new Error(participant.error)

  const task = await loadAssignmentTask(opts.supabase, opts.workspaceId, opts.taskId)
  if (!task) throw new Error('Assignment not found')

  const { data, error } = await opts.supabase
    .from('team_task_notes')
    .insert({
      task_id: opts.taskId,
      workspace_id: opts.workspaceId,
      author_profile_id: opts.authorProfileId,
      body: trimmed,
    })
    .select('id, task_id, workspace_id, author_profile_id, body, created_at')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to save note')

  const { data: author } = await opts.supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', opts.authorProfileId)
    .maybeSingle()

  const authorName = formatProfileDisplayName(author)
  const mentionCandidates = await buildMentionCandidates(opts.supabase, opts.workspaceId)
  const mentionedIds = parseMentionedProfileIds(trimmed, mentionCandidates)
  const recipients = (await listNoteRecipientProfileIds(opts.supabase, opts.workspaceId))
    .filter(id => id !== opts.authorProfileId)

  await notifyTaskNote({
    workspaceId: opts.workspaceId,
    taskId: opts.taskId,
    agentId: task.agent,
    authorProfileId: opts.authorProfileId,
    authorName,
    bodyPreview: trimmed,
    recipientProfileIds: recipients,
    mentionedProfileIds: mentionedIds,
  }).catch(err => console.error('[taskNotes] notify failed:', err))

  return {
    ...(data as TaskNoteRow),
    authorName,
  }
}
