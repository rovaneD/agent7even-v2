'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { trackEvent } from '@/lib/gtag'
import Metaballs from '../SafeMetaballs'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import VsSchedulingCompareSection from '@/components/marketing/VsSchedulingCompareSection'
import { VS_SCHEDULING_WORKFLOW } from '@/lib/marketing/vsSchedulingToolsContent'

export default function VsSchedulingToolsPage() {
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

      <header className="phero">
        <div className="wrap">
          <span className="eyebrow">Compare</span>
          <h1 className="t-display">
            Scheduling tools post what you wrote.
            <br />
            Agent7even drafts it first.
          </h1>
          <p className="t-lead">
            Buffer and Hootsuite are built for timing — not strategy, Brand Kit, or campaign planning. Maya plans and drafts in your voice, routes everything to one approval queue, and lets you schedule when you sign&nbsp;off.
          </p>
        </div>
      </header>

      <VsSchedulingCompareSection />

      <section className="workflow-section">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Why owners switch</span>
            <h2 className="t-h2">Strategy layer, not just a calendar.</h2>
            <p className="t-lead">
              You should not have to write every caption, plan every campaign, and babysit a publish queue in three different tools.
            </p>
          </div>
          <div className="workflow-grid reveal">
            {VS_SCHEDULING_WORKFLOW.map((item) => (
              <div key={item.title} className="workflow-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="cta-section">
        <div className="cta-orb">
          <Metaballs
            speed={1}
            count={9}
            size={0.26}
            scale={1}
            colors={['#F5349B', '#EE533B', '#FCA509', '#10B981', '#3286FE']}
            colorBack="#0E0E11"
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
        <div className="cta-in reveal">
          <span className="eyebrow">Approval-first</span>
          <h2>Draft first. Schedule when you approve.</h2>
          <p className="cta-lead">
            Maya plans and drafts in your Brand Kit voice — nothing publishes until you sign off. Then queue it in a click.
          </p>
          <div className="cta-btns">
            <Link
              className="btn btn-white btn-lg"
              href="/pricing"
              onClick={() => trackEvent('cta_click', { cta: 'start_trial', location: 'vs_scheduling' })}
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

      <MarketingFooter />
    </div>
  )
}
