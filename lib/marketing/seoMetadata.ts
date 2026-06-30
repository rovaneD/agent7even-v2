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
  '/ai-vs-agency',
  '/integrations',
  '/pricing',
  '/agents',
  '/use-cases',
  '/use-cases/local-service',
  '/use-cases/ecommerce',
  '/use-cases/coaches-creators',
  '/use-cases/startups',
  '/for-coaches',
  '/for-consultants',
  '/blog',
  '/about',
  '/careers',
  '/contact',
  '/privacy',
  '/terms',
  '/security',
  '/data-deletion',
] as const

/** Human-readable site map for SEO Scanner — only list URLs that actually exist. */
export function marketingSiteStructureForSeo(): string {
  const pages = [
    '/ — homepage (includes AI vs agency comparison at /#compare; eyebrow targets small business)',
    '/how-it-works — dedicated page for AI marketing automation workflow',
    '/ai-vs-agency — AI marketing vs traditional agency (cost, speed, approval control)',
    '/integrations — social, GA4, and email stack connections',
    '/agents — AI marketing features & agents (/features redirects here intentionally)',
    '/pricing — plans from $49/mo Starter with 3-day trial',
    '/use-cases — industry landing pages (local service, ecommerce, creators, startups)',
    '/for-coaches — AI marketing for coaches (coaches-creators positioning)',
    '/for-consultants — AI marketing for consultants (solo expert positioning)',
    '/blog — AI marketing guides for small business (9 posts)',
    '/about — company and product mission',
    '/careers — team and hiring',
    '/contact — support and billing contact',
    '/privacy, /terms, /security, /data-deletion — legal',
  ]
  return pages.map(p => `- ${p}`).join('\n')
}
