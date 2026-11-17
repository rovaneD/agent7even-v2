import type { Metadata } from 'next'
import VoixAuthShell from '../../_components/VoixAuthShell'
import { VoixSignInForm } from '../../_components/VoixClerkForms'
import { privateRouteMetadata } from '@/lib/marketing/seoMetadata'

export const metadata: Metadata = privateRouteMetadata('Sign in — Voix')

export default function VoixSignInPage() {
  return (
    <VoixAuthShell title="Your front desk">
      <VoixSignInForm />
    </VoixAuthShell>
  )
}
