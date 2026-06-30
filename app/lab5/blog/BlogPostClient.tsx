'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { trackEvent } from '@/lib/gtag'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import BlogImage from '@/components/marketing/BlogImage'
import type { PostSummary } from '@/lib/blog'
import type { BlogPostView } from '@/lib/marketing/renderBlogContent'
import { formatPostDate, formatPostDateShort, renderBlogContent } from '@/lib/marketing/renderBlogContent'

export default function BlogPostClient({
  post,
  related,
}: {
  post: BlogPostView
  related: PostSummary[]
}) {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    document.querySelectorAll('.lab5 .reveal').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div className="lab5">
      <MarketingNav />

      <article className="blog-article wrap reveal">
        <div className="crumb">
          <Link href="/blog">← Blog</Link>
        </div>

        <header className="blog-post-head">
          <div className="blog-card-meta">
            <span>{post.category}</span>
            <span>{post.readTime}</span>
            <span>{formatPostDate(post.date)}</span>
          </div>
          <h1 className="t-display blog-post-title">{post.title}</h1>
          <p className="blog-post-excerpt">{post.excerpt}</p>
        </header>

        {post.heroQuery && (
          <BlogImage query={post.heroQuery} aspectRatio="hero" className="blog-hero-img" />
        )}

        <div className="blog-content">{renderBlogContent(post.content, post.inlineQueries)}</div>

        <div className="blog-post-cta">
          <span className="eyebrow">Related capability</span>
          <h2 className="t-h3">{post.service}</h2>
          <p className="t-body">
            Available inside Agent7even — Maya coordinates specialist agents so you draft, approve, and publish from one place.
          </p>
          <Link
            className="btn btn-primary"
            href="/pricing"
            onClick={() => trackEvent('cta_click', { cta: 'start_trial', location: 'blog_post' })}
          >
            Start your free trial →
          </Link>
        </div>

        {related.length > 0 && (
          <section className="blog-related">
            <span className="eyebrow">Keep reading</span>
            <div className="blog-related-grid">
              {related.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} className="blog-related-card">
                  <span>{p.category}</span>
                  <strong>{p.title}</strong>
                  <em>{formatPostDateShort(p.date)}</em>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>

      <MarketingFooter />
    </div>
  )
}
