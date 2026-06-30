import type { Metadata } from 'next'
import '../lab5/styles.css'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'
import HowItWorksPage from '../lab5/how-it-works/page'

export const metadata: Metadata = marketingPageMetadata({
  title: 'How AI Marketing Automation Works | Agent7even',
  description:
    'See how Maya and twelve specialist agents plan campaigns, draft content, and queue work for your approval — AI marketing automation built for small business.',
  path: '/how-it-works',
})

export default HowItWorksPage
