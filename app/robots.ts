import type { MetadataRoute } from 'next'
import { CANONICAL_SITE_URL } from '@/lib/siteUrls'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard/',
        '/admin/',
        '/api/',
        '/maya/',
        '/foundation',
        '/sign-in',
        '/sign-up',
        // Experimental / duplicate-content routes — never index.
        '/lab',
        '/lab1',
        '/lab2',
        '/lab3',
        '/lab5',
        '/lab-agents',
        '/lab-analytics',
        '/lab-sidebar',
        '/lab-use-cases',
        '/design-concept',
        '/checkout-now',
      ],
    },
    sitemap: `${CANONICAL_SITE_URL}/sitemap.xml`,
  }
}
