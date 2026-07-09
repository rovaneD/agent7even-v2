import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getClerkSessionEmail } from '@/lib/clerk/sessionUser'
import { createServiceClient } from '@/lib/supabase/server'
import { getGaProfileForClerkUser } from '@/lib/analytics/gaOAuthProfile'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const email = await getClerkSessionEmail()
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
