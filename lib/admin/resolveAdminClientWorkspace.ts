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
