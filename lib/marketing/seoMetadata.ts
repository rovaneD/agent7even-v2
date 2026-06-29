import type { Metadata } from 'next'
import { CANONICAL_SITE_URL } from '@/lib/siteUrls'

export function canonicalUrl(path: string): string {
  if (!path || path === '/') return CANONICAL_SITE_URL
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${CANONICAL_SITE_URL}${normalized}`
}

export function marketingPageMetadata(input: {
  title: string
  description: string
  path: string
}): Metadata {
  const url = canonicalUrl(input.path)
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: 'Agent7even',
      type: 'website',
    },
  }
}

/** Public marketing routes included in sitemap.xml */
export const MARKETING_SITEMAP_PATHS = [
  '/',
  '/pricing',
  '/agents',
  '/use-cases',
  '/use-cases/local-service',
  '/use-cases/ecommerce',
  '/use-cases/coaches-creators',
  '/use-cases/startups',
  '/privacy',
  '/terms',
  '/security',
  '/data-deletion',
] as const
