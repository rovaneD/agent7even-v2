import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/blog'
import { MARKETING_SITEMAP_PATHS, canonicalUrl } from '@/lib/marketing/seoMetadata'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  const staticPages = MARKETING_SITEMAP_PATHS.map(path => ({
    url: canonicalUrl(path),
    lastModified,
    changeFrequency: path === '/' ? ('weekly' as const) : ('monthly' as const),
    priority: path === '/' ? 1 : path === '/pricing' ? 0.9 : 0.7,
  }))

  const blogPages = getAllPosts().map(post => ({
    url: canonicalUrl(`/blog/${post.slug}`),
    lastModified: new Date(post.date),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  return [...staticPages, ...blogPages]
}
