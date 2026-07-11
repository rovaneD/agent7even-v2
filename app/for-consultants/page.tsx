import type { Metadata } from 'next'
import '../lab5/styles.css'
import { marketingPageMetadata } from '@/lib/marketing/seoMetadata'
import UseCaseDetailClient from '../lab5/use-cases/UseCaseDetailClient'

export const metadata: Metadata = marketingPageMetadata({
  title: 'AI Marketing for Consultants | Thought Leadership on Autopilot | Agent7even',
  description:
    'Marketing automation for consultants — Maya drafts LinkedIn posts, nurture emails, and offer campaigns in your voice. Approval-first workflows from $49/mo.',
  path: '/for-consultants',
})

export default function ForConsultantsPage() {
  return (
    <UseCaseDetailClient
      slug="coaches-creators"
      labelOverride="Consultants & solo experts"
      headlineOverride="Visible between client work."
      subheadOverride="You sell expertise, not hours spent posting. Maya drafts thought-leadership content, nurture sequences, and offer pushes — you approve before anything goes live."
      viewingContext="Consultants & solo experts"
    />
  )
}
