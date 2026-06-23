import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import * as publisher from '@/lib/social/publisher'
import { parseQueueList } from '@/lib/social/zernioQueuesParse'

export async function GET(req: NextRequest) {
  if (!process.env.ZERNIO_API_KEY) {
    return NextResponse.json(
      { error: 'zernio_not_configured', message: 'Social publishing is not configured on this server.' },
      { status: 503 },
    )
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, zernio_profile_id, zernio_profile_ids')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile?.plan) {
    return NextResponse.json({ error: 'active_plan_required' }, { status: 403 })
  }

  const profileIds = (profile.zernio_profile_ids as string[] | null) ?? []
  if (profile.zernio_profile_id && !profileIds.includes(profile.zernio_profile_id)) {
    profileIds.push(profile.zernio_profile_id)
  }

  const { searchParams } = req.nextUrl
  const profileId = searchParams.get('profileId') ?? profile.zernio_profile_id ?? profileIds[0]
  if (!profileId || !profileIds.includes(profileId)) {
    return NextResponse.json({ error: 'invalid_profile' }, { status: 400 })
  }

  const raw = await publisher.listQueueSlots(profileId)
  if (!raw) {
    return NextResponse.json({ error: 'zernio_api_error' }, { status: 502 })
  }

  return NextResponse.json({
    profileId,
    queues: parseQueueList(raw),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
