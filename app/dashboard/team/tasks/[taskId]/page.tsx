import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getWorkspaceSessionForClerkUser } from '@/lib/profiles/workspaceSession'
import { getTeamPermissions } from '@/lib/teamPermissions'
import { formatProfileDisplayName } from '@/lib/profiles/resolveActorName'
import {
  assertWorkspaceTeamParticipant,
  listTaskNotes,
  loadAssignmentTask,
} from '@/lib/team/taskNotes'
import { listWorkspaceTeamMembers } from '@/lib/team/teamRoster'
import TaskDetailClient from './TaskDetailClient'

export default async function TeamTaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>
}) {
  const { taskId } = await params
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  const supabase = createServiceClient()
  const session = await getWorkspaceSessionForClerkUser(supabase, userId, email)
  if (!session) redirect('/dashboard')

  const access = await assertWorkspaceTeamParticipant(
    supabase,
    session.workspaceId,
    session.memberId,
  )
  if (!access.ok) redirect('/dashboard')

  const task = await loadAssignmentTask(supabase, session.workspaceId, taskId)
  if (!task) notFound()

  const [notes, teamRoster, perms] = await Promise.all([
    listTaskNotes(supabase, taskId),
    listWorkspaceTeamMembers(supabase, session.workspaceId),
    getTeamPermissions(session.memberId),
  ])

  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', session.workspaceId)
    .single()

  return (
    <TaskDetailClient
      task={task}
      initialNotes={notes}
      viewerProfileId={session.memberId}
      isOwner={perms.isOwner}
      ownerMention={{
        id: session.workspaceId,
        name: formatProfileDisplayName(ownerProfile),
        email: ownerProfile?.email ?? '',
      }}
      teamRoster={teamRoster}
    />
  )
}
