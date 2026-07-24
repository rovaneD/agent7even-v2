'use client'

import Link from 'next/link'
import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import MayaPresence from './MayaPresence'
import { HERO_FRAGMENTS } from '../storyData'

export default function DesignConceptHero() {
  const rootRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || !rootRef.current) return

    const ctx = gsap.context(() => {
      const mayaEl = rootRef.current?.querySelector('.dc-hero__maya-slot .dc-maya') as HTMLElement | null
      const setHeroMaya = (state: 'idle' | 'listening' | 'reading') => {
        if (!mayaEl) return
        ;(['idle', 'listening', 'reading'] as const).forEach((s) => mayaEl.classList.remove(`dc-maya--${s}`))
        mayaEl.classList.add(`dc-maya--${state}`)
      }

      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })
      tl.from('.dc-hero__eyebrow', { opacity: 0, duration: 0.65 })
        .from('.dc-hero__title', { opacity: 0, y: 20, duration: 0.85 }, '-=0.3')
        .from('.dc-hero__body p', { opacity: 0, y: 12, stagger: 0.1, duration: 0.6 }, '-=0.4')
        .from('.dc-hero__arch', { opacity: 0, duration: 0.45 }, '-=0.15')
        .from('.dc-hero__cta', { opacity: 0, y: 10, duration: 0.5 }, '-=0.2')
        .from('.dc-hero__canvas', { opacity: 0, y: 24, duration: 0.85 }, '-=0.25')
        .from('.dc-hero__bubble--user', { opacity: 0, y: 10, duration: 0.5 }, '-=0.4')
        .from('.dc-hero__maya-slot', { opacity: 0, scale: 0.88, duration: 0.75 }, '-=0.25')
        .call(() => setHeroMaya('listening'), undefined, '-=0.5')
        .from('.dc-hero__bubble--maya', { opacity: 0, y: 8, duration: 0.5 }, '-=0.35')
        .call(() => setHeroMaya('reading'), undefined, '-=0.15')
        .from('.dc-hero__fragment', { opacity: 0, scale: 0.92, stagger: 0.08, duration: 0.45 }, '-=0.2')
        .from('.dc-hero__draft', { opacity: 0, y: 14, scale: 0.96, duration: 0.6 }, '-=0.05')
    }, rootRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={rootRef} className="dc-hero" aria-labelledby="dc-hero-title">
      <div className="dc-wrap dc-hero__grid">
        <div className="dc-hero__copy">
          <p className="dc-hero__eyebrow">From idea to approval queue, without switching tools.</p>
          <h1 id="dc-hero-title" className="dc-hero__title">
            Marketing, managed.
          </h1>
          <div className="dc-hero__body">
            <p>Maya plans campaigns, writes the content, and routes every draft to one queue.</p>
            <p>Every image, caption, and email pulls from your Foundation.</p>
            <p>You decide what gets published.</p>
          </div>
          <p className="dc-hero__arch">One Foundation. Twelve specialist agents. One approval queue.</p>
          <div className="dc-hero__cta">
            <div className="dc-hero__cta-row">
              <Link href="/pricing" className="dc-btn dc-btn--primary dc-btn--lg">
                Start your free trial
              </Link>
              <Link href="#story" className="dc-btn dc-btn--ghost dc-btn--lg">
                See how it works
              </Link>
            </div>
            <p className="dc-hero__note">3-day free trial. No charge until day 4.</p>
          </div>
        </div>

        <div className="dc-hero__visual" aria-hidden="true">
          <div className="dc-hero__canvas">
            <div className="dc-hero__canvas-glow dc-hero__canvas-glow--violet" />
            <div className="dc-hero__canvas-glow dc-hero__canvas-glow--gold" />

            {HERO_FRAGMENTS.map((f, i) => (
              <div key={f.id} className={`dc-hero__fragment dc-hero__fragment--${i + 1}`}>
                <span className="dc-hero__fragment-label">{f.label}</span>
                <strong>{f.value}</strong>
              </div>
            ))}

            <div className="dc-hero__maya-slot">
              <MayaPresence state="idle" size="lg" />
            </div>

            <div className="dc-hero__convo">
              <div className="dc-hero__bubble dc-hero__bubble--user">
                Fill next Friday — it&apos;s our slow day.
              </div>
              <div className="dc-hero__bubble dc-hero__bubble--maya">
                On it. I&apos;m drafting the offer, email, and three posts now.
              </div>
            </div>

            <div className="dc-hero__draft">
              <span className="dc-hero__draft-tag">Forming</span>
              <p className="dc-hero__draft-title">Friday Slow-Day Promo</p>
              <p className="dc-hero__draft-meta">Email + 3 posts · From Foundation</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
