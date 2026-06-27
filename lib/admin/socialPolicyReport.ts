import { createServiceClient } from '@/lib/supabase/server'
import {
  X_CONNECT_GROWTH_GATE_MESSAGE,
  X_CONNECT_MEASUREMENT_DAYS,
  X_CONNECT_MEASUREMENT_START,
  isGrowthPlusPlan,
  measurementDaysRemaining,
  measurementWindowEnd,
} from '@/lib/social/platformGates'

export type SocialPolicyTenantRow = {
  userId: string
  companyName: string | null
  plan: string | null
  xCallCount: number
  xEstimatedCostUsd: number
}

export type SocialPolicyReport = {
  checkedAt: string
  policy: {
    xConnectGate: 'growth_plus'
    message: string
    measurementStart: string
    measurementEnd: string
    measurementDaysRemaining: number
    measurementDaysTotal: number
  }
  connected: {
    starter: number
    growth: number
    proagent: number
    other: number
    total: number
  }
  blockedAttempts30d: number
  usage: {
    tableReady: boolean
    xCalls30d: number
    xCost30d: number
    xActiveTenants30d: number
    totalCalls30d: number
    topTenants: SocialPolicyTenantRow[]
  }
  decisionCriteria: {
    medianGrowthCostTargetUsd: number
    p95CostReviewUsd: number
    starterOpenThresholdUsd: number
  }
}

const THIRTY_DAYS_AGO = () =>
  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

function planBucket(plan: string | null): 'starter' | 'growth' | 'proagent' | 'other' {
  const p = (plan ?? '').trim().toLowerCase()
  if (p === 'starter') return 'starter'
  if (p === 'growth') return 'growth'
  if (p === 'proagent') return 'proagent'
  return 'other'
}

function hasXConnected(platforms: unknown): boolean {
  if (!Array.isArray(platforms)) return false
  return platforms.some(p => String(p).trim().toLowerCase() === 'x')
}

export async function getSocialPolicyReport(): Promise<SocialPolicyReport> {
  const supabase = createServiceClient()
  const since30d = THIRTY_DAYS_AGO()

  const [
    { data: profiles, error: profilesErr },
    { count: blockedCount, error: blockedErr },
    { data: usageSummary, error: usageSummaryErr },
    { data: tenantUsage, error: tenantUsageErr },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, company_name, plan, zernio_connected_platforms')
      .eq('role', 'client'),
    supabase
      .from('client_activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'x_connect_blocked')
      .gte('created_at', since30d),
    supabase.from('v_admin_x_usage_summary').select('*').maybeSingle(),
    supabase
      .from('v_x_usage_30d')
      .select('*')
      .order('x_estimated_cost_usd', { ascending: false })
      .limit(10),
  ])

  if (profilesErr) console.error('[socialPolicy] profiles error:', profilesErr.message)
  if (blockedErr) console.error('[socialPolicy] blocked count error:', blockedErr.message)
  if (usageSummaryErr) console.error('[socialPolicy] usage summary error:', usageSummaryErr.message)
  if (tenantUsageErr) console.error('[socialPolicy] tenant usage error:', tenantUsageErr.message)

  const connected = { starter: 0, growth: 0, proagent: 0, other: 0, total: 0 }
  for (const row of profiles ?? []) {
    if (!hasXConnected(row.zernio_connected_platforms)) continue
    connected.total += 1
    connected[planBucket(row.plan as string | null)] += 1
  }

  const tableReady = !usageSummaryErr && !tenantUsageErr
  const summary = usageSummary as Record<string, number | string | null> | null

  const topTenants: SocialPolicyTenantRow[] = tableReady
    ? (tenantUsage ?? []).map(row => {
        const r = row as Record<string, unknown>
        return {
          userId: String(r.user_id ?? ''),
          companyName: (r.company_name as string | null) ?? null,
          plan: (r.plan as string | null) ?? null,
          xCallCount: Number(r.x_call_count ?? 0),
          xEstimatedCostUsd: Number(r.x_estimated_cost_usd ?? 0),
        }
      })
    : []

  return {
    checkedAt: new Date().toISOString(),
    policy: {
      xConnectGate: 'growth_plus',
      message: X_CONNECT_GROWTH_GATE_MESSAGE,
      measurementStart: X_CONNECT_MEASUREMENT_START,
      measurementEnd: measurementWindowEnd().toISOString(),
      measurementDaysRemaining: measurementDaysRemaining(),
      measurementDaysTotal: X_CONNECT_MEASUREMENT_DAYS,
    },
    connected,
    blockedAttempts30d: blockedCount ?? 0,
    usage: {
      tableReady,
      xCalls30d: Number(summary?.x_calls_30d ?? 0),
      xCost30d: Number(summary?.x_cost_30d ?? 0),
      xActiveTenants30d: Number(summary?.x_active_tenants_30d ?? 0),
      totalCalls30d: Number(summary?.total_calls_30d ?? 0),
      topTenants,
    },
    decisionCriteria: {
      medianGrowthCostTargetUsd: 2,
      p95CostReviewUsd: 15,
      starterOpenThresholdUsd: 1,
    },
  }
}

/** For admin list of grandfathered Starter tenants with X connected. */
export function isGrandfatheredStarterX(plan: string | null, platforms: unknown): boolean {
  return planBucket(plan) === 'starter' && hasXConnected(platforms) && !isGrowthPlusPlan(plan)
}
