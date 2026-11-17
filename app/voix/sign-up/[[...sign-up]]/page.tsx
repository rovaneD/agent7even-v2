import type { Metadata } from 'next'
import VoixAuthShell from '../../_components/VoixAuthShell'
import { VoixSignUpForm } from '../../_components/VoixClerkForms'
import { privateRouteMetadata } from '@/lib/marketing/seoMetadata'

export const metadata: Metadata = privateRouteMetadata('Create your Voix login')

export default function VoixSignUpPage() {
  return (
    <VoixAuthShell title="Create your login">
      <p className="-mt-3 mb-6 text-center text-sm text-[#4A5061]">
        Use the email address your spa was invited with.
      </p>
      <VoixSignUpForm />
    </VoixAuthShell>
  )
}
