import { cases, type UseCase } from '@/app/lab-use-cases/_data'

/** Index / footer card order — single source of truth for use-case IA. */
export const USE_CASE_CARD_ORDER = [
  'local-service',
  'ecommerce',
  'coaches-creators',
  'startups',
] as const

export type UseCaseSlug = (typeof USE_CASE_CARD_ORDER)[number]

export function useCaseHref(slug: string): string {
  if (slug === 'coaches-creators') return '/for-coaches'
  return `/use-cases/${slug}`
}

export function orderedUseCases(): UseCase[] {
  return USE_CASE_CARD_ORDER.map((slug) => cases.find((c) => c.slug === slug)).filter(
    (c): c is UseCase => Boolean(c),
  )
}

/** Nav dropdown + footer descriptors (from homepage use-case cards). */
export const USE_CASE_NAV_DESCRIPTORS: Record<UseCaseSlug, string> = {
  'local-service':
    'Weekly content drafted from your Foundation — approve, then publish.',
  ecommerce:
    'Campaign and post drafts between launches — you approve before anything ships.',
  'coaches-creators':
    'One Foundation feeds posts, emails, and creative — you approve what ships.',
  startups: 'Foundation and Brand Kit drafts before your first marketing hire.',
}

/** Compact labels for the nav dropdown (footer/index keep full `label`). */
export const USE_CASE_NAV_SHORT_LABELS: Record<UseCaseSlug, string> = {
  'local-service': 'Local service',
  ecommerce: 'E-commerce',
  'coaches-creators': 'Coaches & creators',
  startups: 'Startups',
}

export const USE_CASE_NAV_ITEMS = orderedUseCases().map((uc) => ({
  slug: uc.slug as UseCaseSlug,
  label: uc.label,
  shortLabel: USE_CASE_NAV_SHORT_LABELS[uc.slug as UseCaseSlug],
  href: useCaseHref(uc.slug),
  descriptor: USE_CASE_NAV_DESCRIPTORS[uc.slug as UseCaseSlug],
}))
