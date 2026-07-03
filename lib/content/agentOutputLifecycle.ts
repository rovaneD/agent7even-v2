import type { SupabaseClient } from '@supabase/supabase-js'
import { approvalQueueKind } from '@/lib/agents/contentPosting'

/** Unified post-pipeline stages stored on agent_outputs (Thread 3). */
export type ContentLifecycleStage =
  | 'review'
  | 'approved'
  | 'draft'
  | 'scheduled'
  | 'published'
  | 'rejected'

export function lifecycleStageFromOutputStatus(status: string): ContentLifecycleStage {
  if (status === 'pending_approval') return 'review'
  if (status === 'rejected') return 'rejected'
  return 'approved'
}

export function lifecycleStageFromZernioStatus(
  status: string | null | undefined,
): ContentLifecycleStage | null {
  const s = (status ?? '').toLowerCase()
  if (s === 'draft') return 'draft'
  if (s === 'scheduled') return 'scheduled'
  if (s === 'published') return 'published'
  return null
}

/** Post-type approvals that belong on the content pipeline (not weekly plans). */
export function isPostPipelineOutput(
  agent: string,
  task: {
    agent?: string
    input?: Record<string, unknown>
    agent_outputs?: Array<{ content?: Record<string, unknown> }>
  },
): boolean {
  return approvalQueueKind({ agent, ...task }) === 'post'
}

/** Approved post outputs not yet linked to Zernio — the missing "Approved" pipeline stage. */
export async function countApprovedPostPipelineOutputs(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('agent_outputs')
    .select('id, agent, content, task_id')
    .eq('user_id', userId)
    .eq('lifecycle_stage', 'approved')
    .is('zernio_post_id', null)

  if (error) throw error
  if (!data?.length) return 0

  const taskIds = [...new Set(data.map(row => row.task_id).filter(Boolean))]
  const taskInputById = new Map<string, Record<string, unknown>>()

  if (taskIds.length > 0) {
    const { data: tasks, error: taskErr } = await supabase
      .from('agent_tasks')
      .select('id, agent, input')
      .eq('user_id', userId)
      .in('id', taskIds)

    if (taskErr) throw taskErr
    for (const task of tasks ?? []) {
      taskInputById.set(task.id, (task.input ?? {}) as Record<string, unknown>)
    }
  }

  return data.filter(row => {
    const input = taskInputById.get(row.task_id) ?? {}
    return isPostPipelineOutput(row.agent, {
      agent: row.agent,
      input,
      agent_outputs: [{ content: row.content as Record<string, unknown> }],
    })
  }).length
}

export async function linkOutputToZernioPost(
  supabase: SupabaseClient,
  opts: {
    userId: string
    outputId: string
    zernioPostId: string
    stage?: ContentLifecycleStage
  },
): Promise<void> {
  const { error } = await supabase
    .from('agent_outputs')
    .update({
      zernio_post_id: opts.zernioPostId,
      lifecycle_stage: opts.stage ?? 'draft',
    })
    .eq('id', opts.outputId)
    .eq('user_id', opts.userId)

  if (error) throw error
}

/** Keep agent_outputs lifecycle in sync when a Zernio post changes status. */
export async function syncOutputLifecycleFromZernioPost(
  supabase: SupabaseClient,
  opts: {
    userId: string
    zernioPostId: string
    zernioStatus: string
  },
): Promise<void> {
  const stage = lifecycleStageFromZernioStatus(opts.zernioStatus)
  if (!stage) return

  const { error } = await supabase
    .from('agent_outputs')
    .update({ lifecycle_stage: stage })
    .eq('user_id', opts.userId)
    .eq('zernio_post_id', opts.zernioPostId)

  if (error) throw error
}

export function lifecycleStageLabel(stage: ContentLifecycleStage): string {
  switch (stage) {
    case 'review':
      return 'In review'
    case 'approved':
      return 'Approved'
    case 'draft':
      return 'Draft'
    case 'scheduled':
      return 'Scheduled'
    case 'published':
      return 'Published'
    case 'rejected':
      return 'Rejected'
  }
}
