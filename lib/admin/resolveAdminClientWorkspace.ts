import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminOwnerWorkspace = {
  id: string
  full_name: string | null
  email: string | null
  company_name: string | null
  plan: string | null
  status: string | null
  foundation_score: number | null
  foundation_complete: boolean | null
  foundation_answers: Record<string, unknown> | null
  stripe_customer_id: string | null
  billing_exempt?: boolean | null
}

export type AdminTeamMembership = {
  id: string
  role: string
  status: string
  permissions: Record<string, boolean> | null
  created_at: string
}

export type AdminWorkspaceContext = {
  isTeamMember: boolean
  workspaceId: string
  owner: AdminOwnerWorkspace | null
  membership: AdminTeamMembership | null
}

type ProfileWorkspaceFields = {
  id: string
  is_account_owner?: boolean | null
  account_id?: string | null
}

export function isTeamMemberProfile(profile: ProfileWorkspaceFields): boolean {
  return profile.is_account_owner === false && !!profile.account_id
}

/** Workspace owner profile id — same SSOT as dashboard team workspace. */
export function resolveAdminWorkspaceId(profile: ProfileWorkspaceFields): string {
  if (isTeamMemberProfile(profile)) return profile.account_id as string
  return profile.id
}

export async function resolveAdminWorkspaceContext(
  supabase: SupabaseClient,
  profile: ProfileWorkspaceFields,
): Promise<Pick<AdminWorkspaceContext, 'isTeamMember' | 'workspaceId' | 'membership'>> {
  if (!isTeamMemberProfile(profile)) {
    return { isTeamMember: false, workspaceId: profile.id, membership: null }
  }

  const workspaceId = profile.account_id as string
  const { data: membership } = await supabase
    .from('team_members')
    .select('id, role, status, permissions, created_at')
    .eq('member_profile_id', profile.id)
    .eq('account_id', workspaceId)
    .eq('status', 'active')
    .maybeSingle()

  if (!membership) {
    return { isTeamMember: false, workspaceId: profile.id, membership: null }
  }

  return {
    isTeamMember: true,
    workspaceId,
    membership: membership as AdminTeamMembership,
  }
}

export async function resolveAdminWorkspaceTargetId(
  supabase: SupabaseClient,
  profileId: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, is_account_owner, account_id')
    .eq('id', profileId)
    .maybeSingle()

  if (!profile) return null
  const context = await resolveAdminWorkspaceContext(
    supabase,
    profile as ProfileWorkspaceFields,
  )
  return context.workspaceId
}
