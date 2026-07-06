import type { SupabaseClient } from '@supabase/supabase-js'

function hasMeaningfulJson(value: unknown): boolean {
  if (!value) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0
  return true
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
    .select(`
      id,
      is_account_owner,
      account_id,
      stripe_customer_id,
      stripe_subscription_id,
      plan,
      status,
      onboarding_complete,
      foundation_complete,
      foundation_answers,
      company_name,
      business_type
    `)
    .eq('id', profileId)
    .single()

  if (!profile) return null

  if (profile.is_account_owner === false && profile.account_id) {
    return { accountId: profile.account_id, activated: false }
  }

  const hasExistingOwnerState =
    profile.is_account_owner !== false &&
    Boolean(
      profile.stripe_customer_id ||
      profile.stripe_subscription_id ||
      profile.plan ||
      (profile.status && profile.status !== 'onboarding') ||
      profile.onboarding_complete ||
      profile.foundation_complete ||
      hasMeaningfulJson(profile.foundation_answers) ||
      profile.company_name ||
      profile.business_type,
    )

  if (hasExistingOwnerState) {
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

  return { accountId: pendingInvite.account_id, activated: true }
}
