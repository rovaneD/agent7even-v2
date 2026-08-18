import { shouldPublishApprovedPost } from '@/lib/agents/contentPosting'

export function captionFromOutputContent(outputContent: Record<string, unknown>): string {
  return typeof outputContent.raw === 'string' ? outputContent.raw : ''
}

export type ApprovedPublishTarget = {
  outputId: string
  taskId: string
  agentId: string
  taskInput: Record<string, unknown>
  outputContent: Record<string, unknown>
  caption: string
}

/** Rows that single-approve already publishes — bulk approve must use the same gate. */
export function selectApprovedPublishTargets(
  outputs: Array<{ id: string; task_id: string; content: unknown }>,
  tasksById: Map<string, { agent?: string | null; input?: unknown }>,
): ApprovedPublishTarget[] {
  const targets: ApprovedPublishTarget[] = []
  for (const output of outputs) {
    const task = tasksById.get(output.task_id)
    if (!task) continue
    const outputContent = (output.content ?? {}) as Record<string, unknown>
    const caption = captionFromOutputContent(outputContent)
    const agentId = (task.agent as string) ?? ''
    const taskInput = (task.input ?? {}) as Record<string, unknown>
    if (!shouldPublishApprovedPost({ agentId, taskInput, outputContent, caption })) continue
    targets.push({
      outputId: output.id,
      taskId: output.task_id,
      agentId,
      taskInput,
      outputContent,
      caption,
    })
  }
  return targets
}
