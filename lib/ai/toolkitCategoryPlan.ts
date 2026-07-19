// Minimum plan per AI Toolkit prompt category — single source of truth for the
// client (lock badges) and the run-prompt API (server-side enforcement).

export type ToolkitPlan = 'starter' | 'growth' | 'proagent'

export const CATEGORY_MIN_PLAN: Record<string, ToolkitPlan> = {
  social:     'starter',
  email:      'starter',
  ads:        'growth',
  seo:        'growth',
  operations: 'growth',
  brand:      'proagent',
  general:    'starter',
}

const PLAN_ORDER: ToolkitPlan[] = ['starter', 'growth', 'proagent']

export function meetsPlanRequirement(userPlan: string | null, required: ToolkitPlan): boolean {
  if (!userPlan) return false
  return PLAN_ORDER.indexOf(userPlan as ToolkitPlan) >= PLAN_ORDER.indexOf(required)
}
