'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import { SUPPORT_EMAIL } from '@/lib/siteUrls'

export default function CareersPage() {
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
          <span className="eyebrow">Careers</span>
          <h1 className="t-display">Small team. Big problem to solve.</h1>
          <p className="t-lead">
            We are building the marketing operating system small businesses deserve — approval-first AI that respects how owners actually work.
          </p>
        </div>
      </header>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap company-stack">
          <div className="company-block reveal">
            <h2 className="t-h2">Open roles</h2>
            <p className="t-body">
              We do not have public openings right now. When we hire, we look for people who care about craft, clarity, and shipping useful product for real small businesses — not hype decks.
            </p>
          </div>
          <div className="company-block reveal">
            <h2 className="t-h2">Stay in touch</h2>
            <p className="t-body">
              If you think you would be a strong fit down the road, send a short note and your background to{' '}
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Careers%20interest`}>{SUPPORT_EMAIL}</a>. We read everything — we just cannot reply to every general inquiry.
            </p>
            <p className="t-body">
              For product help or account questions, use our <Link href="/contact">contact page</Link> instead.
            </p>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
