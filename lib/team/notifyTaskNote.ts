import { createNotification } from '@/lib/createNotification'
import { agentDisplayName } from '@/lib/agents/digestPreview'

export async function notifyTaskNote(opts: {
  workspaceId: string
  taskId: string
  agentId: string
  authorProfileId: string
  authorName: string
  bodyPreview: string
  recipientProfileIds: string[]
  mentionedProfileIds: string[]
}) {
  const agentName = agentDisplayName(opts.agentId)
  const link = `/dashboard/team/tasks/${opts.taskId}`
  const preview = opts.bodyPreview.length > 140
    ? `${opts.bodyPreview.slice(0, 137)}…`
    : opts.bodyPreview
  const mentionSet = new Set(opts.mentionedProfileIds)

  await Promise.all(
    opts.recipientProfileIds.map(async recipientId => {
      const mentioned = mentionSet.has(recipientId)
      await createNotification({
        userId: recipientId,
        senderId: opts.authorProfileId,
        title: mentioned
          ? `${opts.authorName} mentioned you on ${agentName}`
          : `New note on ${agentName}`,
        body: preview,
        type: mentioned ? 'task_note_mention' : 'task_note',
        link,
      })
    }),
  )
}
