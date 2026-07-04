import { createServiceClient } from '@/lib/supabase/server'
import { resolveWorkspaceProfileId } from '@/lib/profiles/workspaceProfile'
import {
  summarizeApprovedOutput,
  summarizeEditedAndApprovedOutput,
  summarizeRejectedOutput,
  type FoundationChangelogSignalType,
} from '@/lib/foundation/changelogSummarize'

export type { FoundationChangelogSignalType }

export type LogFoundationSignalInput = {
  /** Profile id of the actor (resolved to workspace owner for storage). */
  actorProfileId: string
  signalType: FoundationChangelogSignalType
  agentId?: string | null
  sourceTaskId?: string | null
  contentSummary: string
  rawContext?: Record<string, unknown> | null
}

/** Fire-and-forget — never throws; never blocks callers. */
export function logFoundationSignal(input: LogFoundationSignalInput): void {
  void persistFoundationSignal(input).catch(err => {
    console.error('[foundation-changelog] persist failed:', err)
  })
}

async function persistFoundationSignal(input: LogFoundationSignalInput): Promise<void> {
  const supabase = createServiceClient()
  const profileId = await resolveWorkspaceProfileId(supabase, input.actorProfileId)

  const { error } = await supabase.from('foundation_changelog').insert({
    profile_id: profileId,
    signal_type: input.signalType,
    agent_id: input.agentId ?? null,
    source_task_id: input.sourceTaskId ?? null,
    content_summary: input.contentSummary,
    raw_context: input.rawContext ?? null,
  })

  if (error) {
    console.error('[foundation-changelog] insert error:', error.message)
  }
}

export function logApprovalChangelog(opts: {
  actorProfileId: string
  taskId: string
  agentId: string
  outputId: string
  title?: string | null
  contentBefore?: unknown
  contentAfter?: unknown
  editedContent?: string | null
}): void {
  const hadEdit = typeof opts.editedContent === 'string'
  const beforeContent = opts.contentBefore
  const afterContent = hadEdit
    ? { ...(typeof beforeContent === 'object' && beforeContent !== null ? beforeContent as object : {}), raw: opts.editedContent }
    : opts.contentAfter ?? beforeContent

  if (hadEdit && beforeContent != null) {
    const { summary, signalType } = summarizeEditedAndApprovedOutput({
      agentId: opts.agentId,
      beforeContent,
      afterContent,
      title: opts.title,
    })
    logFoundationSignal({
      actorProfileId: opts.actorProfileId,
      signalType,
      agentId: opts.agentId,
      sourceTaskId: opts.taskId,
      contentSummary: summary,
      rawContext: {
        outputId: opts.outputId,
        alsoApproved: true,
        rejectionReason: null,
      },
    })
    return
  }

  logFoundationSignal({
    actorProfileId: opts.actorProfileId,
    signalType: 'approved',
    agentId: opts.agentId,
    sourceTaskId: opts.taskId,
    contentSummary: summarizeApprovedOutput({
      agentId: opts.agentId,
      content: afterContent,
      title: opts.title,
    }),
    rawContext: { outputId: opts.outputId },
  })
}

export function logRejectionChangelog(opts: {
  actorProfileId: string
  taskId: string
  agentId: string
  outputId?: string | null
  title?: string | null
  content?: unknown
  rejectionReason?: string | null
  feedbackNote?: string | null
  rerun?: boolean
}): void {
  logFoundationSignal({
    actorProfileId: opts.actorProfileId,
    signalType: 'rejected',
    agentId: opts.agentId,
    sourceTaskId: opts.taskId,
    contentSummary: summarizeRejectedOutput({
      agentId: opts.agentId,
      content: opts.content,
      title: opts.title,
      rejectionReason: opts.rejectionReason,
      feedbackNote: opts.feedbackNote,
    }),
    rawContext: {
      outputId: opts.outputId ?? null,
      rerunRequested: opts.rerun ?? false,
      rejectionReason: opts.rejectionReason ?? null,
      feedbackNote: opts.feedbackNote ?? null,
    },
  })
}

/** Bulk approve/reject — one row per task after primary action succeeds. */
export async function logBulkApprovalChangelog(
  actorProfileId: string,
  taskIds: string[],
): Promise<void> {
  if (taskIds.length === 0) return

  const supabase = createServiceClient()
  const { data: tasks } = await supabase
    .from('agent_tasks')
    .select('id, agent')
    .in('id', taskIds)

  const { data: outputs } = await supabase
    .from('agent_outputs')
    .select('task_id, id, title, content')
    .in('task_id', taskIds)
    .order('created_at', { ascending: false })

  const outputByTask = new Map<string, { id: string; title: string | null; content: unknown }>()
  for (const row of outputs ?? []) {
    if (!outputByTask.has(row.task_id)) {
      outputByTask.set(row.task_id, {
        id: row.id,
        title: row.title,
        content: row.content,
      })
    }
  }

  for (const task of tasks ?? []) {
    const output = outputByTask.get(task.id)
    logApprovalChangelog({
      actorProfileId,
      taskId: task.id,
      agentId: task.agent as string,
      outputId: output?.id ?? task.id,
      title: output?.title,
      contentAfter: output?.content,
    })
  }
}

export async function logBulkRejectionChangelog(
  actorProfileId: string,
  taskIds: string[],
  rejectionReason?: string | null,
  feedbackNote?: string | null,
  rerun?: boolean,
): Promise<void> {
  if (taskIds.length === 0) return

  const supabase = createServiceClient()
  const { data: tasks } = await supabase
    .from('agent_tasks')
    .select('id, agent')
    .in('id', taskIds)

  const { data: outputs } = await supabase
    .from('agent_outputs')
    .select('task_id, id, title, content')
    .in('task_id', taskIds)
    .order('created_at', { ascending: false })

  const outputByTask = new Map<string, { id: string; title: string | null; content: unknown }>()
  for (const row of outputs ?? []) {
    if (!outputByTask.has(row.task_id)) {
      outputByTask.set(row.task_id, {
        id: row.id,
        title: row.title,
        content: row.content,
      })
    }
  }

  for (const task of tasks ?? []) {
    const output = outputByTask.get(task.id)
    logRejectionChangelog({
      actorProfileId,
      taskId: task.id,
      agentId: task.agent as string,
      outputId: output?.id ?? null,
      title: output?.title,
      content: output?.content,
      rejectionReason,
      feedbackNote,
      rerun,
    })
  }
}
