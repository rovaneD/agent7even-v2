import type { SupabaseClient } from '@supabase/supabase-js'
import { PENDING_APPROVAL_OUTPUT_STATUS } from '@/lib/agents/pendingApprovals'

type ApprovalProfileRow = {
  id: string
  clerk_user_id: string | null
  created_at: string
  role?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  plan?: string | null
}

/** Match dashboard/billing — avoid picking the wrong duplicate profile row. */
export async function resolveApprovalActorProfile(
  supabase: SupabaseClient,
  clerkUserId: string,
): Promise<{ id: string } | null> {
  const { data: rows } = await supabase
    .from('profiles')
    .select('id, clerk_user_id, created_at, role, stripe_customer_id, stripe_subscription_id, plan')
    .eq('clerk_user_id', clerkUserId)

  if (!rows?.length) return null

  const sorted = [...rows].sort((a, b) => {
    const rank = (role?: string | null) => (role === 'owner' ? 0 : role === 'admin' ? 1 : 2)
    const ar = rank(a.role)
    const br = rank(b.role)
    if (ar !== br) return ar - br
    if (a.stripe_customer_id && !b.stripe_customer_id) return -1
    if (!a.stripe_customer_id && b.stripe_customer_id) return 1
    if (a.plan && !b.plan) return -1
    if (!a.plan && b.plan) return 1
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  return { id: (sorted[0] as ApprovalProfileRow).id }
}

export async function assertTaskOwnedByProfile(
  supabase: SupabaseClient,
  taskId: string,
  workspaceId: string,
) {
  const { data: task, error } = await supabase
    .from('agent_tasks')
    .select('id, agent, input, priority, user_id')
    .eq('id', taskId)
    .eq('user_id', workspaceId)
    .single()

  if (error || !task) return null
  return task
}

/** Reject every pending output on the task — handles duplicate rows and null user_id orphans. */
export async function rejectAllPendingOutputsForTask(
  supabase: SupabaseClient,
  opts: {
    workspaceId: string
    actorProfileId: string
    taskId: string
    rejectionText: string | null
    feedback: string | null
  },
) {
  const task = await assertTaskOwnedByProfile(supabase, opts.taskId, opts.workspaceId)
  if (!task) {
    return { ok: false as const, error: 'Task not found', task: null, outputs: [] }
  }

  const now = new Date().toISOString()

  const { data: outputs, error: outputErr } = await supabase
    .from('agent_outputs')
    .update({
      status: 'rejected',
      lifecycle_stage: 'rejected',
      feedback: opts.feedback,
      feedback_note: opts.rejectionText,
      feedback_at: now,
    })
    .eq('task_id', opts.taskId)
    .eq('status', PENDING_APPROVAL_OUTPUT_STATUS)
    .select('id, title, content, agent')

  if (outputErr) {
    return { ok: false as const, error: outputErr.message, task: null, outputs: [] }
  }

  if (!outputs?.length) {
    return { ok: false as const, error: 'No pending outputs to reject', task: null, outputs: [] }
  }

  const { error: taskErr } = await supabase
    .from('agent_tasks')
    .update({
      rejected_at: now,
      rejection_note: opts.rejectionText,
      rejection_reason: opts.feedback,
      reviewed_at: now,
      reviewed_by: opts.actorProfileId,
    })
    .eq('id', opts.taskId)
    .eq('user_id', opts.workspaceId)

  if (taskErr) {
    return { ok: false as const, error: taskErr.message, task: null, outputs: [] }
  }

  return { ok: true as const, task, outputs }
}
