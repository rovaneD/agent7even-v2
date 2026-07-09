import { createServiceClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/createNotification'
import { agentDisplayName } from '@/lib/agents/digestPreview'
import { formatProfileDisplayName } from '@/lib/profiles/resolveActorName'

export async function notifyAssignmentCreated(opts: {
  workspaceId: string
  assignerProfileId: string
  assigneeProfileId: string
  taskId: string
  agentId: string
  assignmentNote: string
}) {
  const supabase = createServiceClient()
  const [{ data: assigner }, { data: assignee }] = await Promise.all([
    supabase.from('profiles').select('full_name, email').eq('id', opts.assignerProfileId).maybeSingle(),
    supabase.from('profiles').select('full_name, email').eq('id', opts.assigneeProfileId).maybeSingle(),
  ])

  const assignerName = formatProfileDisplayName(assigner)
  const assigneeName = formatProfileDisplayName(assignee)
  const agentName = agentDisplayName(opts.agentId)
  const notePreview = opts.assignmentNote.length > 120
    ? `${opts.assignmentNote.slice(0, 117)}…`
    : opts.assignmentNote

  await createNotification({
    userId: opts.assigneeProfileId,
    senderId: opts.assignerProfileId,
    title: 'New assignment',
    body: `${assignerName} assigned ${agentName} to you — ${notePreview}`,
    type: 'assignment_created',
    link: `/dashboard/team/tasks/${opts.taskId}`,
  })

  await createNotification({
    userId: opts.workspaceId,
    senderId: opts.assignerProfileId,
    title: 'Assignment sent',
    body: `You assigned ${agentName} to ${assigneeName}.`,
    type: 'assignment_created',
    link: '/dashboard/team',
  })
}

export async function notifyAssignmentSubmitted(opts: {
  workspaceId: string
  assigneeProfileId: string
  taskId: string
  agentId: string
  title?: string | null
}) {
  const supabase = createServiceClient()
  const { data: assignee } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', opts.assigneeProfileId)
    .maybeSingle()

  const assigneeName = formatProfileDisplayName(assignee)
  const agentName = agentDisplayName(opts.agentId)
  const detail = opts.title?.trim()
    ? `${agentName}: ${opts.title.trim()}`
    : `${agentName} output is ready for your review.`

  await createNotification({
    userId: opts.workspaceId,
    senderId: opts.assigneeProfileId,
    title: 'Assignment submitted',
    body: `${assigneeName} completed an assignment — ${detail}`,
    type: 'assignment_submitted',
    link: `/dashboard/agents/approvals?task=${opts.taskId}`,
  })
}
