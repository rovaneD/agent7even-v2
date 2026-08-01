import type { Metadata } from 'next'
import MarketingJsonLd from '@/components/marketing/MarketingJsonLd'
import { TRIAL_LABEL } from '@/lib/billing/trialPolicy'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'
import HomepageLeftHeaderBack from './design-concept/homepage-left-header-back/HomepageLeftHeaderBack'

export const metadata: Metadata = marketingPageMetadata({
  title: 'AI Marketing Strategist & Automation for Small Business | Agent7even',
  description:
    `Maya AI plans campaigns, writes content, and queues everything for your approval. Start your ${TRIAL_LABEL.toLowerCase()} — no setup fees, cancel anytime.`,
  path: '/',
})

/**
 * Homepage — left-aligned hero, HeaderBack.jpg backdrop, static dashboard mockup.
 * Scroll-story variant B: /design-concept/homepage-site-brand-b · legacy hero: /lab5
 */
export default function HomePage() {
  return (
    <>
      <MarketingJsonLd />
      <HomepageLeftHeaderBack />
    </>
  )
}
