import type { Metadata } from 'next'
import './lab5/styles.css'
import MarketingJsonLd from '@/components/marketing/MarketingJsonLd'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'
import Lab5HomePage from './lab5/page'

export const metadata: Metadata = marketingPageMetadata({
  title: 'AI Marketing Strategist & Automation Platform | Agent7even',
  description:
    'Maya AI creates marketing campaigns you approve — not agencies charging $3K/month for reports. Try our AI marketing strategist free for 3 days on Starter.',
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
