import type { Metadata } from 'next'
import MarketingJsonLd from '@/components/marketing/MarketingJsonLd'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'
import HomepageSiteBrandStoryB from './design-concept/homepage-site-brand-b/HomepageSiteBrandStoryB'

export const metadata: Metadata = marketingPageMetadata({
  title: 'AI Marketing Strategist & Automation for Small Business | Agent7even',
  description:
    'Maya AI plans campaigns, writes content, and queues everything for your approval. Start your 3-day free trial — no setup fees, cancel anytime.',
  path: '/',
})

/**
 * Homepage — scroll-story hero (variant B) + the same below-the-fold sections
 * as before. The previous hero remains intact at /lab5 for A/B comparison.
 */
export default function HomePage() {
  return (
    <>
      <MarketingJsonLd />
      <HomepageSiteBrandStoryB />
    </>
  )
}
