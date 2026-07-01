/** Deep-clone foundation_answers for snapshot storage. */
export function cloneFoundationAnswers(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return {}
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

/** Capture current identity into the single previous slot (call before every foundation_answers write). */
export function snapshotCaptureFields(currentAnswers: unknown): {
  foundation_answers_previous: Record<string, unknown>
  foundation_answers_previous_at: string
} {
  return {
    foundation_answers_previous: cloneFoundationAnswers(currentAnswers),
    foundation_answers_previous_at: new Date().toISOString(),
  }
}

/** Merge snapshot capture + identity patch for profiles.update — NOT for restore (use swap directly). */
export function buildIdentityUpdateWithSnapshot(
  currentAnswers: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...snapshotCaptureFields(currentAnswers),
    ...patch,
  }
}

/** Mirror legacy profile columns from foundation_answers (backward compat). */
export function legacyColumnsFromAnswers(answers: Record<string, unknown>): Record<string, unknown> {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(answers, key)
  return {
    ...(has('customerWho') ? { ideal_customer: (answers.customerWho as string) || null } : {}),
    ...(has('customerFrustration') ? { marketing_challenge: (answers.customerFrustration as string) || null } : {}),
    ...(has('competitors') ? { competitors: (answers.competitors as string[])?.filter(Boolean) ?? [] } : {}),
    ...(has('toneTraits') && Array.isArray(answers.toneTraits)
      ? { content_comfort: (answers.toneTraits as string[]).join(', ') }
      : {}),
    ...(has('marketingBudget') ? { marketing_budget: (answers.marketingBudget as string) || null } : {}),
    ...(has('channels') ? { sell_locations: (answers.channels as string[]) ?? [] } : {}),
    ...(has('monthlyGoal') ? { top_goals: answers.monthlyGoal ? [(answers.monthlyGoal as string)] : [] } : {}),
    ...(has('employeeCountBucket') ? { employee_count_bucket: (answers.employeeCountBucket as string) || null } : {}),
    ...(has('annualRevenueBucket') ? { annual_revenue_bucket: (answers.annualRevenueBucket as string) || null } : {}),
  }
}

export type FoundationAnswersSnapshotRow = {
  foundation_answers: unknown
  foundation_answers_previous: unknown
  foundation_answers_previous_at: string | null
  foundation_updated_at: string | null
}

/** Reversible swap: current ↔ previous (+ paired timestamps). Does NOT run capture. */
export function buildIdentityRestoreSwap(row: FoundationAnswersSnapshotRow): Record<string, unknown> | null {
  if (row.foundation_answers_previous == null) return null

  const now = new Date().toISOString()
  const currentUpdatedAt = row.foundation_updated_at ?? now
  const previousAt = row.foundation_answers_previous_at ?? now

  return {
    foundation_answers: row.foundation_answers_previous,
    foundation_answers_previous: cloneFoundationAnswers(row.foundation_answers),
    foundation_answers_previous_at: currentUpdatedAt,
    foundation_updated_at: previousAt,
    updated_at: now,
    ...legacyColumnsFromAnswers(cloneFoundationAnswers(row.foundation_answers_previous)),
  }
}
