import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import * as publisher from '@/lib/social/publisher'

/** Convert a dateRange string ('7d' | '30d' | '90d' | '6m' | '1y') to a number of days. */
function dateRangeToDays(dateRange: string): number {
  if (dateRange === '7d')  return 7
  if (dateRange === '30d') return 30
  if (dateRange === '90d') return 90
  if (dateRange === '6m')  return 180
  if (dateRange === '1y')  return 365
  return 30
}

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

  const profileId = profile.zernio_profile_id as string
  const days = dateRangeToDays(dateRange)

  // ── 1. Get post data (existing endpoint — confirmed working) ─────────────────
  const rawPostData = await publisher.getSocialAnalytics({ profileId, platform, dateRange })

  if (typeof rawPostData === 'object' && rawPostData !== null && '_zernioError' in rawPostData) {
    const errMsg = (rawPostData as Record<string, unknown>)._zernioError
    console.error('[zernio/social] Zernio analytics error:', errMsg)
    return NextResponse.json({ error: 'zernio_api_error', detail: errMsg }, { status: 502 })
  }

  // ── 2. Get connected account IDs ─────────────────────────────────────────────
  let accounts = await publisher.getProfileAccounts(profileId)

  // Fallback: extract accountIds from post platform data when /connected-accounts returns empty.
  // This happens when an account was disconnected from Zernio but analytics data is still cached.
  if (accounts.length === 0 && rawPostData) {
    type PlatformEntry = { accountId?: string; platform?: string; accountUsername?: string }
    type PostEntry = { platforms?: PlatformEntry[] }
    const postsArr: PostEntry[] = (rawPostData as { posts?: PostEntry[] })?.posts ?? []
    const seen = new Set<string>()
    for (const post of postsArr) {
      for (const entry of (post.platforms ?? [])) {
        if (entry.accountId && !seen.has(entry.accountId)) {
          seen.add(entry.accountId)
          accounts.push({ id: entry.accountId, platform: entry.platform ?? '', username: entry.accountUsername ?? '' })
        }
      }
    }
    if (accounts.length > 0) {
      console.log('[zernio/social] fallback: using accountIds from post data:', accounts.map(a => a.id))
    }
  }

  const accountIds = accounts.map(a => a.id).filter(Boolean)

  // ── 3. Daily time series (one call per account, fail soft) ───────────────────
  let dailyData: unknown = null
  if (accountIds.length > 0) {
    // Use first account for daily stats; multi-account aggregation is a future iteration
    dailyData = await publisher.getDailyAnalytics({ accountId: accountIds[0], days })
  }

  // ── 4. Account-level metrics for follower counts (fail soft) ─────────────────
  const accountMetricsArray: unknown[] = await Promise.all(
    accountIds.map(id => publisher.getAccountMetrics(id))
  )

  // ── 5. Best-time heatmap (fail soft) ─────────────────────────────────────────
  let bestTimesData: unknown = null
  if (accountIds.length > 0) {
    const primaryAccount = accounts[0]
    bestTimesData = await publisher.getBestTimeToPost({
      accountId: primaryAccount.id,
      platform: platform ?? primaryAccount.platform,
    })
    if (bestTimesData) {
      console.log('[zernio/social] bestTimes response:', JSON.stringify(bestTimesData).slice(0, 500))
    }
  }

  return NextResponse.json({
    posts:      rawPostData,
    daily:      dailyData,
    accounts:   accountMetricsArray,
    bestTimes:  bestTimesData,
  })
}
