export type ClientHealth = 'healthy' | 'drifting' | 'at_risk'

export interface ClientHealthInput {
  plan: string | null
  status: string | null
  last_active_at: string | null
  engagement_score: number | null
  engagement_updated_at?: string | null
  created_at: string
}

/** Engagement score is only meaningful after the cron has calculated it. */
export function engagementScoreKnown(input: ClientHealthInput): boolean {
  return input.engagement_updated_at != null && input.engagement_score != null
}

/**
 * Activity recency drives health status. Engagement score is a secondary signal
 * for accounts inactive 48h+ — never downgrade someone active in the last 24h.
 */
export function clientHealthStatus(input: ClientHealthInput): ClientHealth {
  if (input.status === 'paused' || input.status === 'churned' || input.status === 'suspended') {
    return 'at_risk'
  }

  if (!input.plan || input.status === 'onboarding') {
    return 'drifting'
  }

  const now = Date.now()
  const lastActiveMs = input.last_active_at ? new Date(input.last_active_at).getTime() : null
  const hoursInactive = lastActiveMs != null ? (now - lastActiveMs) / (1000 * 60 * 60) : null
  const score = engagementScoreKnown(input) ? input.engagement_score : null

  if (hoursInactive != null && hoursInactive <= 24) {
    return 'healthy'
  }

  if (hoursInactive != null && hoursInactive <= 48) {
    if (score != null && score >= 50) return 'healthy'
    return 'drifting'
  }

  if (hoursInactive == null) {
    const daysSinceJoin = (now - new Date(input.created_at).getTime()) / (1000 * 60 * 60 * 24)
    return daysSinceJoin > 7 ? 'at_risk' : 'drifting'
  }

  if (score != null && score >= 50) return 'drifting'
  return 'at_risk'
}

export const CLIENT_HEALTH_LABELS: Record<ClientHealth, string> = {
  healthy:  'Healthy',
  drifting: 'Drifting',
  at_risk:  'At risk',
}

export const CLIENT_HEALTH_DOT: Record<ClientHealth, string> = {
  healthy:  'bg-green-400',
  drifting: 'bg-yellow-400',
  at_risk:  'bg-red-400',
}
