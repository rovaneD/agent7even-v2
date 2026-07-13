import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import NotificationsClient from './NotificationsClient'

export default async function NotificationsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const profile = await resolveClerkProfile(supabase, userId, 'id')

  if (!profile) redirect('/dashboard')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <NotificationsClient
      profileId={profile.id}
      initialNotifications={notifications ?? []}
    />
  )
}
