import type { Metadata } from 'next'
import '../lab5/styles.css'
import { getAllPosts } from '@/lib/blog'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'
import BlogIndexClient from '../lab5/blog/BlogIndexClient'

export const metadata: Metadata = marketingPageMetadata({
  title: 'Blog — AI Marketing Guides for Small Business | Agent7even',
  description:
    'Practical AI marketing guides for small business owners — email, SEO, social media, brand, and automation without agency retainers.',
  path: '/blog',
})

export default function BlogPage() {
  return <BlogIndexClient posts={getAllPosts()} />
}
