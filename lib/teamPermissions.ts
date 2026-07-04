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

export async function getTeamPermissions(profileId: string): Promise<TeamPermissions> {
  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_account_owner, account_id')
    .eq('id', profileId)
    .single()

  // Owner has full access
  if (!profile || profile.is_account_owner !== false) {
    return {
      isOwner: true,
      permissions: DEFAULT_OWNER_PERMISSIONS,
      accountId: null,
    }
  }

  // Team member — fetch their permissions
  const { data: membership } = await supabase
    .from('team_members')
    .select('permissions, role')
    .eq('account_id', profile.account_id)
    .eq('member_profile_id', profileId)
    .eq('status', 'active')
    .single()

  if (!membership) {
    // No active membership found — default to minimal access
    return {
      isOwner: false,
      permissions: {
        billing: false,
        services: false,
        ai_toolkit: false,
        analytics: false,
        brand_kit: false,
        deliverables: false,
        support: true,
      },
      accountId: profile.account_id,
    }
  }

  return {
    isOwner: false,
    permissions: {
      ...DEFAULT_OWNER_PERMISSIONS,
      ...membership.permissions,
      support: true, // Always visible
    },
    accountId: profile.account_id,
  }
}
