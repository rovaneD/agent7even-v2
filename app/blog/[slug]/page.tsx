import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import '../../lab5/styles.css'
import { getAllPosts, getPostBySlug } from '@/lib/blog'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'
import BlogPostClient from '../../lab5/blog/BlogPostClient'

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}
  return marketingPageMetadata({
    title: `${post.title} | Agent7even`,
    description: post.excerpt,
    path: `/blog/${slug}`,
  })
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  const related = getAllPosts().filter((p) => p.slug !== slug).slice(0, 2)
  return <BlogPostClient post={post} related={related} />
}
