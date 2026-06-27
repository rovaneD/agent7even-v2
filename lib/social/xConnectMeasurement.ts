/** When instrumentation shipped — start of the 30-day X measurement window. */
export const X_CONNECT_MEASUREMENT_START = '2026-06-10T00:00:00.000Z'
export const X_CONNECT_MEASUREMENT_DAYS = 30

export function measurementWindowEnd(startIso: string = X_CONNECT_MEASUREMENT_START): Date {
  const start = new Date(startIso)
  return new Date(start.getTime() + X_CONNECT_MEASUREMENT_DAYS * 24 * 60 * 60 * 1000)
}

export function measurementDaysRemaining(startIso: string = X_CONNECT_MEASUREMENT_START): number {
  const end = measurementWindowEnd(startIso)
  const diff = end.getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)))
}
