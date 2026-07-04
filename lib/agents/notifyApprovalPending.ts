import { createServiceClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/createNotification'
import { agentDisplayName } from '@/lib/agents/digestPreview'
import { resolveWorkspaceProfileId } from '@/lib/profiles/workspaceProfile'

export async function notifyApprovalPending(opts: {
  profileId: string
  taskId: string
  agentId: string
  title?: string | null
}) {
  const supabase = createServiceClient()
  const workspaceId = await resolveWorkspaceProfileId(supabase, opts.profileId)

  const { data: profile } = await supabase
    .from('profiles')
    .select('email_approvals')
    .eq('id', workspaceId)
    .single()

  const agentName = agentDisplayName(opts.agentId)
  const trimmedTitle = opts.title?.trim()
  const body = trimmedTitle
    ? `${agentName}: ${trimmedTitle}`
    : `${agentName} output is ready for your review.`

  await createNotification({
    userId: workspaceId,
    title: 'Approval needed',
    body,
    type: 'approval_pending',
    link: `/dashboard/agents/approvals?task=${opts.taskId}`,
    sendEmail: profile?.email_approvals ?? true,
    emailSubject: `Approval needed — ${agentName}`,
  })
}
