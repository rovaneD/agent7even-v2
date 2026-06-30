import type { Metadata } from 'next'
import './lab5/styles.css'
import MarketingJsonLd from '@/components/marketing/MarketingJsonLd'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'
import Lab5HomePage from './lab5/page'

export const metadata: Metadata = marketingPageMetadata({
  title: 'AI Marketing Strategist & Automation for Small Business | Agent7even',
  description:
    'Maya AI plans campaigns, writes content, and queues everything for your approval. Start your 3-day free trial — no setup fees, cancel anytime.',
  path: '/',
})

export default function HomePage() {
  return (
    <>
      <MarketingJsonLd />
      <Lab5HomePage />
    </>
  )
}
