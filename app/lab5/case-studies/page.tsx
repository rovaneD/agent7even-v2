'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { trackEvent } from '@/lib/gtag'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'

const PLANNED_TOPICS = [
  'Local service — filling slow weeks with promos drafted in the owner\'s voice',
  'E-commerce — keeping the brand visible between product drops',
  'Coaches — consistent content without trading client hours for caption writing',
]

export default function CaseStudiesPage() {
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
          <span className="eyebrow">Customer stories</span>
          <h1 className="t-display">Real results — published with permission.</h1>
          <p className="t-lead">
            We are collecting customer stories with before/after metrics from businesses using Maya. No fabricated ROI — only stories we can stand behind.
          </p>
        </div>
      </header>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap company-stack">
          <div className="company-block reveal">
            <h2 className="t-h2">Coming soon</h2>
            <p className="t-body">
              Case studies with verified numbers are in progress. Until they publish, explore{' '}
              <Link href="/how-it-works">How it works</Link>, browse{' '}
              <Link href="/use-cases">use cases</Link>, or read practical guides on the{' '}
              <Link href="/blog">blog</Link>.
            </p>
          </div>
          <div className="company-block reveal">
            <h2 className="t-h2">Stories we are building</h2>
            <ul className="company-list">
              {PLANNED_TOPICS.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          </div>
          <div className="company-block reveal">
            <h2 className="t-h2">Share your story</h2>
            <p className="t-body">
              On Agent7even and willing to be featured? Email{' '}
              <a href="mailto:support@agent7even.ai?subject=Case%20study%20interest">support@agent7even.ai</a> with
              your business type and what changed after using Maya — we will follow up if it is a fit.
            </p>
          </div>
        </div>
      </section>

      <div className="cta-section">
        <div className="cta-in">
          <h2>See it on your business first.</h2>
          <p className="cta-lead">3-day Starter trial — draft real campaigns before any case study goes live.</p>
          <div className="cta-btns">
            <Link
              className="btn btn-white btn-lg"
              href="/pricing"
              onClick={() => trackEvent('cta_click', { cta: 'start_trial', location: 'case_studies' })}
            >
              Start your free trial
            </Link>
            <Link className="btn btn-dark-ghost btn-lg" href="/use-cases">
              Browse use cases →
            </Link>
          </div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  )
}
