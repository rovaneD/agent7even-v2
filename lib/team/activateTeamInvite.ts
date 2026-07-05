import type { SupabaseClient } from '@supabase/supabase-js'

/** Link a profile to a pending team invite by email (idempotent when already linked). */
export async function activateTeamInviteForProfile(
  supabase: SupabaseClient,
  profileId: string,
  email: string,
): Promise<{ accountId: string; activated: boolean } | null> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, is_account_owner, account_id')
    .eq('id', profileId)
    .single()

  if (!profile) return null

  if (profile.is_account_owner === false && profile.account_id) {
    return { accountId: profile.account_id, activated: false }
  }

  const { data: pendingInvite } = await supabase
    .from('team_members')
    .select('id, account_id')
    .eq('invited_email', normalizedEmail)
    .eq('status', 'pending')
    .maybeSingle()

  if (!pendingInvite) return null

  const { error: memberError } = await supabase
    .from('team_members')
    .update({
      member_profile_id: profileId,
      status: 'active',
    })
    .eq('id', pendingInvite.id)

  if (memberError) {
    console.error('[team] activate invite member update failed:', memberError.message)
    return null
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      account_id: pendingInvite.account_id,
      is_account_owner: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId)

  if (profileError) {
    console.error('[team] activate invite profile update failed:', profileError.message)
    return null
  }

  return { accountId: pendingInvite.account_id, activated: true }
}
