import type { SupabaseClient } from '@supabase/supabase-js'

type ProfileWorkspaceRow = {
  id: string
  is_account_owner: boolean | null
  account_id: string | null
}

/** Owner profile id for workspace-scoped data (sessions, brand kit, approvals). */
export async function resolveWorkspaceProfileId(
  supabase: SupabaseClient,
  profileId: string,
): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('id, is_account_owner, account_id')
    .eq('id', profileId)
    .single()

  if (!data) return profileId
  return resolveWorkspaceProfileIdFromRow(data)
}

export function resolveWorkspaceProfileIdFromRow(profile: ProfileWorkspaceRow): string {
  if (profile.is_account_owner === false && profile.account_id) {
    return profile.account_id
  }
  return profile.id
}
