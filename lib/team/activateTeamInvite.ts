import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyTeamMemberJoined } from '@/lib/team/notifyTeamMemberJoined'
import { decideTeamInviteActivation } from '@/lib/team/teamInviteActivation'

export type ActivateTeamInviteResult = {
  accountId: string
  activated: boolean
  refused?: boolean
  reason?: string
}

const INVITE_PROFILE_SELECT =
  'id, is_account_owner, account_id, full_name, email, plan, status, stripe_customer_id, stripe_subscription_id, foundation_complete, onboarding_complete, role, billing_exempt'

/** Link a profile to a pending team invite by email (idempotent when already linked). */
export async function activateTeamInviteForProfile(
  supabase: SupabaseClient,
  profileId: string,
  email: string,
): Promise<ActivateTeamInviteResult | null> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select(INVITE_PROFILE_SELECT)
    .eq('id', profileId)
    .single()

  if (!profile) return null

  const { data: pendingInvite } = await supabase
    .from('team_members')
    .select('id, account_id')
    .eq('invited_email', normalizedEmail)
    .eq('status', 'pending')
    .maybeSingle()

  if (!pendingInvite) {
    if (profile.is_account_owner === false && profile.account_id) {
      return { accountId: profile.account_id, activated: false }
    }
    return null
  }

  const { count: ownedTeamMemberCount } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', profileId)
    .neq('status', 'removed')

  const decision = decideTeamInviteActivation(profile, pendingInvite.account_id, {
    ownedTeamMemberCount: ownedTeamMemberCount ?? 0,
  })

  if (decision.action === 'already_member') {
    return { accountId: decision.accountId, activated: false }
  }

  if (decision.action === 'refuse_existing_workspace') {
    console.warn('[team] refused invite activation for existing workspace', {
      profileId,
      inviteAccountId: pendingInvite.account_id,
      reason: decision.reason,
    })
    return {
      accountId: pendingInvite.account_id,
      activated: false,
      refused: true,
      reason: decision.reason,
    }
  }

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

  await notifyTeamMemberJoined({
    accountId: pendingInvite.account_id,
    memberEmail: profile.email ?? normalizedEmail,
    memberName: profile.full_name,
    memberProfileId: profileId,
  }).catch(err => console.error('[team] join notification failed:', err))

  return { accountId: pendingInvite.account_id, activated: true }
}
