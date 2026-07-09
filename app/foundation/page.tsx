import { auth } from '@clerk/nextjs/server'
import { getClerkUserSafe } from '@/lib/clerk/sessionUser'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { ensureProfileForClerkUser } from '@/lib/profiles/ensureProfile'
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
    getClerkUserSafe(),
    Promise.resolve(createServiceClient()),
  ])

  const { profile } = await ensureProfileForClerkUser(supabase, userId, user)

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111111] px-6">
        <div className="max-w-md text-center">
          <p className="text-lg font-semibold text-[#f5f4f0]">Setting up your account…</p>
          <p className="mt-2 text-sm text-white/50">
            This usually takes a few seconds. Refresh the page if it does not continue.
          </p>
        </div>
      </div>
    )
  }
  if (profile.foundation_complete) redirect('/dashboard/foundation')
  if ((profile.foundation_step ?? 0) >= 5) redirect('/dashboard/foundation')

  return (
    <FoundationFlow
      profileId={profile.id}
      companyName={profile.company_name ?? ''}
      initialStep={profile.foundation_step ?? 0}
      selectedPlan={plan}
    />
  )
}
