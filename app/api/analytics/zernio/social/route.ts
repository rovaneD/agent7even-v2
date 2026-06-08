import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import * as publisher from '@/lib/social/publisher'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const dateRange = searchParams.get('dateRange') ?? '30d'
  const platform  = searchParams.get('platform') ?? undefined

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, zernio_profile_id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile?.plan) {
    return NextResponse.json({ error: 'active_plan_required' }, { status: 403 })
  }
  if (!profile.zernio_profile_id) {
    return NextResponse.json({ error: 'not_connected' }, { status: 404 })
  }

  const data = await publisher.getSocialAnalytics({
    profileId: profile.zernio_profile_id as string,
    platform,
    dateRange,
  })

  if (!data) {
    return NextResponse.json({ error: 'Failed to fetch analytics from Zernio' }, { status: 502 })
  }

  // If publisher returned a wrapped error, surface it so the client can log it
  if (typeof data === 'object' && data !== null && '_zernioError' in data) {
    const errMsg = (data as Record<string, unknown>)._zernioError
    console.error('[zernio/social] Zernio analytics error:', errMsg)
    return NextResponse.json({ error: 'zernio_api_error', detail: errMsg }, { status: 502 })
  }

  return NextResponse.json(data)
}
