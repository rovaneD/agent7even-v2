import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import * as publisher from '@/lib/social/publisher'

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

  // ── 1. Post data + follower stats in parallel ────────────────────────────────
  const [rawPostData, followerStatsRaw, allAccountsRaw] = await Promise.all([
    publisher.getSocialAnalytics({ profileId, platform, dateRange }),
    publisher.getFollowerStats(),
    publisher.listAllAccounts(platform),
  ])

  if (typeof rawPostData === 'object' && rawPostData !== null && '_zernioError' in rawPostData) {
    const errMsg = (rawPostData as Record<string, unknown>)._zernioError
    console.error('[zernio/social] Zernio analytics error:', errMsg)
    return NextResponse.json({ error: 'zernio_api_error', detail: errMsg }, { status: 502 })
  }

  // Diagnostic logs — remove once field names are confirmed
  console.log('[zernio/social] followerStats:', JSON.stringify(followerStatsRaw).slice(0, 800))
  console.log('[zernio/social] allAccounts:', JSON.stringify(allAccountsRaw).slice(0, 800))

  // ── 2. Resolve accountId for daily/best-time calls ───────────────────────────
  // Try profile-scoped accounts first; fall back to extracting from post platform data
  let accounts = await publisher.getProfileAccounts(profileId)

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
  }

  const accountIds = accounts.map(a => a.id).filter(Boolean)

  // ── 3. Daily time series + best-time heatmap (fail soft) ─────────────────────
  const [dailyData, bestTimesData] = await Promise.all([
    accountIds.length > 0
      ? publisher.getDailyAnalytics({ accountId: accountIds[0], days })
      : Promise.resolve(null),
    accountIds.length > 0
      ? publisher.getBestTimeToPost({ accountId: accounts[0].id, platform: platform ?? accounts[0].platform })
      : Promise.resolve(null),
  ])

  return NextResponse.json({
    posts:         rawPostData,
    daily:         dailyData,
    followerStats: followerStatsRaw,
    allAccounts:   allAccountsRaw,
    bestTimes:     bestTimesData,
  })
}
