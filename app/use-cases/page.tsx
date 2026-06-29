import type { Metadata } from 'next'
import '../lab5/styles.css'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'

export const metadata: Metadata = marketingPageMetadata({
  title: 'Use Cases — AI Marketing for Small Business | Agent7even',
  description:
    'Which business looks like yours? See how local service, e-commerce, creators, and startups lean on different specialist agents — same approval-first OS.',
  path: '/use-cases',
})

export { default } from '../lab5/use-cases/page'
