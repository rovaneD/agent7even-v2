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
  '/how-it-works',
  '/pricing',
  '/agents',
  '/use-cases',
  '/use-cases/local-service',
  '/use-cases/ecommerce',
  '/use-cases/coaches-creators',
  '/use-cases/startups',
  '/for-coaches',
  '/for-consultants',
  '/privacy',
  '/terms',
  '/security',
  '/data-deletion',
] as const

/** Human-readable site map for SEO Scanner — only list URLs that actually exist. */
export function marketingSiteStructureForSeo(): string {
  const pages = [
    '/ — homepage (includes AI vs traditional comparison + how-it-works section at /#how)',
    '/how-it-works — dedicated page for AI marketing automation workflow',
    '/agents — AI marketing agents & platform capabilities (use instead of /features)',
    '/pricing — plans from $49/mo Starter with 3-day trial',
    '/use-cases — industry landing pages (local service, ecommerce, creators, startups)',
    '/for-coaches — AI marketing for coaches (coaches-creators positioning)',
    '/for-consultants — AI marketing for consultants (solo expert positioning)',
    '/privacy, /terms, /security, /data-deletion — legal',
  ]
  return pages.map(p => `- ${p}`).join('\n')
}
