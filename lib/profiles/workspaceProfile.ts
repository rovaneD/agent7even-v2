import type { SupabaseClient } from '@supabase/supabase-js'

type ProfileWorkspaceRow = {
  id: string
  is_account_owner: boolean | null
  account_id: string | null
}

async function resolveActiveTeamAccountId(
  supabase: SupabaseClient,
  memberProfileId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('team_members')
    .select('account_id')
    .eq('member_profile_id', memberProfileId)
    .eq('status', 'active')
    .maybeSingle()

  return (data?.account_id as string | null) ?? null
}

/** Backfill profile.account_id when team_members is authoritative (idempotent). */
async function backfillMemberAccountLink(
  supabase: SupabaseClient,
  memberProfileId: string,
  accountId: string,
): Promise<void> {
  await supabase
    .from('profiles')
    .update({
      account_id: accountId,
      is_account_owner: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', memberProfileId)
    .or('account_id.is.null,is_account_owner.is.null,is_account_owner.eq.true')
}

export function resolveWorkspaceProfileIdFromRow(profile: ProfileWorkspaceRow): string {
  if (profile.is_account_owner === false && profile.account_id) {
    return profile.account_id
  }
  return profile.id
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

  const direct = resolveWorkspaceProfileIdFromRow(data)
  if (direct !== data.id) return direct

  // Active team member with missing profile.account_id — use team_members SSOT.
  if (data.is_account_owner !== true) {
    const accountId = await resolveActiveTeamAccountId(supabase, profileId)
    if (accountId) {
      await backfillMemberAccountLink(supabase, profileId, accountId)
      return accountId
    }
  }

  return profileId
}
