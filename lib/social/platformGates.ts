import {
  X_CONNECT_MEASUREMENT_DAYS,
  X_CONNECT_MEASUREMENT_START,
  measurementDaysRemaining,
  measurementWindowEnd,
} from '@/lib/social/xConnectMeasurement'

/** Platforms gated above Starter while we measure Zernio/X pass-through cost. */
export const X_CONNECT_PLATFORM = 'x'

export {
  X_CONNECT_MEASUREMENT_DAYS,
  X_CONNECT_MEASUREMENT_START,
  measurementDaysRemaining,
  measurementWindowEnd,
}

export function isGrowthPlusPlan(plan: string | null | undefined): boolean {
  const normalized = (plan ?? '').trim().toLowerCase()
  return normalized === 'growth' || normalized === 'proagent'
}

export function platformRequiresGrowthPlus(platform: string): boolean {
  return platform.trim().toLowerCase() === X_CONNECT_PLATFORM
}

export function canConnectSocialPlatform(
  plan: string | null | undefined,
  platform: string,
): boolean {
  if (!platformRequiresGrowthPlus(platform)) return true
  return isGrowthPlusPlan(plan)
}

export const X_CONNECT_GROWTH_GATE_MESSAGE =
  'X / Twitter is available on Growth and ProAgent plans while we measure platform usage.'
