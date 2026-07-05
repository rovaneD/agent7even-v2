import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import * as publisher from '@/lib/social/publisher'
import { parseQueueList } from '@/lib/social/zernioQueuesParse'
import { getAnalyticsProfileForClerkUser } from '@/lib/profiles/getAnalyticsProfile'
import {
  getWorkspaceAuthContext,
  workspaceDataUserId,
} from '@/lib/profiles/workspaceSession'

export async function GET(req: NextRequest) {
  if (!process.env.ZERNIO_API_KEY) {
    return NextResponse.json(
      { error: 'zernio_not_configured', message: 'Social publishing is not configured on this server.' },
      { status: 503 },
    )
  }

  const supabase = createServiceClient()
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getAnalyticsProfileForClerkUser(supabase, ctx.clerkUserId, ctx.email)
  const workspaceId = workspaceDataUserId(ctx.session)

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

  return publisher.withZernioUsageContext(
    { userId: workspaceId, zernioProfileId: profileId },
    async () => {
      const raw = await publisher.listQueueSlots(profileId)
      if (!raw) {
        return NextResponse.json({ error: 'zernio_api_error' }, { status: 502 })
      }

      return NextResponse.json({
        profileId,
        queues: parseQueueList(raw),
      }, { headers: { 'Cache-Control': 'no-store' } })
    },
  )
}
