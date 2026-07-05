import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { listWorkspaceActivity } from '@/lib/team/workspaceActivity'
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_name, plan, stripe_subscription_id, is_account_owner, account_id')
    .eq('clerk_user_id', userId)
    .single()

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

  let activityItems: Awaited<ReturnType<typeof listWorkspaceActivity>> = []
  try {
    activityItems = await listWorkspaceActivity(supabase, profile.id)
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
      activityItems={activityItems}
    />
  )
}
