import type { Metadata } from 'next'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'

export const metadata: Metadata = marketingPageMetadata({
  title: 'AI Marketing Platform Pricing | Plans from $49/mo | Agent7even',
  description:
    'Transparent AI marketing platform pricing for small business — Starter from $49/mo with a 3-day trial. Unlimited Maya chat and agent runs; credits for images and video only.',
  path: '/pricing',
})

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
