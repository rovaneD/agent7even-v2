'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'

export default function AboutPage() {
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
          <span className="eyebrow">About</span>
          <h1 className="t-display">Marketing that gets done — without becoming your job.</h1>
          <p className="t-lead">
            Agent7even is an AI marketing operating system for small business. Maya coordinates twelve specialist agents so campaigns, content, and creative get drafted in your voice — queued for your approval before anything goes live.
          </p>
        </div>
      </header>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap company-stack">
          <div className="company-block reveal">
            <h2 className="t-h2">What we build</h2>
            <p className="t-body">
              Most small businesses do not lack ideas — they lack time and a marketing department. Agent7even gives solo operators and small teams campaign planning, social content, email sequences, SEO guidance, competitive reports, and on-brand creative — drafted in your voice and queued for your approval.
            </p>
            <p className="t-body">
              Maya is the interface. Twelve specialist agents are the substance. You stay in control through an approval-first workflow — nothing publishes until you sign off.
            </p>
          </div>
          <div className="company-block reveal">
            <h2 className="t-h2">Who it is for</h2>
            <p className="t-body">
              Local service businesses, e-commerce brands, coaches, consultants, creators, and early-stage teams — anyone who needs consistent marketing but cannot hire a full-time marketer yet.
            </p>
          </div>
          <div className="company-block reveal">
            <h2 className="t-h2">How we work</h2>
            <p className="t-body">
              We are a small product team building in public on{' '}
              <a href="https://www.agent7even.ai">agent7even.ai</a>. Starter plans include a 3-day trial so you can see Maya draft real work for your business before you pay.
            </p>
            <p className="t-body">
              Questions? Visit our <Link href="/contact">contact page</Link> or read the <Link href="/how-it-works">how-it-works overview</Link>.
            </p>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
