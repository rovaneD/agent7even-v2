'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { trackEvent } from '@/lib/gtag'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import BlogImage from '@/components/marketing/BlogImage'
import type { PostSummary } from '@/lib/blog'
import { formatPostDateShort } from '@/lib/marketing/renderBlogContent'

export default function BlogIndexClient({ posts }: { posts: PostSummary[] }) {
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

      <header className="idx-hero">
        <div className="wrap">
          <span className="eyebrow">Blog</span>
          <h1 className="t-display">AI for small business.<br />No hype, just results.</h1>
          <p className="t-lead">
            Practical guides on how small business owners use AI to save time, win more customers, and keep marketing consistent — without hiring an agency.
          </p>
        </div>
      </header>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          {posts.length === 0 ? (
            <p className="t-lead reveal">No posts yet — check back soon.</p>
          ) : (
            <div className="blog-grid reveal">
              {posts.map((post) => (
                <Link key={post.slug} href={`/blog/${post.slug}`} className="blog-card">
                  <BlogImage query={post.heroQuery} aspectRatio="card" />
                  <div className="blog-card-body">
                    <div className="blog-card-meta">
                      <span>{post.category}</span>
                      <span>{post.readTime}</span>
                    </div>
                    <h2>{post.title}</h2>
                    <p>{post.excerpt}</p>
                    <div className="blog-card-foot">
                      <span>{formatPostDateShort(post.date)}</span>
                      <span className="blog-card-read">Read →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="cta-section">
        <div className="cta-in">
          <h2>Stop reading. Start running.</h2>
          <p>Maya and twelve specialist agents draft campaigns you approve — from $49/mo with a 3-day Starter trial.</p>
          <div className="cta-btns">
            <Link
              className="btn btn-white btn-lg"
              href="/pricing"
              onClick={() => trackEvent('cta_click', { cta: 'start_trial', location: 'blog_index' })}
            >
              Start your free trial
            </Link>
            <Link className="btn btn-dark-ghost btn-lg" href="/how-it-works">
              How it works →
            </Link>
          </div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  )
}
