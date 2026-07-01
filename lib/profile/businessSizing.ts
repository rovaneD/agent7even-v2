/** Shared team-size and revenue bucket options for onboarding + settings. */

export const EMPLOYEE_COUNT_BUCKETS = [
  { id: '1-10', label: '1–10 employees' },
  { id: '11-20', label: '11–20 employees' },
  { id: '21-50', label: '21–50 employees' },
  { id: '51-100', label: '51–100 employees' },
  { id: '101-250', label: '101–250 employees' },
  { id: '251+', label: '251+ employees' },
] as const

export const ANNUAL_REVENUE_BUCKETS = [
  { id: 'under-100k', label: 'Under $100K' },
  { id: '100k-500k', label: '$100K–$500K' },
  { id: '500k-1m', label: '$500K–$1M' },
  { id: '1m-5m', label: '$1M–$5M' },
  { id: '5m-10m', label: '$5M–$10M' },
  { id: '10m+', label: '$10M+' },
] as const

export type EmployeeCountBucket = (typeof EMPLOYEE_COUNT_BUCKETS)[number]['id']
export type AnnualRevenueBucket = (typeof ANNUAL_REVENUE_BUCKETS)[number]['id']

const EMPLOYEE_LABELS = Object.fromEntries(
  EMPLOYEE_COUNT_BUCKETS.map(b => [b.id, b.label]),
) as Record<EmployeeCountBucket, string>

const REVENUE_LABELS = Object.fromEntries(
  ANNUAL_REVENUE_BUCKETS.map(b => [b.id, b.label]),
) as Record<AnnualRevenueBucket, string>

export function labelEmployeeCountBucket(id: string | null | undefined): string {
  if (!id) return '—'
  return EMPLOYEE_LABELS[id as EmployeeCountBucket] ?? id
}

export function labelAnnualRevenueBucket(id: string | null | undefined): string {
  if (!id) return '—'
  return REVENUE_LABELS[id as AnnualRevenueBucket] ?? id
}
