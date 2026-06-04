import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import FoundationFlow from './FoundationFlow'

export default async function FoundationPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { plan } = await searchParams
  const [user, supabase] = await Promise.all([
    currentUser(),
    Promise.resolve(createServiceClient()),
  ])

  const email = user?.emailAddresses?.[0]?.emailAddress ?? ''
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')

  // Ensure profile row exists — safe to call even if row already exists
  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert({
      clerk_user_id: userId,
      email,
      full_name: fullName,
      avatar_url: user?.imageUrl ?? '',
      role: 'client',
      status: 'onboarding',
    }, { onConflict: 'clerk_user_id', ignoreDuplicates: true })

  if (upsertError) console.error('[foundation] profile upsert error:', upsertError.message)

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_name, business_type, foundation_complete, foundation_step')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) redirect('/sign-in')
  if (profile.foundation_complete) redirect('/dashboard')

  return (
    <FoundationFlow
      profileId={profile.id}
      companyName={profile.company_name ?? ''}
      initialStep={profile.foundation_step ?? 0}
      selectedPlan={plan}
    />
  )
}
