import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export type ZernioProfileContext = {
  profileIds: string[]
  primaryProfileId: string
}

export async function requireZernioProfile(): Promise<
  { error: NextResponse } | ZernioProfileContext
> {
  const { userId } = await auth()
  if (!userId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, zernio_profile_id, zernio_profile_ids')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile?.plan) {
    return { error: NextResponse.json({ error: 'active_plan_required' }, { status: 403 }) }
  }

  const profileIds = (profile.zernio_profile_ids as string[] | null) ?? []
  if (profile.zernio_profile_id && !profileIds.includes(profile.zernio_profile_id)) {
    profileIds.push(profile.zernio_profile_id)
  }

  if (profileIds.length === 0) {
    return { error: NextResponse.json({ error: 'not_connected' }, { status: 404 }) }
  }

  return {
    profileIds,
    primaryProfileId: (profile.zernio_profile_id as string | null) ?? profileIds[0],
  }
}
