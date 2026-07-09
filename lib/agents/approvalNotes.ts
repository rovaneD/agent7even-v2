import type { SupabaseClient } from '@supabase/supabase-js'
import { PENDING_APPROVAL_OUTPUT_STATUS } from '@/lib/agents/pendingApprovals'
import { formatProfileDisplayName } from '@/lib/profiles/resolveActorName'
import {
  assertWorkspaceTeamParticipant,
  parseMentionedProfileIds,
} from '@/lib/team/taskNotes'
import { listWorkspaceTeamMembers } from '@/lib/team/teamRoster'
import { notifyApprovalNote } from '@/lib/agents/notifyApprovalNote'

export type ApprovalNoteKind = 'comment' | 'approved' | 'rejected'

export type ApprovalNoteRow = {
  id: string
  task_id: string
  workspace_id: string
  author_profile_id: string
  body: string
  note_kind: ApprovalNoteKind
  created_at: string
  authorName?: string
}

export type ApprovalNoteSummary = {
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

async function listNoteRecipientProfileIds(
  supabase: SupabaseClient,
  workspaceId: string,
  actorProfileId: string | null,
): Promise<string[]> {
  const roster = await listWorkspaceTeamMembers(supabase, workspaceId)
  const ids = new Set<string>([workspaceId])
  if (actorProfileId) ids.add(actorProfileId)
  for (const member of roster) {
    if (member.profileId && member.status === 'active') ids.add(member.profileId)
  }
  return [...ids]
}

export async function assertPendingApprovalTask(
  supabase: SupabaseClient,
  workspaceId: string,
  taskId: string,
): Promise<{ id: string; agent: string; actor_profile_id: string | null } | null> {
  const { data: task, error } = await supabase
    .from('agent_tasks')
    .select('id, agent, actor_profile_id')
    .eq('id', taskId)
    .eq('user_id', workspaceId)
    .maybeSingle()

  if (error || !task) return null

  const { count } = await supabase
    .from('agent_outputs')
    .select('id', { count: 'exact', head: true })
    .eq('task_id', taskId)
    .eq('user_id', workspaceId)
    .eq('status', PENDING_APPROVAL_OUTPUT_STATUS)

  if (!count) return null

  return {
    id: task.id as string,
    agent: task.agent as string,
    actor_profile_id: (task.actor_profile_id as string | null) ?? null,
  }
}

export async function listApprovalNotes(
  supabase: SupabaseClient,
  taskId: string,
): Promise<ApprovalNoteRow[]> {
  const { data, error } = await supabase
    .from('approval_task_notes')
    .select('id, task_id, workspace_id, author_profile_id, body, note_kind, created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) throw error
  const rows = (data ?? []) as ApprovalNoteRow[]
  if (rows.length === 0) return rows

  const authorIds = [...new Set(rows.map(r => r.author_profile_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', authorIds)

  const nameMap = new Map((profiles ?? []).map(p => [p.id, formatProfileDisplayName(p)]))

  return rows.map(row => ({
    ...row,
    note_kind: row.note_kind as ApprovalNoteKind,
    authorName: nameMap.get(row.author_profile_id) ?? 'Team member',
  }))
}

export async function listApprovalNoteSummaries(
  supabase: SupabaseClient,
  taskIds: string[],
): Promise<Record<string, ApprovalNoteSummary>> {
  if (taskIds.length === 0) return {}

  const { data, error } = await supabase
    .from('approval_task_notes')
    .select('task_id, body, created_at')
    .in('task_id', taskIds)
    .order('created_at', { ascending: false })

  if (error) throw error

  const out: Record<string, ApprovalNoteSummary> = {}
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

async function insertApprovalNote(opts: {
  supabase: SupabaseClient
  workspaceId: string
  authorProfileId: string
  taskId: string
  agentId: string
  body: string
  noteKind: ApprovalNoteKind
  actorProfileId: string | null
  notify: boolean
}): Promise<ApprovalNoteRow> {
  const { data, error } = await opts.supabase
    .from('approval_task_notes')
    .insert({
      task_id: opts.taskId,
      workspace_id: opts.workspaceId,
      author_profile_id: opts.authorProfileId,
      body: opts.body,
      note_kind: opts.noteKind,
    })
    .select('id, task_id, workspace_id, author_profile_id, body, note_kind, created_at')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to save approval note')

  const { data: author } = await opts.supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', opts.authorProfileId)
    .maybeSingle()

  const authorName = formatProfileDisplayName(author)

  if (opts.notify) {
    if (opts.noteKind === 'comment') {
      const mentionCandidates = await buildMentionCandidates(opts.supabase, opts.workspaceId)
      const mentionedIds = parseMentionedProfileIds(opts.body, mentionCandidates)
      const recipients = (await listNoteRecipientProfileIds(
        opts.supabase,
        opts.workspaceId,
        opts.actorProfileId,
      )).filter(id => id !== opts.authorProfileId)

      await notifyApprovalNote({
        workspaceId: opts.workspaceId,
        taskId: opts.taskId,
        agentId: opts.agentId,
        authorProfileId: opts.authorProfileId,
        authorName,
        bodyPreview: opts.body,
        recipientProfileIds: recipients,
        mentionedProfileIds: mentionedIds,
        decisionKind: null,
      }).catch(err => console.error('[approvalNotes] notify failed:', err))
    } else if (
      opts.actorProfileId &&
      opts.actorProfileId !== opts.authorProfileId
    ) {
      await notifyApprovalNote({
        workspaceId: opts.workspaceId,
        taskId: opts.taskId,
        agentId: opts.agentId,
        authorProfileId: opts.authorProfileId,
        authorName,
        bodyPreview: opts.body,
        recipientProfileIds: [opts.actorProfileId],
        mentionedProfileIds: [],
        decisionKind: opts.noteKind,
      }).catch(err => console.error('[approvalNotes] notify failed:', err))
    }
  }

  return {
    ...(data as ApprovalNoteRow),
    note_kind: data.note_kind as ApprovalNoteKind,
    authorName,
  }
}

export async function createApprovalComment(opts: {
  supabase: SupabaseClient
  workspaceId: string
  authorProfileId: string
  taskId: string
  body: string
}): Promise<ApprovalNoteRow> {
  const trimmed = opts.body.trim()
  if (!trimmed) throw new Error('Note cannot be empty')

  const participant = await assertWorkspaceTeamParticipant(
    opts.supabase,
    opts.workspaceId,
    opts.authorProfileId,
  )
  if (!participant.ok) throw new Error(participant.error)

  const task = await assertPendingApprovalTask(opts.supabase, opts.workspaceId, opts.taskId)
  if (!task) throw new Error('Approval item not found')

  return insertApprovalNote({
    supabase: opts.supabase,
    workspaceId: opts.workspaceId,
    authorProfileId: opts.authorProfileId,
    taskId: opts.taskId,
    agentId: task.agent,
    body: trimmed,
    noteKind: 'comment',
    actorProfileId: task.actor_profile_id,
    notify: true,
  })
}

export async function recordApprovalDecisionNote(opts: {
  supabase: SupabaseClient
  workspaceId: string
  authorProfileId: string
  taskId: string
  agentId: string
  noteKind: 'approved' | 'rejected'
  body: string | null
  actorProfileId: string | null
}): Promise<void> {
  const trimmed = opts.body?.trim()
  if (!trimmed) return

  await insertApprovalNote({
    supabase: opts.supabase,
    workspaceId: opts.workspaceId,
    authorProfileId: opts.authorProfileId,
    taskId: opts.taskId,
    agentId: opts.agentId,
    body: trimmed,
    noteKind: opts.noteKind,
    actorProfileId: opts.actorProfileId,
    notify: true,
  }).catch(err => console.error('[approvalNotes] decision note failed:', err))
}