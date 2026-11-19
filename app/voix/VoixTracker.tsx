'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/gtag'
import { DEMO_TEL, SALES_TEL } from './voixStyles'

/**
 * Funnel events for the Voix landing page (Vercel Web Analytics → Events):
 *   voix_apply_click   { where }  "Apply" buttons (links to #pilot)
 *   voix_how_click     { where }  "See how it works"
 *   voix_call_demo     { where }  "Call the spa demo"
 *   voix_call_sales    { where }  "Experience Voix" (AI sales line)
 *   voix_section_view  { section } scrolled to cost / how / pilot / faq (once each)
 * The form and calculator send their own events (voix_form_*, voix_calculator_used).
 * `where` is the id of the section the click came from.
 */
export default function VoixTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest('a')
      if (!a) return
      const href = a.getAttribute('href') ?? ''
      const where = a.closest('section[id]')?.id ?? (a.closest('header') ? 'header' : 'page')
      if (href === '#pilot') trackEvent('voix_apply_click', { where })
      else if (href === '#how') trackEvent('voix_how_click', { where })
      else if (SALES_TEL && href === SALES_TEL) trackEvent('voix_call_sales', { where })
      else if (DEMO_TEL && href === DEMO_TEL) trackEvent('voix_call_demo', { where })
    }
    document.addEventListener('click', onClick, { capture: true })

    const seen = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id
          if (entry.isIntersecting && !seen.has(id)) {
            seen.add(id)
            trackEvent('voix_section_view', { section: id })
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.35 }
    )
    for (const id of ['cost', 'how', 'pilot', 'faq']) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }

    return () => {
      document.removeEventListener('click', onClick, { capture: true })
      observer.disconnect()
    }
  }, [])
  return null
}
