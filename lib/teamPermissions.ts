import { createServiceClient } from '@/lib/supabase/server'
import type { PermissionKey, TeamPermissions } from '@/lib/teamPermissionsShared'

export type { PermissionKey, TeamPermissions } from '@/lib/teamPermissionsShared'
export { hasPermission } from '@/lib/teamPermissionsShared'

const DEFAULT_OWNER_PERMISSIONS: Record<PermissionKey, boolean> = {
  billing: true,
  services: true,
  ai_toolkit: true,
  analytics: true,
  brand_kit: true,
  deliverables: true,
  support: true,
}

const MINIMAL_MEMBER_PERMISSIONS: Record<PermissionKey, boolean> = {
  billing: false,
  services: false,
  ai_toolkit: false,
  analytics: false,
  brand_kit: false,
  deliverables: false,
  support: true,
}

export async function getTeamPermissions(profileId: string): Promise<TeamPermissions> {
  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_account_owner, account_id')
    .eq('id', profileId)
    .maybeSingle()

  // team_members is the source of truth for active memberships, even when profile flags are stale.
  const { data: membership } = await supabase
    .from('team_members')
    .select('permissions, role, account_id')
    .eq('member_profile_id', profileId)
    .eq('status', 'active')
    .maybeSingle()

  if (membership) {
    const accountId = (membership.account_id as string | null) ?? profile?.account_id ?? null

    if (
      profile &&
      (profile.is_account_owner !== false || profile.account_id !== accountId)
    ) {
      await supabase
        .from('profiles')
        .update({
          account_id: accountId,
          is_account_owner: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId)
    }

    return {
      isOwner: false,
      permissions: {
        ...DEFAULT_OWNER_PERMISSIONS,
        ...membership.permissions,
        support: true, // Always visible
      },
      accountId,
    }
  }

  if (!profile) {
    return {
      isOwner: false,
      permissions: MINIMAL_MEMBER_PERMISSIONS,
      accountId: null,
    }
  }

  // Owner has full access only when no active team membership overrides the profile row.
  if (profile.is_account_owner !== false) {
    return {
      isOwner: true,
      permissions: DEFAULT_OWNER_PERMISSIONS,
      accountId: null,
    }
  }

  // No active membership found — default to minimal access.
  return {
    isOwner: false,
    permissions: MINIMAL_MEMBER_PERMISSIONS,
    accountId: profile.account_id,
  }
}
