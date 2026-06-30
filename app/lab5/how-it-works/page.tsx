'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { trackEvent } from '@/lib/gtag'
import MarketingNav from '../MarketingNav'
import {
  HOW_IT_WORKS_STEPS,
  HOW_IT_WORKS_WORKFLOW,
} from '@/lib/marketing/howItWorksContent'

export default function HowItWorksPage() {
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
          <span className="eyebrow">How it works</span>
          <h1 className="t-display">How AI marketing automation works</h1>
          <p className="t-lead">
            One conversation with Maya. Campaigns, content, and creative drafted in your voice — queued for your approval before anything goes live.
          </p>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Three steps</span>
            <h2 className="t-h2">From idea to approval queue.</h2>
            <p className="t-lead">
              No agency briefs. No tool-hopping. Tell Maya what you need and specialist agents draft the work — you stay in control.
            </p>
          </div>
          <div className="steps">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <div key={step.n} className="step reveal">
                <div className="step-n">{step.n}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="compare-section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">The workflow</span>
            <h2 className="t-h2">What happens behind the conversation.</h2>
            <p className="t-lead">
              Agent7even is an AI marketing operating system — not a scheduler that posts what you already wrote.
            </p>
          </div>
          <div className="workflow-grid reveal">
            {HOW_IT_WORKS_WORKFLOW.map((item) => (
              <div key={item.title} className="workflow-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="cta-section">
        <div className="cta-in">
          <h2>See it on your business.</h2>
          <p>Maya learns your Foundation once — then drafts campaigns you approve, not reports you pay an agency to write.</p>
          <div className="cta-btns">
            <Link
              className="btn btn-white btn-lg"
              href="/pricing"
              onClick={() => trackEvent('cta_click', { cta: 'start_trial', location: 'how_it_works' })}
            >
              Start your free trial
            </Link>
            <Link className="btn btn-dark-ghost btn-lg" href="/agents">
              Meet the agents →
            </Link>
          </div>
          <p className="cta-note">3-day free trial on Starter. No charge until day 4.</p>
        </div>
      </div>
    </div>
  )
}
