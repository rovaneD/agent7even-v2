import { createServiceClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/createNotification'
import { agentDisplayName } from '@/lib/agents/digestPreview'
import { formatProfileDisplayName } from '@/lib/profiles/resolveActorName'

export async function notifyApprovalPending(opts: {
  workspaceId: string
  actorProfileId?: string | null
  taskId: string
  agentId: string
  title?: string | null
}) {
  const supabase = createServiceClient()

  const [{ data: profile }, { data: actor }] = await Promise.all([
    supabase
      .from('profiles')
      .select('email_approvals')
      .eq('id', opts.workspaceId)
      .single(),
    opts.actorProfileId
      ? supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', opts.actorProfileId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const agentName = agentDisplayName(opts.agentId)
  const actorName = formatProfileDisplayName(actor)
  const trimmedTitle = opts.title?.trim()
  const outputLine = trimmedTitle
    ? `${agentName}: ${trimmedTitle}`
    : `${agentName} output is ready for your review.`

  await createNotification({
    userId: opts.workspaceId,
    senderId: opts.actorProfileId ?? null,
    title: 'Approval needed',
    body: `Submitted by ${actorName} — ${outputLine}`,
    type: 'approval_pending',
    link: `/dashboard/agents/approvals?task=${opts.taskId}`,
    sendEmail: profile?.email_approvals ?? true,
    emailSubject: `Approval needed — ${agentName} (${actorName})`,
  })
}
