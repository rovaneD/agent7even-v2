import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { getClerkSessionEmail } from '@/lib/clerk/sessionUser'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createServiceClient } from '@/lib/supabase/server'
import { ensurePaidSubscriptionForClerkUser } from '@/lib/billing/subscriptionGate'
import StartTrialClient from './StartTrialClient'
import { privateRouteMetadata } from '@/lib/marketing/seoMetadata'

export const metadata: Metadata = privateRouteMetadata('Start your trial — Agent7even')

export default async function StartTrialPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; annual?: string }>
}) {
  const { plan } = await searchParams
  const { userId } = await auth()

  if (userId) {
    const supabase = createServiceClient()
    const email = await getClerkSessionEmail()
    const gate = await ensurePaidSubscriptionForClerkUser(supabase, userId, email)

    if (gate.ok) {
      redirect(plan ? `/foundation?plan=${encodeURIComponent(plan)}` : '/dashboard')
    }
  }

  return (
    <Suspense fallback={null}>
      <StartTrialClient />
    </Suspense>
  )
}
