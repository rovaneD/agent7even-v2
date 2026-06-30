'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { trackEvent } from '@/lib/gtag'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import {
  VS_SCHEDULING_COMPARE,
  VS_SCHEDULING_ROWS,
} from '@/lib/marketing/vsSchedulingToolsContent'

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

      <header className="idx-hero">
        <div className="wrap">
          <span className="eyebrow">Compare</span>
          <h1 className="t-display">AI marketing OS vs scheduling tools</h1>
          <p className="t-lead">
            Scheduling tools post what you give them. Agent7even plans, drafts, and generates campaigns in your voice — then queues everything for your approval before it goes live.
          </p>
        </div>
      </header>

      <section className="compare-section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="compare-grid reveal">
            <div className="compare-col compare-traditional">
              <h3>{VS_SCHEDULING_COMPARE.scheduling.title}</h3>
              <ul>
                {VS_SCHEDULING_COMPARE.scheduling.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="compare-col compare-agent7even">
              <h3>{VS_SCHEDULING_COMPARE.agent7even.title}</h3>
              <ul>
                {VS_SCHEDULING_COMPARE.agent7even.items.map((item) => (
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
            <span className="eyebrow">Side by side</span>
            <h2 className="t-h2">Strategy layer vs publish button.</h2>
          </div>
          <div className="compare-table-wrap reveal">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col"></th>
                  <th scope="col">Scheduling tools</th>
                  <th scope="col">Agent7even</th>
                </tr>
              </thead>
              <tbody>
                {VS_SCHEDULING_ROWS.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>{row.scheduling}</td>
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
          <h2>Draft first. Schedule when you approve.</h2>
          <p>3-day Starter trial — Maya plans and drafts; you stay in control.</p>
          <div className="cta-btns">
            <Link
              className="btn btn-white btn-lg"
              href="/pricing"
              onClick={() => trackEvent('cta_click', { cta: 'start_trial', location: 'vs_scheduling' })}
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
