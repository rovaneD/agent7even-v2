import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import InquiryForm from './InquiryForm'

export default async function InquiryPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const profile = await resolveClerkProfile<{
    id: string
    company_name: string | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    plan: string | null
    created_at: string
  }>(supabase, userId, 'id, company_name')

  if (!profile) redirect('/dashboard')

  return (
    <InquiryForm companyName={profile.company_name ?? ''} />
  )
}
