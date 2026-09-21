import { isPaidPlan } from '../plans'

function isInternalPlatformAccount(profile: {
  role?: string | null
  billing_exempt?: boolean | null
}): boolean {
  if (profile.role === 'admin' || profile.role === 'owner') return true
  if (profile.billing_exempt) return true
  return false
}

export type TeamInviteActivationProfile = {
  id: string
  is_account_owner?: boolean | null
  account_id?: string | null
  plan?: string | null
  status?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  foundation_complete?: boolean | null
  onboarding_complete?: boolean | null
  role?: string | null
  billing_exempt?: boolean | null
}

export type TeamInviteActivationDecision =
  | { action: 'already_member'; accountId: string }
  | { action: 'activate' }
  | { action: 'refuse_existing_workspace'; reason: string }

/**
 * Team invites may convert a blank onboarding shell into a member row.
 * They must never demote a live workspace owner — dashboard session load
 * auto-calls activation, so a pending invite would otherwise orphan the
 * invitee's Foundation, billing, and team.
 */
export function decideTeamInviteActivation(
  profile: TeamInviteActivationProfile,
  inviteAccountId: string,
  opts?: { ownedTeamMemberCount?: number },
): TeamInviteActivationDecision {
  if (profile.id === inviteAccountId) {
    return { action: 'refuse_existing_workspace', reason: 'self_invite' }
  }

  if (profile.is_account_owner === false && profile.account_id) {
    if (profile.account_id === inviteAccountId) {
      return { action: 'already_member', accountId: profile.account_id }
    }
    return { action: 'refuse_existing_workspace', reason: 'other_team' }
  }

  if (isInternalPlatformAccount(profile)) {
    return { action: 'refuse_existing_workspace', reason: 'internal_account' }
  }

  if (profile.status !== 'churned') {
    if (isPaidPlan(profile.plan)) {
      return { action: 'refuse_existing_workspace', reason: 'paid_plan' }
    }
    if (profile.stripe_subscription_id) {
      return { action: 'refuse_existing_workspace', reason: 'stripe_subscription' }
    }
    if (profile.foundation_complete) {
      return { action: 'refuse_existing_workspace', reason: 'foundation_complete' }
    }
    if (profile.onboarding_complete) {
      return { action: 'refuse_existing_workspace', reason: 'onboarding_complete' }
    }
  }

  if ((opts?.ownedTeamMemberCount ?? 0) > 0) {
    return { action: 'refuse_existing_workspace', reason: 'owns_team' }
  }

  return { action: 'activate' }
}
