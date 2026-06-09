import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import * as publisher from '@/lib/social/publisher'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const dateRange = searchParams.get('dateRange') ?? '30d'
  const platform = searchParams.get('platform') ?? undefined

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
  const { fromDate, toDate } = publisher.dateRangeToWindow(dateRange)

  const [rawPostData, accounts, dailyData, followerStats, bestTimesData, postingFrequencyData, contentDecayData] = await Promise.all([
    publisher.getSocialAnalytics({ profileId, platform, fromDate, toDate }),
    publisher.getProfileAccounts(profileId),
    publisher.getDailyAnalytics({ profileId, platform, fromDate, toDate }),
    platform
      ? Promise.resolve(null)
      : publisher.getFollowerStats({ profileId, fromDate, toDate, granularity: 'daily' }),
    publisher.getBestTimeToPost({
      profileId,
      platform,
    }),
    publisher.getPostingFrequency({
      profileId,
      platform,
    }),
    publisher.getContentDecay({
      profileId,
      platform,
    }),
  ])

  if (typeof rawPostData === 'object' && rawPostData !== null && '_zernioError' in rawPostData) {
    const errMsg = (rawPostData as Record<string, unknown>)._zernioError
    console.error('[zernio/social] Zernio analytics error:', errMsg)
    return NextResponse.json({ error: 'zernio_api_error', detail: errMsg }, { status: 502 })
  }

  let resolvedAccounts = accounts

  // Fallback: extract account IDs from post platformAnalytics when /accounts is empty.
  if (resolvedAccounts.length === 0 && rawPostData) {
    type PlatformEntry = { accountId?: string; platform?: string; accountUsername?: string }
    type PostEntry = { platformAnalytics?: PlatformEntry[] }
    const postsArr: PostEntry[] = (rawPostData as { posts?: PostEntry[] })?.posts ?? []
    const seen = new Set<string>()
    for (const post of postsArr) {
      for (const entry of (post.platformAnalytics ?? [])) {
        if (entry.accountId && !seen.has(entry.accountId)) {
          seen.add(entry.accountId)
          resolvedAccounts.push({ id: entry.accountId, platform: entry.platform ?? '', username: entry.accountUsername ?? '' })
        }
      }
    }
  }

  const accountIds = resolvedAccounts.map(a => a.id).filter(Boolean)
  const platformAccountIds = platform
    ? resolvedAccounts.filter(a => a.platform === platform).map(a => a.id).filter(Boolean)
    : accountIds

  // If follower stats did not return with the first pass, fall back to the known connected accounts.
  let normalizedFollowerStats = followerStats
  if (platform && platformAccountIds.length > 0) {
    const filteredStats = await publisher.getFollowerStats({
      profileId,
      accountIds: platformAccountIds,
      fromDate,
      toDate,
      granularity: 'daily',
    })
    normalizedFollowerStats = filteredStats ?? normalizedFollowerStats
  }
  if (!normalizedFollowerStats && accountIds.length > 0) {
    normalizedFollowerStats = await publisher.getFollowerStats({
      profileId,
      accountIds,
      fromDate,
      toDate,
      granularity: 'daily',
    })
  }

  const normalizedDaily = dailyData && typeof dailyData === 'object'
    ? (() => {
        const d = dailyData as Record<string, unknown>
        return {
          stats: d.dailyData ?? d.stats ?? d.data ?? [],
          platformBreakdown: d.platformBreakdown ?? d.platform_breakdown ?? [],
        }
      })()
    : null

  console.log('[zernio/social] followerStats:', JSON.stringify(normalizedFollowerStats).slice(0, 800))
  console.log('[zernio/social] allAccounts:', JSON.stringify(resolvedAccounts).slice(0, 800))
  if (bestTimesData) {
    console.log('[zernio/social] bestTimes response:', JSON.stringify(bestTimesData).slice(0, 500))
  }

  return NextResponse.json({
    posts: rawPostData,
    daily: normalizedDaily,
    followerStats: normalizedFollowerStats,
    allAccounts: resolvedAccounts,
    bestTimes: bestTimesData,
    postingFrequency: postingFrequencyData,
    contentDecay: contentDecayData,
  })
}
