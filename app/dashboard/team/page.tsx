import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { listWorkspaceActivity } from '@/lib/team/workspaceActivity'
import { listOpenWorkspaceAssignments } from '@/lib/team/taskAssignments'
import { listTaskNoteSummaries } from '@/lib/team/taskNotes'
import TeamClient from './TeamClient'

const PLAN_SEAT_LIMITS: Record<string, number> = {
  starter: 1,
  growth: 3,
  proagent: 5,
}

export default async function TeamPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const profile = await resolveClerkProfile<{
    id: string
    company_name: string | null
    plan: string | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    is_account_owner: boolean | null
    account_id: string | null
    created_at: string
  }>(supabase, userId, 'id, company_name, plan, stripe_subscription_id, is_account_owner, account_id')

  if (!profile) redirect('/dashboard')

  // If this user is a team member, redirect to owner's dashboard
  if (!profile.is_account_owner && profile.account_id) {
    redirect('/dashboard')
  }

  // Fetch team members
  const { data: teamMembers } = await supabase
    .from('team_members')
    .select('*, profiles!team_members_member_profile_id_fkey(id, full_name, email, avatar_url)')
    .eq('account_id', profile.id)
    .order('created_at', { ascending: false })

  const includedSeats = PLAN_SEAT_LIMITS[profile.plan ?? ''] ?? 1
  const activeMembers = teamMembers?.filter(m => m.status === 'active').length ?? 0
  const pendingMembers = teamMembers?.filter(m => m.status === 'pending').length ?? 0

  let activityResult: Awaited<ReturnType<typeof listWorkspaceActivity>> = {
    items: [],
    teamActionCount: 0,
    ownerActionCount: 0,
  }
  let openAssignments: Awaited<ReturnType<typeof listOpenWorkspaceAssignments>> = []
  let assignmentNoteSummaries: Awaited<ReturnType<typeof listTaskNoteSummaries>> = {}
  try {
    activityResult = await listWorkspaceActivity(supabase, profile.id, { teamOnly: false })
    openAssignments = await listOpenWorkspaceAssignments(supabase, profile.id)
    assignmentNoteSummaries = await listTaskNoteSummaries(
      supabase,
      openAssignments.map(a => a.id),
    )
  } catch (err) {
    console.error('[team/page] activity fetch failed:', err)
  }

  return (
    <TeamClient
      profileId={profile.id}
      companyName={profile.company_name ?? ''}
      plan={profile.plan ?? ''}
      stripeSubscriptionId={profile.stripe_subscription_id ?? ''}
      includedSeats={includedSeats}
      activeMembers={activeMembers}
      pendingMembers={pendingMembers}
      teamMembers={teamMembers ?? []}
      activityItems={activityResult.items}
      activityTeamCount={activityResult.teamActionCount}
      activityOwnerCount={activityResult.ownerActionCount}
      openAssignments={openAssignments}
      assignmentNoteSummaries={assignmentNoteSummaries}
    />
  )
}
