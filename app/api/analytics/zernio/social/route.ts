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
    .select('plan, zernio_profile_id, zernio_profile_ids')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile?.plan) {
    return NextResponse.json({ error: 'active_plan_required' }, { status: 403 })
  }

  // Support multiple profiles (fan out and merge)
  const zernioProfileIds = (profile.zernio_profile_ids as string[] | null) ?? []
  if (profile.zernio_profile_id && !zernioProfileIds.includes(profile.zernio_profile_id)) {
    zernioProfileIds.push(profile.zernio_profile_id)
  }

  if (zernioProfileIds.length === 0) {
    return NextResponse.json({ error: 'not_connected' }, { status: 404 })
  }

  const { fromDate, toDate } = publisher.dateRangeToWindow(dateRange)

  // Fan out API requests to all of a user's Zernio profiles
  const results = await Promise.all(
    zernioProfileIds.map(async (pId) => {
      try {
        const [rawPostData, accounts, dailyData, followerStats, bestTimesData, postingFrequencyData, contentDecayData] = await Promise.all([
          publisher.getSocialAnalytics({ profileId: pId, platform, fromDate, toDate }),
          publisher.getProfileAccounts(pId),
          publisher.getDailyAnalytics({ profileId: pId, platform, fromDate, toDate }),
          platform
            ? Promise.resolve(null)
            : publisher.getFollowerStats({ profileId: pId, fromDate, toDate, granularity: 'daily' }),
          publisher.getBestTimeToPost({ profileId: pId, platform }),
          publisher.getPostingFrequency({ profileId: pId, platform }),
          publisher.getContentDecay({ profileId: pId, platform }),
        ])
        return { pId, rawPostData, accounts, dailyData, followerStats, bestTimesData, postingFrequencyData, contentDecayData }
      } catch (err) {
        console.error(`[zernio/social] Failed fetching for profile ${pId}:`, err)
        return null
      }
    })
  )

  const activeResults = results.filter((r): r is NonNullable<typeof r> => r !== null)

  if (activeResults.length === 0) {
    return NextResponse.json({ error: 'zernio_api_error', detail: 'All profile requests failed.' }, { status: 502 })
  }

  // 1. Merge post analytics (rawPostData)
  let mergedOverview = { totalPosts: 0, publishedPosts: 0, scheduledPosts: 0, lastSync: new Date().toISOString() }
  const mergedPosts: any[] = []
  const mergedAccountsList: any[] = []

  for (const r of activeResults) {
    const rawPostData = r.rawPostData
    if (typeof rawPostData === 'object' && rawPostData !== null && !('_zernioError' in rawPostData)) {
      const envelope = rawPostData as Record<string, any>
      const postsEnvelope = ('posts' in envelope ? envelope.posts : (envelope.data ?? envelope.result ?? envelope.response ?? envelope)) as Record<string, any>
      if (postsEnvelope) {
        const overview = (postsEnvelope.overview ?? postsEnvelope.summary ?? postsEnvelope.stats ?? postsEnvelope ?? {}) as Record<string, any>
        const postsArr = (postsEnvelope.posts ?? postsEnvelope.items ?? []) as any[]
        const accountsArr = (envelope.accounts ?? []) as any[]

        mergedOverview.totalPosts += typeof overview.totalPosts === 'number' ? overview.totalPosts : 0
        mergedOverview.publishedPosts += typeof overview.publishedPosts === 'number' ? overview.publishedPosts : 0
        mergedOverview.scheduledPosts += typeof overview.scheduledPosts === 'number' ? overview.scheduledPosts : 0

        mergedPosts.push(...postsArr)
        mergedAccountsList.push(...accountsArr)
      }
    }
  }

  // De-duplicate posts by _id / id
  const seenPosts = new Set<string>()
  const uniquePosts: any[] = []
  for (const p of mergedPosts) {
    const id = p._id ?? p.id
    if (id && !seenPosts.has(id)) {
      seenPosts.add(id)
      uniquePosts.push(p)
    }
  }
  // Sort posts by date descending
  uniquePosts.sort((a, b) => {
    const dateA = new Date(a.publishedAt ?? a.published_at ?? a.date ?? 0).getTime()
    const dateB = new Date(b.publishedAt ?? b.published_at ?? b.date ?? 0).getTime()
    return dateB - dateA
  })

  // De-duplicate accounts listed in post payload
  const seenAccs = new Set<string>()
  const uniqueAccsList: any[] = []
  for (const a of mergedAccountsList) {
    const id = a._id ?? a.id
    if (id && !seenAccs.has(id)) {
      seenAccs.add(id)
      uniqueAccsList.push(a)
    }
  }

  const finalRawPostData = {
    overview: mergedOverview,
    posts: uniquePosts,
    accounts: uniqueAccsList,
    pagination: { page: 1, limit: 100, total: uniquePosts.length, pages: 1 }
  }

  // 2. Merge accounts list
  const mergedAccounts: any[] = []
  for (const r of activeResults) {
    if (Array.isArray(r.accounts)) {
      mergedAccounts.push(...r.accounts)
    }
  }
  const seenProfileAccs = new Set<string>()
  const uniqueProfileAccs: any[] = []
  for (const a of mergedAccounts) {
    if (a.id && !seenProfileAccs.has(a.id)) {
      seenProfileAccs.add(a.id)
      uniqueProfileAccs.push(a)
    }
  }

  // 3. Merge daily aggregation data
  const dailyDataMap = new Map<string, any>()
  const platformBreakdownMap = new Map<string, any>()

  for (const r of activeResults) {
    const d = r.dailyData as Record<string, any> | null
    if (d && typeof d === 'object') {
      const stats = (d.dailyData ?? d.stats ?? d.data ?? []) as any[]
      const platformBreakdown = (d.platformBreakdown ?? d.platform_breakdown ?? []) as any[]

      for (const stat of stats) {
        const date = stat.date ?? ''
        if (!date) continue
        const metrics = (stat.metrics ?? stat.metric ?? stat.data ?? stat.stats ?? {}) as Record<string, any>

        if (!dailyDataMap.has(date)) {
          dailyDataMap.set(date, {
            date,
            postCount: 0,
            platforms: {} as Record<string, number>,
            metrics: {
              impressions: 0,
              reach: 0,
              likes: 0,
              comments: 0,
              shares: 0,
              saves: 0,
              clicks: 0,
              views: 0
            }
          })
        }
        const current = dailyDataMap.get(date)
        current.postCount += typeof stat.postCount === 'number' ? stat.postCount : (stat.post_count ?? stat.posts ?? 0)

        // Merge platforms map
        const platforms = (stat.platforms ?? {}) as Record<string, number>
        for (const [k, v] of Object.entries(platforms)) {
          current.platforms[k] = (current.platforms[k] ?? 0) + v
        }

        // Merge metrics
        current.metrics.impressions += typeof metrics.impressions === 'number' ? metrics.impressions : (stat.impressions ?? 0)
        current.metrics.reach += typeof metrics.reach === 'number' ? metrics.reach : (stat.reach ?? 0)
        current.metrics.likes += typeof metrics.likes === 'number' ? metrics.likes : (stat.likes ?? 0)
        current.metrics.comments += typeof metrics.comments === 'number' ? metrics.comments : (stat.comments ?? 0)
        current.metrics.shares += typeof metrics.shares === 'number' ? metrics.shares : (stat.shares ?? 0)
        current.metrics.saves += typeof metrics.saves === 'number' ? metrics.saves : (stat.saves ?? 0)
        current.metrics.clicks += typeof metrics.clicks === 'number' ? metrics.clicks : (stat.clicks ?? 0)
        current.metrics.views += typeof metrics.views === 'number' ? metrics.views : (stat.views ?? 0)
      }

      for (const breakdown of platformBreakdown) {
        const pl = breakdown.platform ?? ''
        if (!pl) continue
        if (!platformBreakdownMap.has(pl)) {
          platformBreakdownMap.set(pl, {
            platform: pl,
            postCount: 0,
            impressions: 0,
            reach: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            saves: 0,
            clicks: 0,
            views: 0
          })
        }
        const current = platformBreakdownMap.get(pl)
        current.postCount += typeof breakdown.postCount === 'number' ? breakdown.postCount : (breakdown.post_count ?? breakdown.posts ?? 0)
        current.impressions += typeof breakdown.impressions === 'number' ? breakdown.impressions : 0
        current.reach += typeof breakdown.reach === 'number' ? breakdown.reach : 0
        current.likes += typeof breakdown.likes === 'number' ? breakdown.likes : 0
        current.comments += typeof breakdown.comments === 'number' ? breakdown.comments : 0
        current.shares += typeof breakdown.shares === 'number' ? breakdown.shares : 0
        current.saves += typeof breakdown.saves === 'number' ? breakdown.saves : 0
        current.clicks += typeof breakdown.clicks === 'number' ? breakdown.clicks : 0
        current.views += typeof breakdown.views === 'number' ? breakdown.views : 0
      }
    }
  }

  const mergedDailyData = Array.from(dailyDataMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  const mergedPlatformBreakdown = Array.from(platformBreakdownMap.values())
  const finalDailyData = {
    stats: mergedDailyData,
    platformBreakdown: mergedPlatformBreakdown
  }

  // 4. Merge follower stats
  const mergedFsAccounts: any[] = []
  const mergedFsStats: Record<string, any[]> = {}

  for (const r of activeResults) {
    const fs = r.followerStats as Record<string, any> | null
    if (fs && typeof fs === 'object') {
      const fsAccounts = (fs.accounts ?? []) as any[]
      const fsStats = (fs.stats ?? {}) as Record<string, any[]>

      mergedFsAccounts.push(...fsAccounts)
      for (const [accId, series] of Object.entries(fsStats)) {
        mergedFsStats[accId] = series
      }
    }
  }

  const seenFsAccs = new Set<string>()
  const uniqueFsAccs: any[] = []
  for (const a of mergedFsAccounts) {
    const id = a._id ?? a.id
    if (id && !seenFsAccs.has(id)) {
      seenFsAccs.add(id)
      uniqueFsAccs.push(a)
    }
  }

  let finalFollowerStats: any = uniqueFsAccs.length > 0 ? {
    accounts: uniqueFsAccs,
    stats: mergedFsStats
  } : null

  // 5. Merge bestTimes
  const bestTimesMap = new Map<string, { day_of_week: number, hour: number, sum_engagement: number, sum_posts: number }>()
  for (const r of activeResults) {
    const bt = r.bestTimesData as Record<string, any> | null
    if (bt && typeof bt === 'object') {
      const slots = (bt.slots ?? bt.data ?? bt.times ?? bt.results ?? []) as any[]
      for (const slot of slots) {
        const rawDay = typeof slot.day_of_week === 'number' ? slot.day_of_week : (slot.dayOfWeek ?? slot.day_index ?? slot.dayIndex ?? slot.day ?? 0)
        const hour = typeof slot.hour === 'number' ? slot.hour : (slot.hour_of_day ?? slot.hourOfDay ?? slot.time ?? 0)
        const engagement = typeof slot.avg_engagement === 'number' ? slot.avg_engagement : (slot.avgEngagement ?? slot.avg_engagement_rate ?? slot.avgEngagementRate ?? slot.engagement ?? slot.value ?? 0)
        const posts = typeof slot.post_count === 'number' ? slot.post_count : (slot.postCount ?? slot.posts ?? 1)

        const key = `${rawDay}-${hour}`
        if (!bestTimesMap.has(key)) {
          bestTimesMap.set(key, { day_of_week: rawDay, hour, sum_engagement: 0, sum_posts: 0 })
        }
        const current = bestTimesMap.get(key)!
        current.sum_engagement += engagement * posts
        current.sum_posts += posts
      }
    }
  }
  const finalBestTimes = {
    slots: Array.from(bestTimesMap.values()).map(x => ({
      day_of_week: x.day_of_week,
      hour: x.hour,
      avg_engagement: x.sum_posts > 0 ? Number((x.sum_engagement / x.sum_posts).toFixed(2)) : 0,
      post_count: x.sum_posts
    }))
  }

  // 6. Merge posting frequency
  const frequencyMap = new Map<string, { platform: string, posts_per_week: number, sum_engagement_rate: number, sum_engagement: number, sum_weeks: number }>()
  for (const r of activeResults) {
    const pf = r.postingFrequencyData as Record<string, any> | null
    if (pf && typeof pf === 'object') {
      const items = (pf.frequency ?? pf.points ?? pf.data ?? pf.results ?? []) as any[]
      for (const item of items) {
        const pl = item.platform ?? ''
        const posts_per_week = typeof item.posts_per_week === 'number' ? item.posts_per_week : (item.postsPerWeek ?? item.frequency ?? item.weeklyPosts ?? 0)
        const er = typeof item.avg_engagement_rate === 'number' ? item.avg_engagement_rate : (item.avgEngagementRate ?? item.engagementRate ?? item.er ?? 0)
        const eng = typeof item.avg_engagement === 'number' ? item.avg_engagement : (item.avgEngagement ?? 0)
        const weeks = typeof item.weeks_count === 'number' ? item.weeks_count : (item.weeksCount ?? 1)

        const key = `${pl}-${posts_per_week}`
        if (!frequencyMap.has(key)) {
          frequencyMap.set(key, { platform: pl, posts_per_week, sum_engagement_rate: 0, sum_engagement: 0, sum_weeks: 0 })
        }
        const current = frequencyMap.get(key)!
        current.sum_engagement_rate += er * weeks
        current.sum_engagement += eng * weeks
        current.sum_weeks += weeks
      }
    }
  }
  const finalPostingFrequency = {
    frequency: Array.from(frequencyMap.values()).map(x => ({
      platform: x.platform,
      posts_per_week: x.posts_per_week,
      avg_engagement_rate: x.sum_weeks > 0 ? Number((x.sum_engagement_rate / x.sum_weeks).toFixed(2)) : 0,
      avg_engagement: x.sum_weeks > 0 ? Number((x.sum_engagement / x.sum_weeks).toFixed(2)) : 0,
      weeks_count: x.sum_weeks
    }))
  }

  // 7. Merge content decay
  const decayMap = new Map<number, { bucket_order: number, bucket_label: string, sum_pct_of_final: number, sum_posts: number }>()
  for (const r of activeResults) {
    const cd = r.contentDecayData as Record<string, any> | null
    if (cd && typeof cd === 'object') {
      const buckets = (cd.buckets ?? cd.data ?? cd.results ?? []) as any[]
      for (const b of buckets) {
        const order = typeof b.bucket_order === 'number' ? b.bucket_order : (b.bucketOrder ?? 0)
        const label = b.bucket_label ?? b.label ?? b.time ?? b.bucket ?? b.range ?? ''
        const pct = typeof b.avg_pct_of_final === 'number' ? b.avg_pct_of_final : (b.avgPctOfFinal ?? b.pct ?? b.percentage ?? b.value ?? 0)
        const posts = typeof b.post_count === 'number' ? b.post_count : (b.postCount ?? 1)

        if (!decayMap.has(order)) {
          decayMap.set(order, { bucket_order: order, bucket_label: label, sum_pct_of_final: 0, sum_posts: 0 })
        }
        const current = decayMap.get(order)!
        current.sum_pct_of_final += pct * posts
        current.sum_posts += posts
      }
    }
  }
  const finalContentDecay = {
    buckets: Array.from(decayMap.values())
      .sort((a, b) => a.bucket_order - b.bucket_order)
      .map(x => ({
        bucket_order: x.bucket_order,
        bucket_label: x.bucket_label,
        avg_pct_of_final: x.sum_posts > 0 ? Number((x.sum_pct_of_final / x.sum_posts).toFixed(2)) : 0,
        post_count: x.sum_posts
      }))
  }

  const resolvedAccounts = uniqueProfileAccs

  // Fallback: extract account IDs from post platforms when /accounts is empty.
  if (resolvedAccounts.length === 0 && finalRawPostData) {
    type PlatformEntry = { accountId?: string; platform?: string; accountUsername?: string }
    type PostEntry = { platformAnalytics?: PlatformEntry[]; platforms?: PlatformEntry[] }
    const postsArr: PostEntry[] = finalRawPostData.posts ?? []
    const seen = new Set<string>()
    for (const post of postsArr) {
      const targets = post.platforms ?? post.platformAnalytics ?? []
      for (const entry of targets) {
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
  if (!finalFollowerStats && accountIds.length > 0) {
    const primaryProfileId = zernioProfileIds[0]
    const filteredStats = await publisher.getFollowerStats({
      profileId: primaryProfileId,
      accountIds: platform ? platformAccountIds : accountIds,
      fromDate,
      toDate,
      granularity: 'daily',
    })
    if (filteredStats) {
      finalFollowerStats = filteredStats
    }
  }

  console.log('[zernio/social] followerStats:', JSON.stringify(finalFollowerStats).slice(0, 800))
  console.log('[zernio/social] allAccounts:', JSON.stringify(resolvedAccounts).slice(0, 800))

  return NextResponse.json({
    posts: finalRawPostData,
    daily: finalDailyData,
    followerStats: finalFollowerStats,
    allAccounts: resolvedAccounts,
    bestTimes: finalBestTimes,
    postingFrequency: finalPostingFrequency,
    contentDecay: finalContentDecay,
  })
}
