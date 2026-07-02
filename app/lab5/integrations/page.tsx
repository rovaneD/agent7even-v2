'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import { INTEGRATION_CATEGORIES } from '@/lib/marketing/integrationsContent'

export default function IntegrationsPage() {
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
          <span className="eyebrow">Integrations</span>
          <h1 className="t-display">Works with the tools you already use</h1>
          <p className="t-lead">
            Maya drafts campaigns and content in your voice — then connects to the channels and analytics you rely on today. No rip-and-replace required.
          </p>
        </div>
      </header>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          {INTEGRATION_CATEGORIES.map((category) => (
            <div key={category.title} className="integrations-block reveal">
              <div className="sec-head" style={{ marginBottom: 24 }}>
                <h2 className="t-h2">{category.title}</h2>
                <p className="t-lead">{category.intro}</p>
              </div>
              <ul className="integrations-list">
                {category.items.map((item) => (
                  <li key={item.name}>
                    <strong>{item.name}</strong>
                    <span>{item.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="cta-section">
        <div className="cta-in">
          <h2>Connect your stack after sign-up.</h2>
          <p className="cta-lead">Social accounts, Google Analytics, and your Brand Kit — all in Settings once you are inside the app.</p>
          <div className="cta-btns">
            <Link className="btn btn-white btn-lg" href="/sign-up">
              Start your free trial
            </Link>
            <Link className="btn btn-dark-ghost btn-lg" href="/pricing">
              See plans →
            </Link>
          </div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  )
}
