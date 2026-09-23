import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyTeamMemberJoined } from '@/lib/team/notifyTeamMemberJoined'

export async function findPendingTeamInviteByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<{ id: string; account_id: string } | null> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) return null

  const { data } = await supabase
    .from('team_members')
    .select('id, account_id')
    .eq('invited_email', normalizedEmail)
    .eq('status', 'pending')
    .maybeSingle()

  return data ?? null
}

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
    .select('id, is_account_owner, account_id, full_name, email')
    .eq('id', profileId)
    .single()

  if (!profile) return null

  if (profile.is_account_owner === false && profile.account_id) {
    return { accountId: profile.account_id, activated: false }
  }

  const pendingInvite = await findPendingTeamInviteByEmail(supabase, normalizedEmail)
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

  try {
    await notifyTeamMemberJoined({
      accountId: pendingInvite.account_id,
      memberEmail: profile.email ?? normalizedEmail,
      memberName: profile.full_name,
      memberProfileId: profileId,
    })
  } catch (err) {
    console.error('[team] join notification failed:', err)
  }

  return { accountId: pendingInvite.account_id, activated: true }
}
