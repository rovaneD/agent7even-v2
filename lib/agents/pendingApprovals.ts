import type { SupabaseClient } from '@supabase/supabase-js'
import { agentOutputContentText } from '@/lib/agents/agentOutputText'
import { agentDisplayName, formatDigestPreview } from '@/lib/agents/digestPreview'

export const PENDING_APPROVAL_OUTPUT_STATUS = 'pending_approval' as const

export type PendingApprovalDigestItem = {
  taskId: string
  agentId: string
  agentName: string
  title?: string
  subtitle?: string
  preview: string
  createdAt: string
  reviewUrl: string
}

type PendingOutputRow = {
  id: string
  task_id: string
  agent: string
  title: string | null
  content: unknown
  created_at: string
}

/** Count pending outputs that still appear in the approval queue (task must exist). */
export async function getPendingApprovalCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const tasks = await listPendingApprovalTasks(supabase, userId)
  return tasks.reduce(
    (sum, task) => sum + ((task.agent_outputs as unknown[])?.length ?? 0),
    0,
  )
}

async function fetchPendingApprovalOutputs(
  supabase: SupabaseClient,
  userId: string,
  limit?: number,
): Promise<PendingOutputRow[]> {
  let query = supabase
    .from('agent_outputs')
    .select('id, task_id, agent, title, content, created_at')
    .eq('user_id', userId)
    .eq('status', PENDING_APPROVAL_OUTPUT_STATUS)
    .order('created_at', { ascending: false })

  if (limit != null) query = query.limit(limit)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as PendingOutputRow[]
}

export function pendingOutputsToDigestItems(outputs: PendingOutputRow[]): PendingApprovalDigestItem[] {
  return outputs.map(output => {
    const raw = agentOutputContentText(output.content)
    const formatted = formatDigestPreview(raw, output.agent)
    const title = output.title?.trim() || formatted.title
    return {
      taskId: output.task_id,
      agentId: output.agent,
      agentName: agentDisplayName(output.agent),
      title,
      subtitle: formatted.subtitle,
      preview: raw.slice(0, 280),
      createdAt: output.created_at,
      reviewUrl: `/dashboard/agents/approvals?task=${output.task_id}`,
    }
  })
}

/** Dashboard brief / digest rows for pending approvals. */
export async function listPendingApprovalDigestItems(
  supabase: SupabaseClient,
  userId: string,
  limit = 5,
): Promise<PendingApprovalDigestItem[]> {
  const outputs = await fetchPendingApprovalOutputs(supabase, userId, limit)
  return pendingOutputsToDigestItems(outputs)
}

export type PendingApprovalTaskRow = {
  id: string
  agent: string
  status: string
  priority: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  requires_approval: boolean
  approved_at: string | null
  rejected_at: string | null
  rejection_note: string | null
  actor_profile_id?: string | null
  actorName?: string
  error?: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  updated_at: string | null
  agent_outputs?: Array<Record<string, unknown>>
}

/** Approval queue tasks joined with outputs — only tasks that still have pending outputs. */
export async function listPendingApprovalTasks(
  supabase: SupabaseClient,
  userId: string,
) {
  const outputs = await fetchPendingApprovalOutputs(supabase, userId)
  const taskIds = [...new Set(outputs.map(row => row.task_id).filter(Boolean))]
  if (taskIds.length === 0) return []

  const { data, error } = await supabase
    .from('agent_tasks')
    .select('*, agent_outputs(*)')
    .eq('user_id', userId)
    .in('id', taskIds)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map(task => ({
    ...task,
    agent_outputs: (task.agent_outputs ?? []).filter(
      (output: { status?: string }) => output.status === PENDING_APPROVAL_OUTPUT_STATUS,
    ),
  }))
}

