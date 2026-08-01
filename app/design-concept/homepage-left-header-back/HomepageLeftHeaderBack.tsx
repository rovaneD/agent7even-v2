'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { trackEvent } from '@/lib/gtag'
import { FIRST_CHARGE_DAY, TRIAL_LABEL } from '@/lib/billing/trialPolicy'
import MayaOrb from '@/components/maya/MayaOrb'
import MarketingHomepageBelowFold from '@/components/marketing/MarketingHomepageBelowFold'
import MarketingNav from '@/app/lab5/MarketingNav'
import HeroDashboardMockup from '@/app/lab5/HeroDashboardMockup'
import { useMockupScript } from '@/app/lab5/useMockupScript'

import '../../lab5/styles.css'
import '../homepage-site-brand-b/homepage-site-brand-b.css'
import './homepage-left-header-back.css'

function HeroCopyLeft() {
  return (
    <>
      <div className="hsb-b-eyebrow">
        From idea to approval queue,
        <br />
        without switching tools
      </div>
      <h1 className="hsb-b-h1">Marketing, managed.</h1>
      <div className="hsb-b-sub">
        <div className="hsb-b-sub-line">
          <div className="hsb-b-sub-primary">
            <span className="hsb-b-orb" aria-hidden>
              <MayaOrb size={22} active />
            </span>
            <span>
              <span className="maya">Maya</span> handles the work.
            </span>
          </div>
          <p className="hsb-b-sub-secondary">You approve before anything goes live.</p>
        </div>
      </div>
      <p className="hsb-b-body">
        Maya plans campaigns, writes the content, and routes every draft to one queue. Every image, caption, and
        email pulls from your Foundation. You decide what gets published.
      </p>
      <Link
        href="/pricing"
        className="btn btn-hero-primary"
        onClick={() => trackEvent('cta_click', { cta: 'start_trial', location: 'hero' })}
      >
        Start for free →
      </Link>
      <div className="hsb-b-trust">
        <span>
          <span className="hsb-b-check">✓</span> {TRIAL_LABEL}
        </span>
        <span>Cancel anytime</span>
        <span>No charge until day {FIRST_CHARGE_DAY}</span>
      </div>
    </>
  )
}

/**
 * Production homepage — left-aligned hero, HeaderBack.jpg, static dashboard mockup.
 * Scroll-story variant preserved at /design-concept/homepage-site-brand-b.
 */
export default function HomepageLeftHeaderBack() {
  useMockupScript('/lab5/mockups.js', '__initMockups', { lazy: true })

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
    <div className="lab5 lab5--hsb-header-back lab5--hsb-left">
      <MarketingNav />
      <div className="hsb-header-backdrop" aria-hidden />

      <header className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy hsb-b">
            <HeroCopyLeft />
          </div>
        </div>
        <div className="wrap showpiece">
          <HeroDashboardMockup />
        </div>
      </header>

      <MarketingHomepageBelowFold />
    </div>
  )
}
