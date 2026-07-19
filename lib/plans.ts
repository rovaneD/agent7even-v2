export const PAID_PLANS = ['starter', 'growth', 'proagent'] as const
export type PaidPlan = (typeof PAID_PLANS)[number]

export const PLAN_LABELS: Record<PaidPlan, string> = {
  starter: 'Starter',
  growth: 'Growth',
  proagent: 'ProAgent',
}

export const PLAN_MONTHLY_PRICE: Record<PaidPlan, number> = {
  starter: 49,
  growth: 89,
  proagent: 149,
}

/** Monthly media credit pool (images/video meter only — text/chat/agents are unlimited). */
export const PLAN_MEDIA_CREDITS: Record<PaidPlan, number> = {
  starter: 100,
  growth: 350,
  proagent: 1000,
}

/** Human-delivered service request slots per plan (active orders tracked in Services). */
export const PLAN_SERVICE_REQUESTS: Record<PaidPlan, number | null> = {
  starter: 1,
  growth: 3,
  proagent: null, // unlimited
}

export const PLAN_MEDIA_EXAMPLES: Record<PaidPlan, string> = {
  starter: '≈33 images or 10 videos/mo',
  growth: '≈116 images or 35 videos/mo',
  proagent: '≈333 images or 100 videos/mo',
}

export function getServiceRequestLimit(plan: string | null | undefined): number | null {
  if (!isPaidPlan(plan)) return null
  return PLAN_SERVICE_REQUESTS[plan]
}

export function getMediaAllowanceExample(plan: string | null | undefined): string | null {
  if (!isPaidPlan(plan)) return null
  return PLAN_MEDIA_EXAMPLES[plan]
}

export function getPlanMediaCredits(plan: string | null | undefined): number | null {
  if (!isPaidPlan(plan)) return null
  return PLAN_MEDIA_CREDITS[plan]
}

export function isPaidPlan(plan: string | null | undefined): plan is PaidPlan {
  return !!plan && PAID_PLANS.includes(plan as PaidPlan)
}

/**
 * Account can use paid platform features: a paid plan in good billing standing,
 * or admin comp access. `status` is `profiles.status` — failed payments set it
 * to 'paused' and cancellation to 'churned' while `plan` stays populated, so
 * checking the plan alone lets delinquent accounts keep using paid features.
 */
export function hasPlatformAccess(
  plan: string | null | undefined,
  status?: string | null,
  billingExempt = false,
): boolean {
  if (!isPaidPlan(plan)) return false
  if (billingExempt) return true
  return status == null || status === 'active'
}

export function billingPlanLabel(
  plan: string | null | undefined,
  billingExempt = false,
): string {
  if (billingExempt && isPaidPlan(plan)) {
    return `Complimentary · ${PLAN_LABELS[plan]}`
  }
  if (isPaidPlan(plan)) return PLAN_LABELS[plan]
  return 'No plan'
}
