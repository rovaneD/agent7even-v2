import { Suspense } from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import ApprovalsClient from './ApprovalsClient'

export default async function ApprovalsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, company_name')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  const profile = profileRows?.[0] ?? null
  if (!profile) redirect('/onboarding')

  const { data: tasks } = await supabase
    .from('agent_tasks')
    .select('*, agent_outputs(*)')
    .eq('user_id', profile.id)
    .eq('requires_approval', true)
    .eq('status', 'completed')
    .is('approved_at', null)
    .is('rejected_at', null)
    .order('created_at', { ascending: false })

  return (
    <Suspense>
      <ApprovalsClient
        profileId={profile.id}
        initialTasks={tasks ?? []}
      />
    </Suspense>
  )
}
