import type { Metadata } from 'next'
import '../lab5/styles.css'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'
import UseCaseDetailClient from '../lab5/use-cases/UseCaseDetailClient'

export const metadata: Metadata = marketingPageMetadata({
  title: 'AI Marketing for Coaches | Campaigns You Approve | Agent7even',
  description:
    'Marketing automation for coaches — Maya drafts launches, weekly content, and social posts in your voice. Nothing publishes until you approve. From $49/mo.',
  path: '/for-coaches',
})

export default function ForCoachesPage() {
  return (
    <UseCaseDetailClient
      slug="coaches-creators"
      labelOverride="Coaches & course creators"
      headlineOverride="Marketing that runs while you coach."
      subheadOverride="You are the product and the marketing department. Maya drafts launches, weekly content, and social posts in your voice — queued for approval, not auto-posted."
    />
  )
}
