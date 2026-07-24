export const ONBOARDING_BUSINESS_TYPES = [
  {
    id: 'services',
    label: 'Services',
    description: 'Consultant, agencies, freelancer',
  },
  {
    id: 'local',
    label: 'Local business',
    description: 'Restaurants, stores, salons',
  },
  {
    id: 'products',
    label: 'Products',
    description: 'E-commerce, manufacturers',
  },
] as const

export type OnboardingBusinessTypeId = (typeof ONBOARDING_BUSINESS_TYPES)[number]['id']

export function normalizeBusinessType(value: unknown): OnboardingBusinessTypeId | null {
  if (value === 'services' || value === 'local' || value === 'products') return value
  return null
}
