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

export function isPaidPlan(plan: string | null | undefined): plan is PaidPlan {
  return !!plan && PAID_PLANS.includes(plan as PaidPlan)
}

/** Account can use paid platform features (paid subscription or admin comp access). */
export function hasPlatformAccess(
  plan: string | null | undefined,
  billingExempt = false,
): boolean {
  if (billingExempt && isPaidPlan(plan)) return true
  return isPaidPlan(plan)
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
