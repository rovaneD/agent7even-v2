'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { trackEvent } from '@/lib/gtag'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import {
  AI_VS_AGENCY_COMPARE,
  AI_VS_AGENCY_COST_ROWS,
} from '@/lib/marketing/aiVsAgencyContent'

export default function AiVsAgencyPage() {
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
          <span className="eyebrow">AI marketing vs agency</span>
          <h1 className="t-display">AI marketing vs traditional marketing agency</h1>
          <p className="t-lead">
            Agencies sell retainers and reports. Agent7even gives you an AI marketing strategist plus twelve specialist agents — campaigns drafted in your voice, queued for your approval before anything goes live.
          </p>
        </div>
      </header>

      <section className="compare-section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="compare-grid reveal">
            <div className="compare-col compare-traditional">
              <h3>{AI_VS_AGENCY_COMPARE.traditional.title}</h3>
              <ul>
                {AI_VS_AGENCY_COMPARE.traditional.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="compare-col compare-agent7even">
              <h3>{AI_VS_AGENCY_COMPARE.agent7even.title}</h3>
              <ul>
                {AI_VS_AGENCY_COMPARE.agent7even.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">Cost & speed</span>
            <h2 className="t-h2">What you actually pay for.</h2>
            <p className="t-lead">
              Small businesses need consistent marketing output — not another strategy deck. Here is how the math and timeline usually compare.
            </p>
          </div>
          <div className="compare-table-wrap reveal">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col"></th>
                  <th scope="col">Traditional agency</th>
                  <th scope="col">Agent7even</th>
                </tr>
              </thead>
              <tbody>
                {AI_VS_AGENCY_COST_ROWS.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>{row.agency}</td>
                    <td>{row.agent7even}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="cta-section">
        <div className="cta-in">
          <h2>Try Maya before you sign another retainer.</h2>
          <p>3-day Starter trial — no charge until day 4. Cancel anytime from your account settings.</p>
          <div className="cta-btns">
            <Link
              className="btn btn-white btn-lg"
              href="/pricing"
              onClick={() => trackEvent('cta_click', { cta: 'start_trial', location: 'ai_vs_agency' })}
            >
              See pricing
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
