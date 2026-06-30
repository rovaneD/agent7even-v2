'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import MarketingNav from '../MarketingNav'
import MarketingFooter from '../MarketingFooter'
import { BILLING_EMAIL, SUPPORT_EMAIL } from '@/lib/siteUrls'

const CONTACT_CHANNELS = [
  {
    title: 'Product support',
    email: SUPPORT_EMAIL,
    detail: 'Help with your account, agents, integrations, billing questions that are not invoice disputes, and general product guidance.',
    subjects: ['Account help', 'Integrations', 'Bug reports'],
  },
  {
    title: 'Billing',
    email: BILLING_EMAIL,
    detail: 'Subscription changes, invoices, refunds, and payment issues. Include your account email so we can find your workspace quickly.',
    subjects: ['Invoices', 'Plan changes', 'Refunds'],
  },
]

export default function ContactPage() {
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
          <span className="eyebrow">Contact</span>
          <h1 className="t-display">We are here to help.</h1>
          <p className="t-lead">
            No phone tree, no account manager gatekeeping. Email the right inbox and a real person on the Agent7even team will get back to you.
          </p>
        </div>
      </header>

      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="contact-grid reveal">
            {CONTACT_CHANNELS.map((channel) => (
              <div key={channel.title} className="contact-card">
                <h2>{channel.title}</h2>
                <a className="contact-email" href={`mailto:${channel.email}`}>
                  {channel.email}
                </a>
                <p>{channel.detail}</p>
                <ul>
                  {channel.subjects.map((subject) => (
                    <li key={subject}>{subject}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="company-block reveal" style={{ marginTop: 48 }}>
            <h2 className="t-h2">Other requests</h2>
            <p className="t-body">
              Privacy and data deletion: see our <Link href="/privacy">Privacy Policy</Link> and{' '}
              <Link href="/data-deletion">data deletion</Link> page. Security disclosures:{' '}
              <Link href="/security">Security</Link>.
            </p>
            <p className="t-body">
              Not a customer yet? <Link href="/pricing">Compare plans</Link> or{' '}
              <Link href="/sign-up">start your free trial</Link>.
            </p>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
