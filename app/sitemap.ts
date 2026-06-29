import type { MetadataRoute } from 'next'
import { MARKETING_SITEMAP_PATHS, canonicalUrl } from '@/lib/marketing/seoMetadata'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return MARKETING_SITEMAP_PATHS.map(path => ({
    url: canonicalUrl(path),
    lastModified,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path === '/pricing' ? 0.9 : 0.7,
  }))
}
