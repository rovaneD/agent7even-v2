import { createNotification } from '@/lib/createNotification'
import { agentDisplayName } from '@/lib/agents/digestPreview'

export async function notifyApprovalNote(opts: {
  workspaceId: string
  taskId: string
  agentId: string
  authorProfileId: string
  authorName: string
  bodyPreview: string
  recipientProfileIds: string[]
  mentionedProfileIds: string[]
  decisionKind?: 'approved' | 'rejected' | null
}) {
  const agentName = agentDisplayName(opts.agentId)
  const link = `/dashboard/agents/approvals?task=${opts.taskId}`
  const preview = opts.bodyPreview.length > 140
    ? `${opts.bodyPreview.slice(0, 137)}…`
    : opts.bodyPreview
  const mentionSet = new Set(opts.mentionedProfileIds)
  const decisionLabel = opts.decisionKind === 'approved'
    ? 'Approved'
    : opts.decisionKind === 'rejected'
      ? 'Rejected'
      : null

  await Promise.all(
    opts.recipientProfileIds.map(async recipientId => {
      const mentioned = mentionSet.has(recipientId)
      let title: string
      if (decisionLabel) {
        title = `${opts.authorName} ${decisionLabel.toLowerCase()} ${agentName}`
      } else if (mentioned) {
        title = `${opts.authorName} mentioned you on ${agentName} approval`
      } else {
        title = `New note on ${agentName} approval`
      }
      await createNotification({
        userId: recipientId,
        senderId: opts.authorProfileId,
        title,
        body: preview,
        type: mentioned ? 'approval_note_mention' : 'approval_note',
        link,
      })
    }),
  )
}
