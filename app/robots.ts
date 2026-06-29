import type { MetadataRoute } from 'next'
import { CANONICAL_SITE_URL } from '@/lib/siteUrls'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/admin/', '/api/', '/maya/', '/foundation/'],
    },
    sitemap: `${CANONICAL_SITE_URL}/sitemap.xml`,
  }
}
