import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveWorkspaceClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import * as publisher from '@/lib/social/publisher'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const dateRange = searchParams.get('dateRange') ?? '30d'
  const platform  = searchParams.get('platform') ?? undefined

  const supabase = createServiceClient()
  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  const profile = await resolveWorkspaceClerkProfile<{
    id: string
    plan: string | null
    zernio_profile_id: string | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    created_at: string
  }>(
    supabase,
    userId,
    'id, plan, zernio_profile_id',
    email,
  )

  if (!profile?.plan) {
    return NextResponse.json({ error: 'active_plan_required' }, { status: 403 })
  }
  if (!profile.zernio_profile_id) {
    return NextResponse.json({ error: 'not_connected' }, { status: 404 })
  }

  return publisher.withZernioUsageContext(
    {
      userId: profile.id as string,
      zernioProfileId: profile.zernio_profile_id as string,
    },
    async () => {
  const { fromDate, toDate } = publisher.dateRangeToWindow(dateRange)
  const data = await publisher.getAdsAnalytics({
    profileId: profile.zernio_profile_id as string,
    platform,
    fromDate,
    toDate,
  })

  if (!data) {
    return NextResponse.json({ error: 'Failed to fetch ads analytics' }, { status: 502 })
  }

  return NextResponse.json(data)
    },
  )
}
