/** Included team seats per paid plan (owner counts as one seat). */
export const PLAN_SEAT_LIMITS: Record<string, number> = {
  starter: 1,
  growth: 3,
  proagent: 5,
}

export function includedSeatsForPlan(plan: string | null | undefined): number {
  return PLAN_SEAT_LIMITS[plan ?? ''] ?? 1
}

/** Extra billable seats required beyond the plan's included seats. */
export function extraSeatsRequired(
  plan: string | null | undefined,
  nonRemovedMemberCount: number,
): number {
  const usedSeats = nonRemovedMemberCount + 1 // +1 for account owner
  return Math.max(0, usedSeats - includedSeatsForPlan(plan))
}
