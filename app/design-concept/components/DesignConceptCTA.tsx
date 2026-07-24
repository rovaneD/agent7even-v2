'use client'

import Link from 'next/link'
import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import MayaPresence from './MayaPresence'

gsap.registerPlugin(ScrollTrigger)

export default function DesignConceptCTA() {
  const rootRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    const ctx = gsap.context(() => {
      gsap.from('.dc-cta__copy > *', {
        opacity: 0,
        y: 14,
        stagger: 0.09,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: root,
          start: 'top 78%',
          toggleActions: 'play none none reverse',
        },
      })

      gsap.from('.dc-cta__orbit', {
        opacity: 0,
        scale: 0.85,
        stagger: 0.07,
        duration: 0.65,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: root,
          start: 'top 72%',
          toggleActions: 'play none none reverse',
        },
      })

      gsap.to('.dc-cta__orbit', {
        x: 0,
        y: 0,
        scale: 0.15,
        opacity: 0.15,
        stagger: 0.06,
        duration: 1.1,
        ease: 'power2.inOut',
        scrollTrigger: {
          trigger: root,
          start: 'top 65%',
          end: 'top 35%',
          scrub: 0.6,
        },
      })
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={rootRef} className="dc-cta" aria-labelledby="dc-cta-title">
      <div className="dc-wrap dc-cta__inner">
        <div className="dc-cta__visual" aria-hidden="true">
          <div className="dc-cta__visual-field" />
          <div className="dc-cta__orbit dc-cta__orbit--violet" />
          <div className="dc-cta__orbit dc-cta__orbit--blue" />
          <div className="dc-cta__orbit dc-cta__orbit--coral" />
          <div className="dc-cta__orbit dc-cta__orbit--gold" />
          <MayaPresence state="complete" size="xl" fragmented={false} />
        </div>

        <div className="dc-cta__copy">
          <h2 id="dc-cta-title" className="dc-cta__title">
            One Foundation.
            <br />
            Twelve specialist agents.
            <br />
            One approval queue.
          </h2>
          <p className="dc-cta__body">
            Maya reads your Foundation and Brand Kit before every draft.
          </p>
          <p className="dc-cta__body">
            Every campaign lands in your approval queue before anything goes live.
          </p>
          <div className="dc-cta__actions">
            <Link href="/pricing" className="dc-btn dc-btn--primary dc-btn--lg">
              Start your free trial
            </Link>
            <Link href="/pricing" className="dc-btn dc-btn--ghost dc-btn--lg">
              See plans
            </Link>
          </div>
          <p className="dc-cta__note">3-day free trial. No charge until day 4.</p>
        </div>
      </div>
    </section>
  )
}
