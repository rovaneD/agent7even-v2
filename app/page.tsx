import type { Metadata } from 'next'
import './lab5/styles.css'
import OrganizationJsonLd from '@/components/marketing/OrganizationJsonLd'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'
import Lab5HomePage from './lab5/page'

export const metadata: Metadata = marketingPageMetadata({
  title: 'AI Marketing Strategist for Small Business | Agent7even',
  description:
    'Maya, your AI marketing strategist, drafts campaigns and content for your approval. Stop paying agencies $3K/month for reports — get an AI marketing OS in your voice.',
  path: '/',
})

export default function HomePage() {
  return (
    <>
      <OrganizationJsonLd />
      <Lab5HomePage />
    </>
  )
}
