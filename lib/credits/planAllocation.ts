/**
 * Plan allocation that preserves purchased top-up surplus.
 *
 * Product SSOT (`credit_topup_handoff.md`, Billing UI): monthly plan credits
 * refill, but top-up credits never expire. Spend is treated as plan-first
 * (same model as `/dashboard/billing`).
 */

export type AllocationActivity = {
  previousAllocationCredits: number | null
  topupsSinceAllocation: number
  netUsageSinceAllocation: number
}

/**
 * Compute the post-allocation balance for a plan pool refill.
 *
 * - No prior allocation → grant the plan pool alone.
 * - Otherwise carry unused top-ups: planCredits + max(0, topups - topupUsed),
 *   where topupUsed = max(0, netUsage - previousAllocationCredits).
 */
export function nextAllocationBalance(
  planCredits: number,
  activity: AllocationActivity,
): number {
  if (!Number.isFinite(planCredits) || planCredits < 0) return 0

  const {
    previousAllocationCredits,
    topupsSinceAllocation,
    netUsageSinceAllocation,
  } = activity

  if (previousAllocationCredits == null) {
    return planCredits
  }

  const prev = Math.max(0, previousAllocationCredits)
  const topups = Math.max(0, topupsSinceAllocation)
  const netUsage = Math.max(0, netUsageSinceAllocation)
  const topupUsed = Math.max(0, netUsage - prev)
  const topupRemaining = Math.max(0, topups - topupUsed)
  return planCredits + topupRemaining
}

/** UTC calendar-month start for monthly allocation idempotency. */
export function utcMonthStartIso(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}
