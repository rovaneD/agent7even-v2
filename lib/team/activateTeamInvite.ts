import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyTeamMemberJoined } from '@/lib/team/notifyTeamMemberJoined'

type InviteActivationProfile = {
  id: string
  is_account_owner: boolean | null
  account_id: string | null
  full_name: string | null
  email: string | null
  company_name: string | null
  plan: string | null
  status: string | null
  onboarding_complete: boolean | null
  foundation_complete: boolean | null
  foundation_step: number | null
  foundation_answers: unknown
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
}

function isFreshInviteeProfile(profile: InviteActivationProfile): boolean {
  if (profile.is_account_owner === false || profile.account_id) return false

  const hasBilling = Boolean(
    profile.stripe_customer_id ||
      profile.stripe_subscription_id ||
      profile.plan,
  )
  const hasWorkspaceState = Boolean(
    profile.company_name?.trim() ||
      profile.onboarding_complete ||
      profile.foundation_complete ||
      profile.foundation_step ||
      profile.foundation_answers,
  )
  const hasEstablishedStatus = Boolean(
    profile.status && profile.status !== 'onboarding',
  )

  return !hasBilling && !hasWorkspaceState && !hasEstablishedStatus
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
    .select(
      [
        'id',
        'is_account_owner',
        'account_id',
        'full_name',
        'email',
        'company_name',
        'plan',
        'status',
        'onboarding_complete',
        'foundation_complete',
        'foundation_step',
        'foundation_answers',
        'stripe_customer_id',
        'stripe_subscription_id',
      ].join(', '),
    )
    .eq('id', profileId)
    .single()

  const activationProfile = profile as InviteActivationProfile | null
  if (!activationProfile) return null

  if (activationProfile.is_account_owner === false && activationProfile.account_id) {
    return { accountId: activationProfile.account_id, activated: false }
  }

  const profileEmail = activationProfile.email?.trim().toLowerCase()
  if (!profileEmail || profileEmail !== normalizedEmail) return null

  if (!isFreshInviteeProfile(activationProfile)) {
    console.warn('[team] skipped invite activation for established profile:', profileId)
    return null
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

  await notifyTeamMemberJoined({
    accountId: pendingInvite.account_id,
    memberEmail: activationProfile.email ?? normalizedEmail,
    memberName: activationProfile.full_name,
    memberProfileId: profileId,
  }).catch(err => console.error('[team] join notification failed:', err))

  return { accountId: pendingInvite.account_id, activated: true }
}
