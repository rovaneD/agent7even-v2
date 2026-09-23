import { profileBypassesSubscriptionGate } from '@/lib/billing/subscriptionGate'

/** After an Atlas-first user deliberately opens Maya, send them through normal access — never a paid bypass. */
export function mayaAccessAfterProfile(opts: {
  profile: { id: string } | null
  isTeamMember: boolean
  billing: {
    role?: string | null
    billing_exempt?: boolean | null
    stripe_subscription_id?: string | null
    plan?: string | null
    status?: string | null
  } | null
}): 'start-trial' | 'continue' {
  if (!opts.profile) return 'start-trial'
  if (opts.isTeamMember) return 'continue'
  if (!opts.billing || !profileBypassesSubscriptionGate(opts.billing)) {
    return 'start-trial'
  }
  return 'continue'
}
