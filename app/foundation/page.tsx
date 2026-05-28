import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import FoundationFlow from './FoundationFlow'

export default async function FoundationPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_name, business_type, foundation_complete, foundation_step')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) redirect('/sign-in')
  if (profile.foundation_complete) redirect('/maya')

  return (
    <FoundationFlow
      profileId={profile.id}
      companyName={profile.company_name ?? ''}
      initialStep={profile.foundation_step ?? 0}
    />
  )
}
