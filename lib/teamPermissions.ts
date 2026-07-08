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

  // Team member — fetch their permissions (team_members is SSOT when profile link is stale)
  const { data: membership } = await supabase
    .from('team_members')
    .select('permissions, role, account_id')
    .eq('member_profile_id', profileId)
    .eq('status', 'active')
    .maybeSingle()

  const accountId = profile?.account_id ?? (membership?.account_id as string | null) ?? null

  if (membership) {
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

  // Owner has full access. Check membership first because team_members is SSOT
  // during invite-link backfills where profile flags may still be stale.
  if (!profile || profile.is_account_owner !== false) {
    return {
      isOwner: true,
      permissions: DEFAULT_OWNER_PERMISSIONS,
      accountId: null,
    }
  }

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
    accountId,
  }
}
