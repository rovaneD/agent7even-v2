import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getGaProfileForClerkUser } from '@/lib/analytics/gaOAuthProfile'
import { getWorkspaceSessionForClerkUser } from '@/lib/profiles/workspaceSession'
import { getTeamPermissions } from '@/lib/teamPermissions'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  const session = await getWorkspaceSessionForClerkUser(supabase, userId, email)
  if (!session) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const perms = await getTeamPermissions(session.memberId)
  if (!perms.isOwner) {
    return NextResponse.json({ error: 'Only account owners can disconnect Google Analytics' }, { status: 403 })
  }

  const profile = await getGaProfileForClerkUser(supabase, userId, email)

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      ga_measurement_id: null,
      ga_refresh_token: null,
      ga_oauth_email: null,
      ga_connected: false,
    })
    .eq('id', profile.id)

  if (error) return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  return NextResponse.json({ success: true })
}
