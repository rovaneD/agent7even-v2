import type { Metadata } from 'next'
import '../lab5/styles.css'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'
import IntegrationsPage from '../lab5/integrations/page'

export const metadata: Metadata = marketingPageMetadata({
  title: 'Integrations — Social, Email & Analytics | Agent7even',
  description:
    'Connect Instagram, Facebook, LinkedIn, Threads, YouTube, Google Analytics, and draft email for Mailchimp or Klaviyo — Maya works alongside your existing marketing stack.',
  path: '/integrations',
})

export default IntegrationsPage
