import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DASHBOARD_PROFILE_SELECT,
  getDashboardProfileForClerkUser,
  type DashboardProfile,
} from '@/lib/profiles/getDashboardProfile'
import { resolveWorkspaceProfileId } from '@/lib/profiles/workspaceProfile'
import { activateTeamInviteForProfile } from '@/lib/team/activateTeamInvite'

export type DashboardWorkspaceContext = {
  memberProfile: DashboardProfile
  workspaceProfile: DashboardProfile
  workspaceId: string
  isTeamMember: boolean
  ownerCompanyName: string | null
}

export async function getDashboardWorkspaceContext(
  supabase: SupabaseClient,
  memberProfile: DashboardProfile,
): Promise<DashboardWorkspaceContext> {
  const workspaceId = await resolveWorkspaceProfileId(supabase, memberProfile.id)

  let workspaceProfile = memberProfile
  if (workspaceId !== memberProfile.id) {
    const { data: owner } = await supabase
      .from('profiles')
      .select(DASHBOARD_PROFILE_SELECT)
      .eq('id', workspaceId)
      .maybeSingle()

    if (owner) workspaceProfile = owner as DashboardProfile
  }

  const isTeamMember =
    memberProfile.is_account_owner === false &&
    !!memberProfile.account_id &&
    workspaceId !== memberProfile.id

  return {
    memberProfile,
    workspaceProfile,
    workspaceId,
    isTeamMember,
    ownerCompanyName: isTeamMember ? workspaceProfile.company_name : null,
  }
}

async function refetchDashboardProfile(
  supabase: SupabaseClient,
  profileId: string,
): Promise<DashboardProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select(DASHBOARD_PROFILE_SELECT)
    .eq('id', profileId)
    .maybeSingle()

  return (data as DashboardProfile | null) ?? null
}

/** Resolve profile, sync pending team invite, and load workspace context for dashboard surfaces. */
export async function loadDashboardSession(
  supabase: SupabaseClient,
  clerkUserId: string,
  email?: string | null,
): Promise<{
  profile: DashboardProfile | null
  workspace: DashboardWorkspaceContext | null
}> {
  let profile = await getDashboardProfileForClerkUser(supabase, clerkUserId, email)
  if (!profile) return { profile: null, workspace: null }

  if (email?.trim()) {
    const activation = await activateTeamInviteForProfile(supabase, profile.id, email)
    if (activation?.activated) {
      profile = (await refetchDashboardProfile(supabase, profile.id)) ?? profile
    }
  }

  const workspace = await getDashboardWorkspaceContext(supabase, profile)
  return { profile, workspace }
}
