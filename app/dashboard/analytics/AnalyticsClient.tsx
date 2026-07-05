'use client'

import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ZAxis,
} from 'recharts'
import {
  Globe, X, CheckCircle, ChevronDown, ChevronUp, Sparkles,
  Plus, ArrowUpRight, ArrowDownRight, Eye, Users, FileText,
  ExternalLink, Info, Heart, MessageCircle, Share2, Bookmark,
  MousePointerClick, TrendingUp,
} from 'lucide-react'
import type { AnalyticsDataState } from './page'
import {
  MOCK_ANALYTICS_INBOX, MOCK_POSTING_ANALYTICS, MOCK_GA_DATA,
} from '@/lib/analytics/mockData'
import { parseAnalyticsEnvelope, platformMatches, readBestPostUrl } from '@/lib/social/zernioAnalyticsParse'
import { emptyAnalyticsInbox, type AnalyticsInboxData } from '@/lib/social/zernioInboxParse'
import {
  canConnectSocialPlatform,
  isGrowthPlusPlan,
  platformRequiresGrowthPlus,
  X_CONNECT_GROWTH_GATE_MESSAGE,
} from '@/lib/social/platformGates'
import type { ZernioConnectedAccountInfo } from '@/lib/social/zernioShared'
import {
  isMetaOAuthPlatform,
  MetaConnectDisclosureModal,
  SocialMetaConnectNotice,
} from '@/components/social/MetaConnectDisclosure'
import { useMayaContext } from '@/hooks/useMayaContext'
import { buildAnalyticsMayaContext } from '@/lib/maya/summaries/analyticsContext'

// ── Posting data context ───────────────────────────────────────────────────────

type PostingAnalytics = typeof MOCK_POSTING_ANALYTICS

/** Zeroed shell for live Zernio data — never bleed mock numbers into production analytics */
function emptyLivePostingAnalytics(): PostingAnalytics {
  const zeroMatrix = Array.from({ length: 7 }, () => Array(8).fill(0))
  return {
    stats: {
      engagementRate: 0,
      engRateDelta: 'new',
      engRateDeltaPositive: true,
      totalReach: 0,
      reachDelta: 'new',
      reachDeltaPositive: true,
      totalFollowers: 0,
      followersDelta: '0 in last 30d',
      followersDeltaPositive: true,
      postsThisPeriod: 0,
      bestPost: { caption: '', platform: '', engagements: 0 },
    },
    monthly: [],
    platformPosts: [],
    platformLikes: [],
    heatmap: {
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      times: ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'],
      data: zeroMatrix,
      bestDay: '',
      bestTime: '',
    },
    followerEvolution: [],
    platformBreakdown: [],
    topPosts: [],
    postingFrequency: [],
    optimalCadence: [],
    engagementAccumulation: [],
    halfEngagementTime: '',
    eightyPctTime: '',
  }
}

function initialPostingData(dataState: AnalyticsDataState): PostingAnalytics {
  return dataState === 'mock' ? MOCK_POSTING_ANALYTICS : emptyLivePostingAnalytics()
}

function initialInboxData(dataState: AnalyticsDataState): AnalyticsInboxData {
  return dataState === 'mock' ? MOCK_ANALYTICS_INBOX : emptyAnalyticsInbox()
}

const PostingDataContext = createContext<PostingAnalytics>(MOCK_POSTING_ANALYTICS)
const DateRangeContext   = createContext<string>('30d')

// ── Zernio response helpers ────────────────────────────────────────────────────

function _n(v: unknown): number { return typeof v === 'number' ? v : (Number(v) || 0) }
function _s(v: unknown): string { return typeof v === 'string' ? v : String(v ?? '') }
function _a<T>(v: unknown): T[] { return Array.isArray(v) ? (v as T[]) : [] }
function _o(v: unknown): Record<string, unknown> {
  return (v && typeof v === 'object' && !Array.isArray(v)) ? (v as Record<string, unknown>) : {}
}

function readFollowerCount(entry: unknown): number {
  const obj = _o(entry)
  const nested = _o(obj.account ?? obj.metrics ?? obj.profile ?? obj)
  return _n(
    obj.currentFollowers ??
    obj.current_followers ??
    obj.followers ??
    obj.followersCount ??
    obj.followers_count ??
    obj.count ??
    nested.currentFollowers ??
    nested.current_followers ??
    nested.followers ??
    nested.followersCount ??
    nested.followers_count ??
    nested.followerCount ??
    nested.follower_count ??
    0,
  )
}

function readNumericGrowth(entry: unknown): number | null {
  const obj = _o(entry)
  const nested = _o(obj.account ?? obj.metrics ?? obj.profile ?? obj)
  const candidates = [
    obj.growth,
    obj.growthCount,
    obj.followerGrowth,
    obj.followerGrowthCount,
    obj.delta,
    nested.growth,
    nested.growthCount,
    nested.followerGrowth,
    nested.followerGrowthCount,
    nested.delta,
  ]
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function readEngagementCount(entry: unknown): number {
  const obj = _o(entry)
  const analytics = _o(obj.analytics)
  const candidates = [
    analytics.engagements,
    analytics.engagementCount,
    analytics.totalEngagements,
    analytics.engagement_total,
    analytics.interactions,
    obj.engagements,
    obj.engagementCount,
    obj.totalEngagements,
  ]
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return (
    _n(analytics.likes ?? 0) +
    _n(analytics.comments ?? 0) +
    _n(analytics.shares ?? 0) +
    _n(analytics.saves ?? 0) +
    _n(analytics.clicks ?? 0)
  )
}

function readDailyMetrics(entry: unknown): Record<string, unknown> {
  const obj = _o(entry)
  return _o(obj.metrics ?? obj.metric ?? obj.data ?? obj.stats)
}

function pctFromValue(value: unknown): number {
  const n = _n(value)
  if (!n) return 0
  return n <= 1 ? n * 100 : n
}

function bucketLabelForPostsPerWeek(postsPerWeek: number): { x: number; label: string } {
  if (postsPerWeek < 1) return { x: 1, label: '< 1/wk' }
  if (postsPerWeek < 3) return { x: 2, label: '1–2/wk' }
  if (postsPerWeek < 5) return { x: 3, label: '3–4/wk' }
  return { x: 4, label: '5+/wk' }
}

function normalizeDayIndex(day: number): number {
  if (!Number.isFinite(day)) return 0
  // Zernio best-time slots: 0 = Monday … 6 = Sunday (matches heatmap row order)
  if (day >= 0 && day <= 6) return day
  return ((day % 7) + 7) % 7
}

function formatHeatmapHour(hour: number): string {
  const h = Math.max(0, Math.min(23, Math.round(hour))) % 24
  if (h === 0) return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

function hourToHeatmapIndex(hour: number): number {
  if (!Number.isFinite(hour)) return 0
  const rounded = Math.max(0, Math.min(23, Math.round(hour)))
  const buckets = [0, 3, 6, 9, 12, 15, 18, 21]
  let best = 0
  let bestDiff = Number.POSITIVE_INFINITY
  for (let i = 0; i < buckets.length; i++) {
    const diff = Math.abs(rounded - buckets[i])
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    }
  }
  return best
}

function dateRangeWindow(dateRange: string): { fromDate: Date; toDate: Date; days: number } {
  const days =
    dateRange === '7d'  ? 7 :
    dateRange === '30d' ? 30 :
    dateRange === '90d' ? 90 :
    dateRange === '6m'  ? 180 :
    dateRange === '1y'  ? 365 :
    30

  const end = new Date()
  const toDate = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
  const fromDate = new Date(toDate)
  fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1))
  return { fromDate, toDate, days }
}

type DailyMetricRow = {
  date: Date
  dateStr: string
  posts: number
  likes: number
  comments: number
  shares: number
  saves: number
  views: number
  impressions: number
  reach: number
  clicks: number
}

function aggregateDailyRows(rows: DailyMetricRow[], label: string) {
  const sumPosts = rows.reduce((s, d) => s + d.posts, 0)
  const sumLikes = rows.reduce((s, d) => s + d.likes, 0)
  const sumComments = rows.reduce((s, d) => s + d.comments, 0)
  const sumShares = rows.reduce((s, d) => s + d.shares, 0)
  const sumSaves = rows.reduce((s, d) => s + d.saves, 0)
  const sumViews = rows.reduce((s, d) => s + d.views, 0)
  const sumImpressions = rows.reduce((s, d) => s + d.impressions, 0)
  const sumReach = rows.reduce((s, d) => s + d.reach, 0)
  const sumClicks = rows.reduce((s, d) => s + d.clicks, 0)
  const er = sumReach > 0
    ? Number((((sumLikes + sumComments + sumShares + sumSaves + sumClicks) / sumReach) * 100).toFixed(2))
    : 0
  return {
    month: label,
    posts: sumPosts,
    likes: sumLikes,
    comments: sumComments,
    shares: sumShares,
    saves: sumSaves,
    views: sumViews,
    impressions: sumImpressions,
    reach: sumReach,
    clicks: sumClicks,
    engRate: er,
  }
}

function bucketDailyStats(dailyStats: unknown[], postsByDate: Map<string, number>, dateRange: string) {
  const byDate = new Map<string, DailyMetricRow>()
  for (const stat of _a<Record<string, unknown>>(dailyStats)) {
    const dateStr = _s(stat.date ?? '')
    if (!dateStr) continue
    const date = new Date(`${dateStr}T00:00:00.000Z`)
    if (isNaN(date.getTime())) continue
    const metrics = readDailyMetrics(stat)
    byDate.set(dateStr, {
      date,
      dateStr,
      posts: postsByDate.get(dateStr) ?? _n(stat.posts ?? stat.postCount ?? stat.post_count ?? metrics.posts ?? 0),
      likes: _n(metrics.likes ?? stat.likes ?? 0),
      comments: _n(metrics.comments ?? stat.comments ?? 0),
      shares: _n(metrics.shares ?? stat.shares ?? 0),
      saves: _n(metrics.saves ?? stat.saves ?? 0),
      views: _n(metrics.views ?? stat.views ?? 0),
      impressions: _n(metrics.impressions ?? stat.impressions ?? 0),
      reach: _n(metrics.reach ?? stat.reach ?? 0),
      clicks: _n(metrics.clicks ?? stat.clicks ?? 0),
    })
  }

  const { fromDate, toDate } = dateRangeWindow(dateRange)
  const allDays: DailyMetricRow[] = []
  const cursor = new Date(fromDate)
  while (cursor.getTime() <= toDate.getTime()) {
    const dateStr = cursor.toISOString().slice(0, 10)
    allDays.push(
      byDate.get(dateStr) ?? {
        date: new Date(cursor),
        dateStr,
        posts: postsByDate.get(dateStr) ?? 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        views: 0,
        impressions: 0,
        reach: 0,
        clicks: 0,
      },
    )
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  if (dateRange === '7d') {
    return allDays.map(d => aggregateDailyRows(
      [d],
      d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    ))
  }

  if (dateRange === '6m' || dateRange === '1y') {
    const monthlyGroups = new Map<string, DailyMetricRow[]>()
    for (const d of allDays) {
      const key = d.date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      if (!monthlyGroups.has(key)) monthlyGroups.set(key, [])
      monthlyGroups.get(key)!.push(d)
    }
    return Array.from(monthlyGroups.entries()).map(([month, days]) => aggregateDailyRows(days, month))
  }

  // 30d / 90d — fixed weekly buckets from window start (Zernio-style week labels)
  const weeklyBuckets: DailyMetricRow[][] = []
  for (let i = 0; i < allDays.length; i += 7) {
    weeklyBuckets.push(allDays.slice(i, i + 7))
  }

  return weeklyBuckets.map((bucket) => {
    const label = bucket[0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return aggregateDailyRows(bucket, label)
  })
}

function bucketPostsForMonthly(postsArr: Record<string, unknown>[], dateRange: string) {
  type Bucket = {
    sortKey: number
    posts: number
    likes: number
    comments: number
    shares: number
    saves: number
    views: number
    impressions: number
    reach: number
    clicks: number
    erSum: number
    erCount: number
  }
  const buckets = new Map<string, Bucket>()

  for (const p of postsArr) {
    const rawDate = _s(p.publishedAt ?? p.published_at ?? p.date ?? '')
    if (!rawDate) continue
    const d = new Date(rawDate)
    if (isNaN(d.getTime())) continue

    let label: string
    let sortKey: number

    if (dateRange === '7d') {
      label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      sortKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    } else if (dateRange === '6m' || dateRange === '1y') {
      label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      sortKey = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
    } else {
      const dow = (d.getDay() + 6) % 7
      const mon = new Date(d)
      mon.setDate(d.getDate() - dow)
      mon.setHours(0, 0, 0, 0)
      label = mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      sortKey = mon.getTime()
    }

    if (!buckets.has(label)) {
      buckets.set(label, {
        sortKey,
        posts: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        views: 0,
        impressions: 0,
        reach: 0,
        clicks: 0,
        erSum: 0,
        erCount: 0,
      })
    }
    const b = buckets.get(label)!
    const a = _o(p.analytics)
    b.posts++
    b.likes += _n(a.likes ?? 0)
    b.comments += _n(a.comments ?? 0)
    b.shares += _n(a.shares ?? 0)
    b.saves += _n(a.saves ?? 0)
    b.views += _n(a.views ?? 0)
    b.impressions += _n(a.impressions ?? 0)
    b.reach += _n(a.reach ?? 0)
    b.clicks += _n(a.clicks ?? 0)
    const er = _n(a.engagementRate ?? 0)
    if (er > 0) {
      b.erSum += er
      b.erCount++
    }
  }

  return Array.from(buckets.entries())
    .sort(([, a], [, b]) => a.sortKey - b.sortKey)
    .map(([month, b]) => ({
      month,
      posts: b.posts,
      likes: b.likes,
      comments: b.comments,
      shares: b.shares,
      saves: b.saves,
      views: b.views,
      impressions: b.impressions,
      reach: b.reach,
      clicks: b.clicks,
      engRate: b.erCount > 0 ? b.erSum / b.erCount : 0,
    }))
}

function mapZernioResponse(raw: unknown, dateRange = '30d', activePlatform = 'all'): PostingAnalytics | null {
  if (!raw || typeof raw !== 'object') return null
  const r = _o(raw)

  // ── Combined response shape: { posts, daily, followerStats, allAccounts, bestTimes } ──
  // `posts`        — legacy /analytics response (overview + posts array)
  // `daily`        — /analytics/daily-metrics  { stats: [...] }
  // `followerStats`— /accounts/follower-stats  (dedicated follower count endpoint)
  // `allAccounts`  — /accounts  (API-key scoped, all profiles)
  // `bestTimes`    — /analytics/best-time
  const hasCombined = 'posts' in r && ('daily' in r || 'followerStats' in r || 'allAccounts' in r)

  // Extract posts — combined route wraps { overview, posts[], accounts[] }
  const rawPostsBlock = hasCombined ? _o(r.posts) : _o(r.data ?? r.result ?? r.response ?? r)
  const parsedPosts = hasCombined
    ? parseAnalyticsEnvelope({ overview: rawPostsBlock.overview, posts: rawPostsBlock.posts, accounts: rawPostsBlock.accounts ?? r.allAccounts })
    : parseAnalyticsEnvelope(r)
  const overview = parsedPosts.overview
  const postsArr = _a<Record<string, unknown>>(parsedPosts.posts)
  const platformFilter = activePlatform !== 'all' ? activePlatform.toLowerCase() : ''
  const dailyEnvelope = hasCombined ? _o(r.daily) : {}
  const dailyStats = hasCombined
    ? _a<Record<string, unknown>>(dailyEnvelope.stats ?? dailyEnvelope.dailyData ?? dailyEnvelope.data ?? [])
    : []
  const dailyPlatformBreakdown = (hasCombined
    ? _a<Record<string, unknown>>(dailyEnvelope.platformBreakdown ?? dailyEnvelope.platform_breakdown ?? [])
    : []
  ).filter(entry => platformMatches(_s(entry.platform ?? entry.platformName), platformFilter || undefined))
  const bestTimesRaw = hasCombined ? _o(r.bestTimes) : {}
  const postingFrequencyRaw = hasCombined ? _o(r.postingFrequency) : {}
  const contentDecayRaw = hasCombined ? _o(r.contentDecay) : {}
  const followerStatsEntries = hasCombined
    ? _a<Record<string, unknown>>(
        _o(r.followerStats).accounts ?? _o(r.followerStats).data ?? r.followerStats ?? []
      )
    : []

  // Aggregate per-post analytics
  const aggReach   = postsArr.reduce((s, p) => s + _n(_o(p.analytics).reach   ?? 0), 0)
  const erValues   = postsArr.map(p => _n(_o(p.analytics).engagementRate ?? 0)).filter(v => v > 0)
  const aggEngRate = erValues.length ? erValues.reduce((a, b) => a + b, 0) / erValues.length : 0
  const dailyTotals = dailyStats.reduce<{
    posts: number
    likes: number
    comments: number
    shares: number
    saves: number
    clicks: number
    views: number
    impressions: number
    reach: number
    engagements: number
  }>((acc, stat) => {
    const metrics = readDailyMetrics(stat)
    acc.posts += _n(stat.posts ?? stat.postCount ?? stat.post_count ?? metrics.posts ?? 0)
    acc.likes += _n(metrics.likes ?? stat.likes ?? 0)
    acc.comments += _n(metrics.comments ?? stat.comments ?? 0)
    acc.shares += _n(metrics.shares ?? stat.shares ?? 0)
    acc.saves += _n(metrics.saves ?? stat.saves ?? 0)
    acc.clicks += _n(metrics.clicks ?? stat.clicks ?? 0)
    acc.views += _n(metrics.views ?? stat.views ?? 0)
    acc.impressions += _n(metrics.impressions ?? stat.impressions ?? 0)
    acc.reach += _n(metrics.reach ?? stat.reach ?? 0)
    acc.engagements += _n(metrics.likes ?? stat.likes ?? 0) +
      _n(metrics.comments ?? stat.comments ?? 0) +
      _n(metrics.shares ?? stat.shares ?? 0) +
      _n(metrics.saves ?? stat.saves ?? 0) +
      _n(metrics.clicks ?? stat.clicks ?? 0)
    return acc
  }, {
    posts: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    clicks: 0,
    views: 0,
    impressions: 0,
    reach: 0,
    engagements: 0,
  })

  // totalFollowers — read from followerStats (dedicated endpoint) or allAccounts fallback
  let totalFollowers = 0
  if (hasCombined) {
    const fsRaw = r.followerStats
    if (fsRaw && typeof fsRaw === 'object') {
      if (Array.isArray(fsRaw)) {
        for (const entry of (fsRaw as unknown[])) {
          totalFollowers += readFollowerCount(entry)
        }
      } else {
        const fs = _o(fsRaw)
        if (Array.isArray(fs.accounts)) {
          for (const entry of (fs.accounts as unknown[])) {
            totalFollowers += readFollowerCount(entry)
          }
        }
        if (Array.isArray(fs.data)) {
          for (const entry of (fs.data as unknown[])) {
            totalFollowers += readFollowerCount(entry)
          }
        } else {
          totalFollowers = _n(
            fs.total ??
            fs.followers ??
            fs.followersCount ??
            fs.followers_count ??
            fs.currentFollowers ??
            fs.current_followers ??
            0,
          ) || totalFollowers
        }
      }
    }
    // Fall back to allAccounts if followerStats gave 0
    if (totalFollowers === 0 && r.allAccounts) {
      const accsRaw = Array.isArray(r.allAccounts) ? (r.allAccounts as unknown[]) : _a(r.allAccounts)
      for (const entry of accsRaw) {
        if (!entry) continue
        const acct    = _o(_o(entry).account ?? entry)
        const acctPlatform = _s(acct.platform ?? _o(entry).platform)
        if (platformFilter && !platformMatches(acctPlatform, platformFilter)) continue
        const metrics = _o(acct.metrics ?? acct)
        totalFollowers += _n(
          metrics.currentFollowers ??
          metrics.current_followers ??
          metrics.followersCount ??
          metrics.followers_count ??
          metrics.followers ??
          metrics.followerCount ??
          0
        ) || readFollowerCount(entry)
      }
    } else if (platformFilter && r.allAccounts) {
      totalFollowers = 0
      const accsRaw = Array.isArray(r.allAccounts) ? (r.allAccounts as unknown[]) : _a(r.allAccounts)
      for (const entry of accsRaw) {
        if (!entry) continue
        const acct = _o(_o(entry).account ?? entry)
        const acctPlatform = _s(acct.platform ?? _o(entry).platform)
        if (!platformMatches(acctPlatform, platformFilter)) continue
        const metrics = _o(acct.metrics ?? acct)
        totalFollowers += _n(
          metrics.currentFollowers ??
          metrics.current_followers ??
          metrics.followersCount ??
          metrics.followers_count ??
          metrics.followers ??
          metrics.followerCount ??
          0
        ) || readFollowerCount(entry)
      }
    }
  }

  const followerDeltaFromStats = (() => {
    const deltas = followerStatsEntries
      .map(entry => readNumericGrowth(entry))
      .filter((value): value is number => value !== null)
    if (deltas.length) {
      const total = deltas.reduce((sum, value) => sum + value, 0)
      return { value: Math.abs(total), positive: total >= 0 }
    }
    return null
  })()

  // Prefer overview-level fields; fall back to aggregated per-post values
  const postAggReach = postsArr.reduce((s, p) => s + _n(_o(p.analytics).reach ?? 0), 0)
  const postAggEngagements = postsArr.reduce((s, p) => {
    const a = _o(p.analytics)
    return s + _n(a.likes ?? 0) + _n(a.comments ?? 0) + _n(a.shares ?? 0) + _n(a.saves ?? 0) + _n(a.clicks ?? 0)
  }, 0)
  const liveEngRate = platformFilter && postsArr.length
    ? (postAggReach > 0 ? Number(((postAggEngagements / postAggReach) * 100).toFixed(1)) : 0)
    : dailyTotals.reach > 0
      ? Number(((dailyTotals.engagements / dailyTotals.reach) * 100).toFixed(1))
      : 0
  const engRate   = liveEngRate
    || _n(overview.engagementRate ?? overview.engagement_rate ?? overview.er_pct ?? overview.er)
    || aggEngRate
  const reach     = platformFilter && postsArr.length
    ? postAggReach
    : dailyTotals.reach
      || _n(overview.totalReach ?? overview.total_reach ?? overview.reach)
      || aggReach
  const followers = totalFollowers || _n(overview.totalFollowers ?? overview.total_followers ?? overview.followers)
  const posts     = platformFilter && postsArr.length
    ? postsArr.length
    : dailyTotals.posts
      || _n(overview.totalPosts ?? overview.postsCount ?? overview.posts_count ?? overview.total_posts ?? overview.posts)
      || postsArr.length

  // Live-only mapper — never seed from MOCK_POSTING_ANALYTICS; sparse/zero is honest truth.
  const result = emptyLivePostingAnalytics()

  result.stats = {
    ...result.stats,
    engagementRate: engRate,
    engRateDelta: 'new',
    engRateDeltaPositive: true,
    totalReach: reach,
    reachDelta: 'new',
    reachDeltaPositive: true,
    totalFollowers: totalFollowers || followers,
    postsThisPeriod: posts,
  }

  // Platform breakdown — Zernio doesn't pre-aggregate; group from posts[]
  if (dailyPlatformBreakdown.length) {
    result.platformPosts = dailyPlatformBreakdown.map((entry) => {
      const metrics = readDailyMetrics(entry)
      const platform = _s(entry.platform ?? entry.platformName ?? '')
      return {
        platform,
        label:    (PLATFORM_META as Record<string, { label: string }>)[platform]?.label ?? platform,
        posts:    _n(entry.posts ?? entry.postCount ?? entry.post_count ?? metrics.posts ?? 0),
      }
    })
    result.platformLikes = dailyPlatformBreakdown.map((entry) => {
      const metrics = readDailyMetrics(entry)
      const platform = _s(entry.platform ?? entry.platformName ?? '')
      return {
        platform,
        label:    (PLATFORM_META as Record<string, { label: string }>)[platform]?.label ?? platform,
        likes:    _n(metrics.likes ?? entry.likes ?? 0),
      }
    })
    result.platformBreakdown = dailyPlatformBreakdown.map((entry) => {
      const metrics = readDailyMetrics(entry)
      const platform = _s(entry.platform ?? entry.platformName ?? '')
      const reachVal = _n(metrics.reach ?? entry.reach ?? 0)
      const likesVal = _n(metrics.likes ?? entry.likes ?? 0)
      const commentsVal = _n(metrics.comments ?? entry.comments ?? 0)
      const sharesVal = _n(metrics.shares ?? entry.shares ?? 0)
      const savesVal = _n(metrics.saves ?? entry.saves ?? 0)
      const clicksVal = _n(metrics.clicks ?? entry.clicks ?? 0)
      const calculatedErPct = reachVal > 0
        ? Number((((likesVal + commentsVal + sharesVal + savesVal + clicksVal) / reachVal) * 100).toFixed(1))
        : 0
      return {
        platform,
        label:       (PLATFORM_META as Record<string, { label: string }>)[platform]?.label ?? platform,
        posts:       _n(entry.posts ?? entry.postCount ?? entry.post_count ?? metrics.posts ?? 0),
        likes:       likesVal,
        comments:    commentsVal,
        shares:      sharesVal,
        saves:       savesVal,
        clicks:      clicksVal,
        views:       _n(metrics.views ?? entry.views ?? 0),
        impressions: _n(metrics.impressions ?? entry.impressions ?? 0),
        reach:       reachVal,
        erPct:       calculatedErPct,
      }
    })
  } else if (postsArr.length) {
    type PlatAgg = { posts: number; likes: number; comments: number; shares: number; saves: number; clicks: number; views: number; impressions: number; reach: number; erSum: number; erCount: number }
    const byPlatform: Record<string, PlatAgg> = {}
    for (const p of postsArr) {
      const pl = _s(p.platform ?? '')
      if (!pl) continue
      if (!byPlatform[pl]) byPlatform[pl] = { posts: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, views: 0, impressions: 0, reach: 0, erSum: 0, erCount: 0 }
      const a = _o(p.analytics)
      byPlatform[pl].posts++
      byPlatform[pl].likes       += _n(a.likes       ?? 0)
      byPlatform[pl].comments    += _n(a.comments    ?? 0)
      byPlatform[pl].shares      += _n(a.shares      ?? 0)
      byPlatform[pl].saves       += _n(a.saves       ?? 0)
      byPlatform[pl].clicks      += _n(a.clicks      ?? 0)
      byPlatform[pl].views       += _n(a.views       ?? 0)
      byPlatform[pl].impressions += _n(a.impressions ?? 0)
      byPlatform[pl].reach       += _n(a.reach       ?? 0)
      const er = _n(a.engagementRate ?? 0)
      if (er > 0) { byPlatform[pl].erSum += er; byPlatform[pl].erCount++ }
    }
    const platEntries = Object.entries(byPlatform)
    result.platformPosts = platEntries.map(([pl, d]) => ({
      platform: pl,
      label:    (PLATFORM_META as Record<string, { label: string }>)[pl]?.label ?? pl,
      posts:    d.posts,
    }))
    result.platformLikes = platEntries.map(([pl, d]) => ({
      platform: pl,
      label:    (PLATFORM_META as Record<string, { label: string }>)[pl]?.label ?? pl,
      likes:    d.likes,
    }))
    result.platformBreakdown = platEntries.map(([pl, d]) => ({
      platform:    pl,
      label:       (PLATFORM_META as Record<string, { label: string }>)[pl]?.label ?? pl,
      posts:       d.posts,
      likes:       d.likes,
      comments:    d.comments,
      shares:      d.shares,
      saves:       d.saves,
      clicks:      d.clicks,
      views:       d.views,
      impressions: d.impressions,
      reach:       d.reach,
      erPct:       d.reach > 0
        ? Number((((d.likes + d.comments + d.shares + d.saves + d.clicks) / d.reach) * 100).toFixed(1))
        : (d.erCount > 0 ? Number((d.erSum / d.erCount).toFixed(1)) : 0),
    }))
  }

  // Top posts — analytics are nested under p.analytics in Zernio's schema
  type EnrichedPost = PostingAnalytics['topPosts'][number] & { url?: string; engagements?: number }
  if (postsArr.length) {
    const mappedPosts: EnrichedPost[] = postsArr.map(p => {
      const a = _o(p.analytics)
      return {
        platform:    _s(p.platform ?? ''),
        caption:     _s(p.content ?? p.caption ?? p.text ?? p.description ?? ''),
        date:        _s(p.publishedAt ?? p.published_at ?? p.date ?? p.createdAt ?? ''),
        likes:       _n(a.likes       ?? 0),
        comments:    _n(a.comments    ?? 0),
        shares:      _n(a.shares      ?? 0),
        saves:       _n(a.saves       ?? 0),
        clicks:      _n(a.clicks      ?? 0),
        views:       _n(a.views       ?? 0),
        impressions: _n(a.impressions ?? 0),
        reach:       _n(a.reach       ?? 0),
        erPct:       _n(a.engagementRate ?? 0),
        engagements: readEngagementCount(p),
        url:         readBestPostUrl(p, activePlatform !== 'all' ? activePlatform : undefined),
      }
    })
    mappedPosts.sort((a, b) => (b.engagements ?? 0) - (a.engagements ?? 0))
    result.topPosts = mappedPosts.slice(0, 10) as PostingAnalytics['topPosts']
  }

  // Server-resolved best post (authoritative — caption + URL from the same Zernio row).
  const serverBestPost = _o(r.bestPost)
  if (_s(serverBestPost.caption) || _n(serverBestPost.engagements) > 0 || _s(serverBestPost.url)) {
    result.stats = {
      ...result.stats,
      bestPost: {
        caption: _s(serverBestPost.caption),
        platform: _s(serverBestPost.platform),
        engagements: _n(serverBestPost.engagements),
        url: _s(serverBestPost.url) || undefined,
        accountUsername: _s(serverBestPost.accountUsername) || undefined,
      } as PostingAnalytics['stats']['bestPost'],
    }
  } else if (result.topPosts.length) {
    const bestPost = result.topPosts[0] as typeof result.topPosts[number] & { url?: string; engagements?: number }
    result.stats = {
      ...result.stats,
      bestPost: {
        caption: bestPost.caption || result.stats.bestPost.caption,
        platform: bestPost.platform || result.stats.bestPost.platform,
        engagements: bestPost.engagements ?? result.stats.bestPost.engagements,
        url: bestPost.url || undefined,
      } as PostingAnalytics['stats']['bestPost'],
    }
  }

  // ── Time series ────────────────────────────────────────────────────────────────
  // Prefer daily.stats[] (from /analytics/daily) — fill the full date window, zero-padding sparse gaps.
  const postsByDate = new Map<string, number>()
  for (const p of postsArr) {
    const raw = _s(p.publishedAt ?? p.published_at ?? p.date ?? '')
    if (!raw) continue
    const d = new Date(raw)
    if (isNaN(d.getTime())) continue
    const key = d.toISOString().slice(0, 10)
    postsByDate.set(key, (postsByDate.get(key) ?? 0) + 1)
  }

  if (dailyStats.length || hasCombined) {
    result.monthly = platformFilter && postsArr.length
      ? bucketPostsForMonthly(postsArr, dateRange)
      : bucketDailyStats(dailyStats, postsByDate, dateRange)

    // follower evolution — use daily stats if they carry followersCount per day
    const followersByDay = dailyStats
      .map(s => ({
        month:     _s(s.date ?? ''),
        followers: _n(s.followersCount ?? s.followers_count ?? s.followers ?? s.followerCount ?? 0),
      }))
      .filter(f => f.followers > 0)
    if (followersByDay.length) {
      result.followerEvolution = followersByDay
    }
  } else {
    // Legacy path: bucket posts[] by date range granularity
    const apiMonthly = _a<Record<string, unknown>>(
      rawPostsBlock.monthly ?? rawPostsBlock.timeSeries ?? rawPostsBlock.time_series ?? rawPostsBlock.metrics
    )
    if (apiMonthly.length) {
      result.monthly = apiMonthly.map(m => ({
        month:       _s(m.month ?? m.date ?? m.label ?? ''),
        posts:       _n(m.posts ?? m.postsCount ?? 0),
        likes:       _n(m.likes ?? 0),
        comments:    _n(m.comments ?? 0),
        shares:      _n(m.shares ?? 0),
        saves:       _n(m.saves ?? 0),
        views:       _n(m.views ?? 0),
        impressions: _n(m.impressions ?? 0),
        reach:       _n(m.reach ?? 0),
        clicks:      _n(m.clicks ?? 0),
        engRate:     _n(m.engagementRate ?? m.er ?? 0),
      }))
    } else if (postsArr.length) {
      type Bucket = { sortKey: number; posts: number; likes: number; comments: number; shares: number; saves: number; views: number; impressions: number; reach: number; clicks: number; erSum: number; erCount: number }
      const buckets = new Map<string, Bucket>()

      for (const p of postsArr) {
        const rawDate = _s(p.publishedAt ?? p.published_at ?? p.date ?? '')
        if (!rawDate) continue
        const d = new Date(rawDate)
        if (isNaN(d.getTime())) continue

        let label: string
        let sortKey: number

        if (dateRange === '7d') {
          label   = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          sortKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
        } else if (dateRange === '6m' || dateRange === '1y') {
          label   = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
          sortKey = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
        } else {
          const dow = (d.getDay() + 6) % 7
          const mon = new Date(d); mon.setDate(d.getDate() - dow); mon.setHours(0, 0, 0, 0)
          label   = mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          sortKey = mon.getTime()
        }

        if (!buckets.has(label)) buckets.set(label, { sortKey, posts: 0, likes: 0, comments: 0, shares: 0, saves: 0, views: 0, impressions: 0, reach: 0, clicks: 0, erSum: 0, erCount: 0 })
        const b = buckets.get(label)!
        const a = _o(p.analytics)
        b.posts++
        b.likes       += _n(a.likes       ?? 0)
        b.comments    += _n(a.comments    ?? 0)
        b.shares      += _n(a.shares      ?? 0)
        b.saves       += _n(a.saves       ?? 0)
        b.views       += _n(a.views       ?? 0)
        b.impressions += _n(a.impressions ?? 0)
        b.reach       += _n(a.reach       ?? 0)
        b.clicks      += _n(a.clicks      ?? 0)
        const er = _n(a.engagementRate ?? 0)
        if (er > 0) { b.erSum += er; b.erCount++ }
      }

      if (buckets.size > 0) {
        result.monthly = Array.from(buckets.entries())
          .sort(([, a], [, b]) => a.sortKey - b.sortKey)
          .map(([month, b]) => ({
            month,
            posts:       b.posts,
            likes:       b.likes,
            comments:    b.comments,
            shares:      b.shares,
            saves:       b.saves,
            views:       b.views,
            impressions: b.impressions,
            reach:       b.reach,
            clicks:      b.clicks,
            engRate:     b.erCount > 0 ? b.erSum / b.erCount : 0,
          }))
      }
    }

    // Follower evolution from overview data (legacy path)
    const followerEvo = _a<Record<string, unknown>>(
      rawPostsBlock.followerEvolution ?? rawPostsBlock.follower_evolution ??
      rawPostsBlock.followerHistory   ?? rawPostsBlock.followers_history
    )
    if (followerEvo.length) {
      result.followerEvolution = followerEvo.map(f => ({
        month:     _s(f.month ?? f.date ?? f.label ?? ''),
        followers: _n(f.followers ?? 0),
      }))
    }
  }

  // Follower evolution from dedicated follower stats history (preferred live source).
  if (!result.followerEvolution?.length && hasCombined) {
    const followerStatsRaw = _o(r.followerStats)
    const seriesSource = _o(followerStatsRaw.stats ?? followerStatsRaw.history ?? followerStatsRaw.series)
    const entriesByDate = new Map<string, number>()

    for (const value of Object.values(seriesSource)) {
      for (const entry of _a<Record<string, unknown>>(value)) {
        const date = _s(entry.date ?? entry.day ?? entry.month ?? entry.label ?? '')
        if (!date) continue
        const followers = _n(entry.followers ?? entry.currentFollowers ?? entry.followers_count ?? entry.count ?? 0)
        if (!followers) continue
        entriesByDate.set(date, (entriesByDate.get(date) ?? 0) + followers)
      }
    }

    if (entriesByDate.size) {
      result.followerEvolution = Array.from(entriesByDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, followers]) => ({ month, followers }))
    }
  }

  // Best time to post heatmap from documented bestTimes slots.
  const bestTimesSlots = _a<Record<string, unknown>>(
    bestTimesRaw.slots ?? bestTimesRaw.data ?? bestTimesRaw.times ?? bestTimesRaw.results ?? []
  )
  if (bestTimesSlots.length) {
    const heatmapDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const heatmapTimes = ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm']
    const matrix = Array.from({ length: heatmapDays.length }, () => Array(heatmapTimes.length).fill(0))
    let bestSlot = { value: -1, day: heatmapDays[0], time: heatmapTimes[0] }

    for (const slot of bestTimesSlots) {
      const value = pctFromValue(
        slot.avg_engagement ??
        slot.avgEngagement ??
        slot.avg_engagement_rate ??
        slot.avgEngagementRate ??
        slot.engagement ??
        slot.value ??
        0,
      )
      const rawDay = _n(slot.day_of_week ?? slot.dayOfWeek ?? slot.day_index ?? slot.dayIndex ?? slot.day ?? 0)
      const dayIndex = normalizeDayIndex(rawDay)
      const hour = _n(slot.hour ?? slot.hour_of_day ?? slot.hourOfDay ?? slot.time ?? 0)
      const timeIndex = hourToHeatmapIndex(hour)

      if (dayIndex >= 0 && dayIndex < matrix.length && timeIndex >= 0 && timeIndex < matrix[dayIndex].length) {
        matrix[dayIndex][timeIndex] = value
      }
      if (value > bestSlot.value) {
        bestSlot = {
          value,
          day: heatmapDays[dayIndex] || heatmapDays[0],
          time: formatHeatmapHour(hour),
        }
      }
    }

    result.heatmap = {
      days: heatmapDays,
      times: heatmapTimes,
      data: matrix,
      bestDay: bestSlot.day,
      bestTime: bestSlot.time,
    }
  }

  // Posting frequency scatter and cadence summary.
  const postingFrequencyEntries = _a<Record<string, unknown>>(
    postingFrequencyRaw.points ?? postingFrequencyRaw.data ?? postingFrequencyRaw.results ?? postingFrequencyRaw.frequency ?? []
  ).filter(entry => platformMatches(_s(entry.platform ?? entry.platformName), platformFilter || undefined))
  if (postingFrequencyEntries.length) {
    const scatter = postingFrequencyEntries.map(entry => {
      const platform = _s(entry.platform ?? entry.platformName ?? '')
      const postsPerWeek = _n(
        entry.posts_per_week ??
        entry.postsPerWeek ??
        entry.frequency ??
        entry.weeklyPosts ??
        0,
      )
      const bucket = bucketLabelForPostsPerWeek(postsPerWeek)
      const y = pctFromValue(
        entry.avg_engagement_rate ??
        entry.avgEngagementRate ??
        entry.avg_engagement ??
        entry.avgEngagement ??
        entry.engagementRate ??
        entry.er ??
        0,
      )
      return {
        x: bucket.x,
        y,
        platform: platform.toLowerCase(),
        freqLabel: bucket.label,
      }
    })
    result.postingFrequency = scatter as PostingAnalytics['postingFrequency']

    const optimalByPlatform = new Map<string, { platform: string; label: string; cadence: string; engRate: number }>()
    for (const point of scatter) {
      if (!point.platform) continue
      const platformKey = point.platform.toLowerCase()
      const current = optimalByPlatform.get(platformKey)
      if (!current || point.y > current.engRate) {
        optimalByPlatform.set(platformKey, {
          platform: platformKey,
          label: (PLATFORM_META as Record<string, { label: string }>)[platformKey]?.label ?? point.platform,
          cadence: point.freqLabel,
          engRate: point.y,
        })
      }
    }
    result.optimalCadence = Array.from(optimalByPlatform.values())
  }

  // Content decay / engagement accumulation curve.
  const decayBuckets = _a<Record<string, unknown>>(
    contentDecayRaw.buckets ?? contentDecayRaw.data ?? contentDecayRaw.results ?? []
  )
  if (decayBuckets.length) {
    const accumulation = decayBuckets.map((bucket) => {
      const time = _s(bucket.bucket_label ?? bucket.label ?? bucket.time ?? bucket.bucket ?? bucket.range ?? '')
      const pct = pctFromValue(
        bucket.avg_pct_of_final ??
        bucket.avgPctOfFinal ??
        bucket.pct ??
        bucket.percentage ??
        bucket.value ??
        bucket.avg_engagement ??
        bucket.avgEngagement ??
        0,
      )
      return { time, pct: Math.min(100, Number(pct.toFixed(1))) }
    })
    if (accumulation.length && accumulation[0].time.toLowerCase() !== 'publish') {
      accumulation.unshift({ time: 'Publish', pct: 0 })
    }
    result.engagementAccumulation = accumulation
    const half = accumulation.find(p => p.pct >= 50)?.time ?? accumulation[Math.min(1, accumulation.length - 1)]?.time ?? result.halfEngagementTime
    const eighty = accumulation.find(p => p.pct >= 80)?.time ?? accumulation[accumulation.length - 2]?.time ?? result.eightyPctTime
    result.halfEngagementTime = half
    result.eightyPctTime = eighty
  }

  // Follower delta from dedicated stats or evolution series.
  const followerDelta = followerDeltaFromStats
    ?? (result.followerEvolution?.length
      ? (() => {
          const first = result.followerEvolution[0]?.followers ?? 0
          const last  = result.followerEvolution[result.followerEvolution.length - 1]?.followers ?? 0
          const diff  = last - first
          return { value: Math.abs(diff), positive: diff >= 0 }
        })()
      : null)

  result.stats = {
    ...result.stats,
    totalFollowers: totalFollowers || result.stats.totalFollowers,
    followersDelta: followerDelta
      ? `${followerDelta.value} in last 30d`
      : '0 in last 30d',
    followersDeltaPositive: followerDelta ? followerDelta.positive : true,
  }

  return result
}

// ── Types ─────────────────────────────────────────────────────────────────────

type PostingTab = 'posting' | 'inbox' | 'ga'
type DateRange = '7d' | '30d' | '90d' | '6m' | '1y'

interface Props {
  companyName: string
  plan: string
  dataState: AnalyticsDataState
  gaMeasurementId: string | null
  gaOAuthConnected: boolean
  gaOAuthEmail: string | null
  zernioConnectedPlatforms: string[]
  zernioConnectedAccounts: ZernioConnectedAccountInfo[]
  canManageConnections?: boolean
}

function formatConnectedAccountLabel(account: ZernioConnectedAccountInfo | undefined): string {
  if (!account) return 'Connected'
  const handle = account.username.replace(/^@/, '')
  if (handle) return `Connected · @${handle}`
  if (account.displayName.trim()) return `Connected · ${account.displayName.trim()}`
  return 'Connected'
}

interface GaData {
  chartData: { day: string; sessions: number; users: number }[]
  activityData?: { day: string; dau: number; wau: number; mau: number }[]
  summary: {
    sessions: number
    users: number
    pageviews: number
    bounceRate: string
    newUsers?: number
    avgSessionDuration?: number
  }
  deltas?: {
    sessions?: number | null
    users?: number | null
    pageviews?: number | null
    newUsers?: number | null
  }
  topPages?: { path: string; views: number }[]
  channels?: { channel: string; sessions: number }[]
  countries?: { country: string; users: number }[]
  devices?: { device: string; users: number }[]
  events?: { name: string; count: number }[]
  hostnames?: { hostname: string; sessions: number }[]
  sources?: { source: string; medium: string; label: string; sessions: number }[]
}

interface GAProperty { id: string; name: string; account?: string }

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return `${n}`
}

// ── Platform metadata ──────────────────────────────────────────────────────────

const PLATFORM_META: Record<string, { label: string; color: string; bgColor: string }> = {
  instagram:       { label: 'Instagram',       color: '#E1306C', bgColor: '#FCE4EC' },
  facebook:        { label: 'Facebook',         color: '#1877F2', bgColor: '#E3F2FD' },
  tiktok:          { label: 'TikTok',           color: '#333',    bgColor: '#F5F5F5' },
  linkedin:        { label: 'LinkedIn',         color: '#0A66C2', bgColor: '#E8F4FD' },
  youtube:         { label: 'YouTube',          color: '#FF0000', bgColor: '#FFEBEE' },
  x:               { label: 'X / Twitter',      color: '#111',    bgColor: '#F5F5F5' },
  threads:         { label: 'Threads',          color: '#111',    bgColor: '#F5F5F5' },
  bluesky:         { label: 'Bluesky',          color: '#0085FF', bgColor: '#E3F2FD' },
  pinterest:       { label: 'Pinterest',        color: '#E60023', bgColor: '#FFEBEE' },
  reddit:          { label: 'Reddit',           color: '#FF4500', bgColor: '#FFF3E0' },
  google_business: { label: 'Google Business',  color: '#4285F4', bgColor: '#E8F0FE' },
}

const ALL_PLATFORMS = [
  'instagram', 'facebook', 'tiktok', 'linkedin', 'youtube',
  'x', 'threads', 'pinterest', 'reddit', 'bluesky', 'google_business',
]

// ── Engagement metrics config ──────────────────────────────────────────────────

const ENG_METRICS = [
  { key: 'likes',       label: 'Likes',       color: '#EF4444', icon: Heart },
  { key: 'comments',    label: 'Comments',    color: '#3B82F6', icon: MessageCircle },
  { key: 'shares',      label: 'Shares',      color: '#8B5CF6', icon: Share2 },
  { key: 'saves',       label: 'Saves',       color: '#F59E0B', icon: Bookmark },
  { key: 'views',       label: 'Views',       color: '#6366F1', icon: Eye },
  { key: 'impressions', label: 'Impress.',    color: '#06B6D4', icon: TrendingUp },
  { key: 'reach',       label: 'Reach',       color: '#14B8A6', icon: Users },
  { key: 'clicks',      label: 'Clicks',      color: '#F97316', icon: MousePointerClick },
] as const

type MetricKey = typeof ENG_METRICS[number]['key']
const HIGH_SCALE_METRICS = new Set<MetricKey>(['views', 'impressions', 'reach'])
const DEFAULT_ACTIVE_METRICS: Set<MetricKey> = new Set(['likes', 'comments', 'views', 'impressions'])

function EngagementMetricTile({
  label,
  value,
  color,
  icon: Icon,
  active,
  toggleable = true,
  onToggle,
}: {
  label: string
  value: string
  color: string
  icon: typeof Heart
  active?: boolean
  toggleable?: boolean
  onToggle?: () => void
}) {
  const content = (
    <>
      <div className="flex items-center gap-1.5 min-w-0">
        {toggleable ? (
          <div
            className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
            style={{
              borderColor: active ? color : '#D1D5DB',
              background: active ? color : 'transparent',
            }}
          >
            {active && <span className="text-white text-[8px] leading-none font-bold">✓</span>}
          </div>
        ) : (
          <div className="w-4 h-4 flex-shrink-0" aria-hidden />
        )}
        <Icon
          size={13}
          className="flex-shrink-0"
          style={{ color: toggleable ? (active ? color : '#9BA1AE') : '#6B7280' }}
        />
        <span
          className={`text-[11px] leading-tight truncate ${
            toggleable ? (active ? 'text-text font-medium' : 'text-text-soft') : 'text-text-soft font-medium'
          }`}
        >
          {label}
        </span>
      </div>
      <p
        className={`text-[15px] font-semibold leading-none tabular-nums pl-[22px] ${
          toggleable ? (active ? 'text-text' : 'text-text-soft') : 'text-text'
        }`}
      >
        {value}
      </p>
    </>
  )

  if (!toggleable) {
    return <div className="min-w-0">{content}</div>
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className="min-w-0 text-left rounded-lg px-1 py-1.5 hover:bg-gray-50/80 transition-colors"
    >
      {content}
    </button>
  )
}

// ── Heatmap color helper ───────────────────────────────────────────────────────

function heatmapColor(value: number, maxValue: number): string {
  if (value === 0) return '#F3F4F6'
  const t = value / maxValue
  const r = Math.round(0xE0 + (0x10 - 0xE0) * t)
  const g = Math.round(0xF7 + (0xB9 - 0xF7) * t)
  const b = Math.round(0xED + (0x81 - 0xED) * t)
  return `rgb(${r},${g},${b})`
}

// ── Shared UI atoms ────────────────────────────────────────────────────────────

function DemoDot() {
  return (
    <span
      className="absolute top-3 right-3 w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: '#F59E0B' }}
      title="Demo data"
    />
  )
}

function DemoChip() {
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded"
      style={{ background: '#FEF3C7', color: '#92400E' }}>
      Demo data
    </span>
  )
}

function AmberBanner() {
  return (
    <div className="flex items-center justify-between px-6 py-3 rounded-xl mb-4"
      style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
      <p className="text-[12px] font-medium" style={{ color: '#92400E' }}>
        <span className="font-semibold">Demo data only</span> — this is not your real
        performance. Connect your accounts on a paid plan to see live data.
      </p>
      <a href="/dashboard/billing" className="text-[12px] font-semibold text-[#3B82F6] hover:underline flex-shrink-0 ml-4">
        View plans →
      </a>
    </div>
  )
}

function UpgradeCard() {
  return (
    <div className="rounded-2xl border-[1.5px] border-[#BFDBFE] bg-white p-8 text-center mt-2">
      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
        <FileText size={20} className="text-[#3B82F6]" />
      </div>
      <h3 className="text-[16px] font-semibold text-text mb-2">See your real performance data</h3>
      <p className="text-sm text-text-sec leading-relaxed max-w-md mx-auto mb-4">
        Connect your social accounts to see actual followers, reach, engagement, and Maya's weekly briefing.
      </p>
      <div className="inline-flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-lg mb-5"
        style={{ background: '#FEF3C7', color: '#92400E' }}>
        <Info size={12} />
        Live data is available on paid plans only — not included in the free trial.
      </div>
      <div className="flex items-center justify-center gap-3">
        <a href="/dashboard/billing"
          className="bg-[#3B82F6] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#2563EB] transition-colors">
          Activate your plan →
        </a>
        <a href="/pricing"
          className="border border-gray-200 text-sm font-medium text-text-sec px-5 py-2.5 rounded-xl hover:border-gray-300 transition-colors">
          View plan options
        </a>
      </div>
    </div>
  )
}

// ── Platform SVG logos ────────────────────────────────────────────────────────

const PLATFORM_SVGS: Record<string, { path: string; bg: string; fg?: string }> = {
  instagram: {
    bg: 'linear-gradient(45deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)',
    path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
  },
  facebook: {
    bg: '#1877F2',
    path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  },
  tiktok: {
    bg: '#010101',
    path: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  },
  linkedin: {
    bg: '#0A66C2',
    path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  },
  youtube: {
    bg: '#FF0000',
    path: 'M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z',
  },
  x: {
    bg: '#000000',
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
  threads: {
    bg: '#000000',
    path: 'M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.851 1.205 8.604.024 12.184 0h.014c2.264.018 4.154.598 5.769 1.756 1.088.774 1.985 1.792 2.67 3.024l-2.687 1.542c-.867-1.52-2.118-2.345-3.803-2.504a7.37 7.37 0 00-.947-.056c-1.844 0-3.342.613-4.449 1.823-1.097 1.2-1.655 2.885-1.655 5.007 0 2.12.558 3.802 1.655 5.002 1.107 1.21 2.604 1.823 4.448 1.823.344 0 .681-.021 1.003-.063 1.516-.196 2.656-.814 3.39-1.84.49-.68.806-1.502.957-2.505h-5.35v-2.96h8.267c.087.549.13 1.099.13 1.651 0 2.41-.653 4.383-1.94 5.86-1.457 1.66-3.523 2.502-6.148 2.502z',
  },
  pinterest: {
    bg: '#E60023',
    path: 'M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z',
  },
  reddit: {
    bg: '#FF4500',
    path: 'M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z',
  },
  bluesky: {
    bg: '#0085FF',
    path: 'M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 01-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.204-.659-.299-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z',
  },
  google_business: {
    bg: '#4285F4',
    path: 'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z',
  },
}

function PlatformAvatar({ id, size = 22 }: { id: string; size?: number }) {
  const meta = PLATFORM_META[id]
  const svg = PLATFORM_SVGS[id]
  if (svg) {
    return (
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-full overflow-hidden"
        style={{ width: size, height: size, background: svg.bg }}
        title={meta?.label ?? id}
      >
        <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="white">
          <path d={svg.path} />
        </svg>
      </div>
    )
  }
  // fallback letter avatar
  const label = (meta?.label ?? id).trim()
  const color = meta?.color ?? '#6B7280'
  const initial = label[0]?.toUpperCase() ?? '?'
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.42 }}
      title={label || id || 'Unknown platform'}
    >
      {initial}
    </div>
  )
}

// ── Filter Dropdown ────────────────────────────────────────────────────────────

interface DropdownOption { value: string; label: string }

function FilterDropdown({
  value, options, onChange, isMock, mayaSourceTooltip,
}: {
  value: string
  options: DropdownOption[]
  onChange: (v: string) => void
  isMock?: boolean
  mayaSourceTooltip?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find(o => o.value === value) ?? options[0]

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[12.5px] font-medium text-text-sec bg-white border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-colors whitespace-nowrap"
      >
        {current.label}
        <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[180px]">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                if (isMock && opt.value === 'maya' && mayaSourceTooltip) return
                onChange(opt.value)
                setOpen(false)
              }}
              className={`w-full text-left px-3.5 py-2 text-[12.5px] flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors ${value === opt.value ? 'text-[#3B82F6] font-medium' : 'text-text-sec'}`}
            >
              {opt.label}
              {isMock && opt.value === 'maya' && (
                <span className="text-[10px] text-amber-600">Paid plan</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Filter Bar ─────────────────────────────────────────────────────────────────

function FilterBar({
  activeTab,
  platform, profile, source, dateRange, isMock,
  onPlatformChange, onSourceChange, onDateRangeChange,
}: {
  activeTab: PostingTab
  platform: string; profile: string; source: string; dateRange: DateRange; isMock: boolean
  onPlatformChange: (v: string) => void
  onSourceChange:   (v: string) => void
  onDateRangeChange:(v: DateRange) => void
}) {
  const platformOptions: DropdownOption[] = [
    { value: 'all',             label: 'All platforms' },
    { value: 'instagram',       label: 'Instagram'     },
    { value: 'tiktok',          label: 'TikTok'        },
    { value: 'facebook',        label: 'Facebook'      },
    { value: 'youtube',         label: 'YouTube'       },
    { value: 'linkedin',        label: 'LinkedIn'      },
    { value: 'x',               label: 'X / Twitter'   },
    { value: 'threads',         label: 'Threads'       },
    { value: 'pinterest',       label: 'Pinterest'     },
    { value: 'reddit',          label: 'Reddit'        },
    { value: 'bluesky',         label: 'Bluesky'       },
    { value: 'google_business', label: 'GBP'           },
  ]

  const sourceOptions: DropdownOption[] = [
    { value: 'all',  label: 'All sources'     },
    { value: 'maya', label: 'Posted via Maya' },
  ]

  const dateOptions: DropdownOption[] = [
    { value: '7d',  label: 'Last 7 days'   },
    { value: '30d', label: 'Last 30 days'  },
    { value: '90d', label: 'Last 90 days'  },
    { value: '6m',  label: 'Last 6 months' },
    { value: '1y',  label: 'Last year'     },
  ]

  const showSocialFilters = activeTab === 'posting'

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      {showSocialFilters && (
        <>
          {/* Platform — Zernio posting only */}
          <FilterDropdown
            value={platform}
            options={platformOptions}
            onChange={onPlatformChange}
            isMock={isMock}
          />

          {/* Profile scope — aggregates all Zernio profiles on this tenant */}
          <button
            title="Aggregates all connected social accounts for this workspace"
            className="flex items-center gap-1.5 text-[12.5px] font-medium text-text-sec bg-white border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-colors cursor-default"
          >
            {isMock ? 'Demo Profile' : 'All connected accounts'}
            <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />
          </button>

          {/* Source — Zernio posting only */}
          <FilterDropdown
            value={source}
            options={sourceOptions}
            onChange={onSourceChange}
            isMock={isMock}
            mayaSourceTooltip
          />
        </>
      )}

      {/* Date range — all tabs */}
      <FilterDropdown
        value={dateRange}
        options={dateOptions}
        onChange={v => onDateRangeChange(v as DateRange)}
        isMock={isMock}
      />

      {/* Last sync */}
      <span className="ml-auto text-[11px] text-text-soft whitespace-nowrap">
        {isMock ? 'Demo mode' : `Last sync: just now`}
      </span>
    </div>
  )
}

// ── Maya Briefing Card ─────────────────────────────────────────────────────────

function MayaBriefingCard({ isMock }: { isMock: boolean }) {
  const [open, setOpen] = useState(true)
  const [generated, setGenerated] = useState(false)

  return (
    <div className="rounded-2xl bg-white border border-gray-100 mb-4 overflow-hidden"
      style={{ borderLeft: '3px solid #3B82F6' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[10px] font-bold">M</span>
          </div>
          <span className="text-[13px] font-semibold text-text">Maya's briefing</span>
          {isMock && (
            <span className="text-[10px] px-2 py-0.5 rounded font-medium"
              style={{ background: '#FEF3C7', color: '#92400E' }}>
              Demo
            </span>
          )}
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1">
          {!generated ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] text-text-sec">
                  Maya hasn&apos;t analyzed this period yet.
                </p>
                <p className="text-[11px] text-text-soft mt-1">~15 seconds · included</p>
              </div>
              <button
                onClick={() => !isMock && setGenerated(true)}
                disabled={isMock}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-[#3B82F6] px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 hover:bg-[#2563EB] transition-colors"
                title={isMock ? 'Available on paid plans' : undefined}
              >
                <Sparkles size={12} /> Generate briefing
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[13px] text-text-sec leading-relaxed">
                Your Instagram engagement rate is up 0.4pts this period, driven primarily by the
                &ldquo;Behind the scenes&rdquo; post. TikTok is your highest-ER platform at 5.1% despite
                lower follower count — it deserves more posting frequency.
              </p>
              <div className="space-y-2">
                {[
                  'Post on TikTok 2× this week to capitalize on its 5.1% engagement rate.',
                  'Tuesday and Friday 9pm are your peak engagement windows — schedule accordingly.',
                  'Facebook CTR is healthy at 2.1% — consider boosting this week\'s post.',
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-[12px] text-text-sec">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] flex-shrink-0 mt-1.5" />
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Chart card wrapper ─────────────────────────────────────────────────────────

function ChartCard({
  title, subtitle, right, children, isMock, fullWidth,
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
  children: React.ReactNode
  isMock?: boolean
  fullWidth?: boolean
}) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white overflow-hidden ${fullWidth ? 'col-span-full' : ''}`}>
      <div className="px-5 py-4 border-b border-gray-50 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-text">{title}</span>
            {isMock && <DemoChip />}
          </div>
          {subtitle && <p className="text-[11px] text-text-soft mt-0.5">{subtitle}</p>}
        </div>
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
      {children}
    </div>
  )
}

// ── Stat Cards (5) ─────────────────────────────────────────────────────────────

function StatCards({ isMock }: { isMock: boolean }) {
  const { stats: s } = useContext(PostingDataContext)
  const formatEngagementRate = (value: number) => isMock ? `${value}%` : `${value.toFixed(1)}%`

  const cards = [
    {
      label: 'Engagement rate',
      value: formatEngagementRate(s.engagementRate),
      delta: s.engRateDelta,
      deltaPos: s.engRateDeltaPositive,
    },
    {
      label: 'Total reach',
      value: fmt(s.totalReach),
      icon: <Eye size={14} />,
      delta: s.reachDelta,
      deltaPos: s.reachDeltaPositive,
    },
    {
      label: 'Total followers',
      value: fmt(s.totalFollowers),
      icon: <Users size={14} />,
      delta: s.followersDelta,
      deltaPos: s.followersDeltaPositive,
    },
    {
      label: 'Posts this period',
      value: `${s.postsThisPeriod}`,
      icon: <FileText size={14} />,
      delta: isMock ? undefined : 'new',
      deltaPos: true,
    },
    {
      label: 'Best post',
      isBestPost: true,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c, i) => (
        <div key={i} className="relative bg-white rounded-2xl border border-gray-100 p-4">
          {isMock && <DemoDot />}
          <p className="text-[11px] font-medium text-text-soft uppercase tracking-wide mb-2">{c.label ?? 'Best post'}</p>

          {c.isBestPost ? (
            (() => {
              const bestPost = s.bestPost as typeof s.bestPost & { url?: string; accountUsername?: string }
              const hasBestPost = Boolean(
                bestPost.platform?.trim()
                || bestPost.caption?.trim()
                || bestPost.engagements > 0
                || bestPost.url,
              )
              if (!isMock && !hasBestPost) {
                return (
                  <p className="text-[12px] text-text-soft leading-snug">
                    No post details available yet
                  </p>
                )
              }
              return (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {bestPost.platform?.trim() ? (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <PlatformAvatar id={bestPost.platform} size={20} />
                      </div>
                    ) : null}
                    <span className="text-[24px] font-[500] text-text leading-none">{s.bestPost.engagements}</span>
                  </div>
                  {bestPost.caption?.trim() ? (
                    <p className="text-[11px] text-text-soft truncate">{bestPost.caption}</p>
                  ) : null}
                  {bestPost.accountUsername?.trim() ? (
                    <p className="text-[10px] text-text-soft truncate">@{bestPost.accountUsername.replace(/^@/, '')}</p>
                  ) : null}
                  {bestPost.url ? (
                    <a
                      href={bestPost.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={bestPost.url}
                      className="text-[11px] text-[#3B82F6] font-medium mt-1 inline-flex items-center gap-0.5 hover:underline"
                    >
                      View <ExternalLink size={10} />
                    </a>
                  ) : null}
                </div>
              )
            })()
          ) : (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                {c.icon && <span className="text-text-soft">{c.icon}</span>}
                <span className="text-[26px] font-[500] text-text leading-none">{c.value}</span>
              </div>
              {c.delta && (
                <span className={`flex items-center gap-0.5 text-[11px] font-medium ${c.deltaPos ? 'text-emerald-600' : 'text-red-500'}`}>
                  {c.deltaPos ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {c.delta}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Posts Per Platform ─────────────────────────────────────────────────────────

function PostsPerPlatformChart({ isMock }: { isMock: boolean }) {
  const { platformPosts: data } = useContext(PostingDataContext)
  const total = data.reduce((s, d) => s + d.posts, 0)

  return (
    <ChartCard
      title="Posts per platform"
      subtitle="Top 1 by post count in this window"
      right={<span className="text-[11px] text-text-soft font-medium">{total} posts total</span>}
      isMock={isMock}
    >
      <div className="px-4 pt-4 pb-3">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} barSize={36}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9BA1AE' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #f0f0f0' }} cursor={{ fill: '#f9fafb' }} />
            <Bar dataKey="posts" fill="#E0476E" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

// ── Posts Over Time ────────────────────────────────────────────────────────────

function timeSeriesLabel(dr: string) {
  if (dr === '7d')  return { unit: 'day',   period: 'last 7 days'    }
  if (dr === '30d') return { unit: 'week',  period: 'last 30 days'   }
  if (dr === '90d') return { unit: 'week',  period: 'last 90 days'   }
  if (dr === '6m')  return { unit: 'month', period: 'last 6 months'  }
  return                   { unit: 'month', period: 'last 365 days'  }
}

function PostsOverTimeChart({ isMock }: { isMock: boolean }) {
  const { monthly: data } = useContext(PostingDataContext)
  const dr    = useContext(DateRangeContext)
  const { unit, period } = timeSeriesLabel(dr)
  const total = data.reduce((s, d) => s + d.posts, 0)

  return (
    <ChartCard
      title="Posts over time"
      subtitle={`Posts per ${unit} · ${period}`}
      right={<span className="text-[11px] text-text-soft font-medium">{total} posts total</span>}
      isMock={isMock}
    >
      <div className="px-4 pt-4 pb-3">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} interval={0} />
            <YAxis tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={22} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #f0f0f0' }} cursor={{ fill: '#f9fafb' }} />
            <Bar dataKey="posts" fill="#E0476E" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

// ── Likes Per Platform ─────────────────────────────────────────────────────────

function LikesPerPlatformChart({ isMock }: { isMock: boolean }) {
  const { platformLikes: data } = useContext(PostingDataContext)
  const total = data.reduce((s, d) => s + d.likes, 0)

  return (
    <ChartCard
      title="Likes per platform"
      subtitle="Top 1 platforms by likes in this window"
      right={<span className="text-[11px] text-text-soft font-medium">{fmt(total)} likes total</span>}
      isMock={isMock}
    >
      <div className="px-4 pt-4 pb-3">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} barSize={36}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9BA1AE' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={36} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #f0f0f0' }} cursor={{ fill: '#f9fafb' }} />
            <Bar dataKey="likes" fill="#E0476E" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

// ── Likes Over Time ────────────────────────────────────────────────────────────

function LikesOverTimeChart({ isMock }: { isMock: boolean }) {
  const { monthly: data } = useContext(PostingDataContext)
  const dr    = useContext(DateRangeContext)
  const { unit, period } = timeSeriesLabel(dr)
  const total = data.reduce((s, d) => s + d.likes, 0)

  return (
    <ChartCard
      title="Likes over time"
      subtitle={`Likes per ${unit} · ${period}`}
      right={<span className="text-[11px] text-text-soft font-medium">{fmt(total)} likes total</span>}
      isMock={isMock}
    >
      <div className="px-4 pt-4 pb-3">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} interval={0} />
            <YAxis tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={36} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #f0f0f0' }} cursor={{ fill: '#f9fafb' }} />
            <Bar dataKey="likes" fill="#E0476E" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

// ── Engagement Over Time (full width) ─────────────────────────────────────────

function engagementTimeSeriesLabel(dr: string) {
  if (dr === '7d')  return 'Per day · last 7 days'
  if (dr === '30d') return 'Per week · last 30 days'
  if (dr === '90d') return 'Per week · last 90 days'
  if (dr === '6m')  return 'Per month · last 6 months'
  return 'Per month · last 365 days'
}

function EngagementOverTimeChart({ isMock }: { isMock: boolean }) {
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(
    new Set(DEFAULT_ACTIVE_METRICS)
  )
  const { monthly: data } = useContext(PostingDataContext)
  const dr = useContext(DateRangeContext)
  const subtitle = engagementTimeSeriesLabel(dr)

  const toggle = (key: MetricKey) => {
    setActiveMetrics(prev => {
      const next = new Set(prev)
      if (next.has(key)) { if (next.size > 1) next.delete(key) }
      else next.add(key)
      return next
    })
  }

  const totals = ENG_METRICS.reduce((acc, m) => {
    acc[m.key] = data.reduce((s, d) => s + (d[m.key as keyof typeof d] as number ?? 0), 0)
    return acc
  }, {} as Record<string, number>)

  const totalEngagements = totals.likes + totals.comments + totals.shares + totals.saves + totals.clicks
  const engRateTotal = totals.reach > 0
    ? ((totalEngagements / totals.reach) * 100).toFixed(2)
    : '0.00'

  const hasLeftAxis = ENG_METRICS.some(m => activeMetrics.has(m.key) && !HIGH_SCALE_METRICS.has(m.key))
  const hasRightAxis = ENG_METRICS.some(m => activeMetrics.has(m.key) && HIGH_SCALE_METRICS.has(m.key))

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden col-span-full">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
        <span className="text-[13px] font-semibold text-text">Engagement over time</span>
        {isMock && <DemoChip />}
        <span className="text-[11px] text-text-soft ml-1">{subtitle}</span>
      </div>
      <div className="flex flex-col xl:flex-row">
        {/* Chart — ~65% width on desktop, matching Zernio split */}
        <div className="flex-1 min-w-0 px-4 pt-4 pb-4 xl:pr-2">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: '#9BA1AE' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              {hasLeftAxis && (
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10, fill: '#9BA1AE' }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  allowDecimals={false}
                />
              )}
              {hasRightAxis && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: '#9BA1AE' }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  allowDecimals={false}
                />
              )}
              {!hasLeftAxis && hasRightAxis && (
                <YAxis yAxisId="left" hide />
              )}
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f0f0f0' }} />
              {ENG_METRICS.filter(m => activeMetrics.has(m.key)).map(m => (
                <Line
                  key={m.key}
                  type="monotone"
                  dataKey={m.key}
                  yAxisId={HIGH_SCALE_METRICS.has(m.key) ? 'right' : 'left'}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  name={m.label}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Extended metrics — Zernio 3×3 grid */}
        <div className="w-full flex-shrink-0 border-t border-gray-100 py-5 px-5 xl:w-[min(100%,420px)] xl:border-t-0 xl:border-l xl:py-4">
          <div className="grid grid-cols-3 gap-x-4 gap-y-5">
            {ENG_METRICS.map(m => (
              <EngagementMetricTile
                key={m.key}
                label={m.label}
                value={fmt(totals[m.key])}
                color={m.color}
                icon={m.icon}
                active={activeMetrics.has(m.key)}
                onToggle={() => toggle(m.key)}
              />
            ))}
            <EngagementMetricTile
              label="Eng. Rate"
              value={`${engRateTotal}%`}
              color="#6B7280"
              icon={TrendingUp}
              toggleable={false}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Best Time to Post Heatmap ──────────────────────────────────────────────────

function BestTimeToPostHeatmap({ isMock }: { isMock: boolean }) {
  const { heatmap: { days, times, data, bestDay, bestTime } } = useContext(PostingDataContext)
  const allValues = data.flat()
  const maxVal = Math.max(...allValues, 1)

  return (
    <ChartCard
      title="Best Time to Post"
      right={
        <div className="flex items-center gap-1.5 text-[10.5px] text-text-soft">
          <span>Less</span>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map(t => (
            <div
              key={t}
              className="w-3 h-3 rounded-sm"
              style={{ background: heatmapColor(t * maxVal, maxVal) }}
            />
          ))}
          <span>More</span>
        </div>
      }
      isMock={isMock}
    >
      <div className="px-4 pt-3 pb-4">
        {/* Grid */}
        <div className="flex gap-1 overflow-x-auto">
          {/* Day labels */}
          <div className="flex flex-col gap-1 pr-1">
            <div className="h-5" />
            {days.map(d => (
              <div key={d} className="h-5 flex items-center text-[10px] text-text-soft w-7">{d}</div>
            ))}
          </div>
          {/* Cells */}
          <div className="flex-1 min-w-[320px]">
            {/* Time labels */}
            <div className="grid mb-1" style={{ gridTemplateColumns: `repeat(${times.length}, 1fr)` }}>
              {times.map(t => (
                <div key={t} className="text-[9px] text-text-soft text-center leading-5">{t}</div>
              ))}
            </div>
            {/* Heatmap rows */}
            {data.map((row, di) => (
              <div key={di} className="grid gap-1 mb-1" style={{ gridTemplateColumns: `repeat(${times.length}, 1fr)` }}>
                {row.map((val, ti) => (
                  <div
                    key={ti}
                    className="h-5 rounded-sm"
                    style={{ background: heatmapColor(val, maxVal) }}
                    title={`${days[di]} ${times[ti]}: ${val}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        {/* Best times label */}
        <div className="flex items-center gap-1.5 mt-3 text-[11px] text-text-sec">
          <span className="font-medium">Best times:</span>
          <span
            className="flex items-center gap-1 font-semibold px-2 py-0.5 rounded text-[10px]"
            style={{ background: '#D1FAE5', color: '#065F46' }}
          >
            {bestDay} {bestTime}
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          </span>
        </div>
      </div>
    </ChartCard>
  )
}

// ── Follower Evolution ─────────────────────────────────────────────────────────

function FollowerEvolutionChart({ isMock }: { isMock: boolean }) {
  const { followerEvolution: data, stats } = useContext(PostingDataContext)
  const hasSeries = data.some(point => point.followers > 0)

  return (
    <ChartCard
      title="Follower evolution"
      subtitle="Followers per account · top 1"
      right={
        hasSeries
          ? <span className="text-[11px] text-text-soft font-medium">{fmt(data[data.length - 1]?.followers ?? 0)} followers total</span>
          : stats.totalFollowers > 0
            ? <span className="text-[11px] text-text-soft font-medium">{fmt(stats.totalFollowers)} followers total</span>
            : null
      }
      isMock={isMock}
    >
      {!hasSeries ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <Users className="w-8 h-8 text-gray-300 mb-3" strokeWidth={1.5} />
          <p className="text-[13px] font-medium text-text">
            {isMock ? 'No Data Available' : 'Follower history is still collecting'}
          </p>
          <p className="text-[11px] text-text-soft mt-1 max-w-[240px]">
            {isMock
              ? 'Follower history will appear here once data is collected.'
              : 'Daily follower counts will appear here once we have enough history for this account.'}
          </p>
        </div>
      ) : (
        <div className="px-4 pt-4 pb-3">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} interval={2} />
              <YAxis
                tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={40}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f0f0f0' }}
                formatter={(v: unknown) => [fmt(Number(v ?? 0)), 'Followers']}
              />
              <Line type="monotone" dataKey="followers" stroke="#3B82F6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}

// ── Platform Breakdown Table ───────────────────────────────────────────────────

function PlatformBreakdownTable({ isMock }: { isMock: boolean }) {
  const { platformBreakdown: data } = useContext(PostingDataContext)
  const cols = ['Platform', 'Posts', 'Likes', 'Comments', 'Shares', 'Saves', 'Clicks', 'Views', 'Impressions', 'Reach', 'ER%']

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden col-span-full">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
        <span className="text-[13px] font-semibold text-text">Platform Breakdown</span>
        {isMock && <DemoChip />}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-50">
              {cols.map(c => (
                <th key={c} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <PlatformAvatar id={row.platform} size={20} />
                    <span className="text-[12px] font-medium text-text">{row.label}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[12px] text-text">{row.posts}</td>
                <td className="px-4 py-3 text-[12px] text-text">{fmt(row.likes)}</td>
                <td className="px-4 py-3 text-[12px] text-text">{row.comments}</td>
                <td className="px-4 py-3 text-[12px] text-text">{row.shares}</td>
                <td className="px-4 py-3 text-[12px] text-text">{row.saves || '—'}</td>
                <td className="px-4 py-3 text-[12px] text-text">{row.clicks || '—'}</td>
                <td className="px-4 py-3 text-[12px] text-text">{fmt(row.views)}</td>
                <td className="px-4 py-3 text-[12px] text-text">{fmt(row.impressions)}</td>
                <td className="px-4 py-3 text-[12px] text-text">{fmt(row.reach)}</td>
                <td className="px-4 py-3">
                  <span className="text-[11px] font-semibold text-emerald-600">{row.erPct}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Top Performing Posts Table ─────────────────────────────────────────────────

function TopPerformingPostsTable({ isMock }: { isMock: boolean }) {
  const { topPosts: data } = useContext(PostingDataContext)
  const metaCols = [
    { key: 'likes',       label: 'Likes',       color: '#3B82F6' },
    { key: 'comments',    label: 'Comments',    color: '#10B981' },
    { key: 'shares',      label: 'Shares',      color: '#8B5CF6' },
    { key: 'saves',       label: 'Saves',       color: '#F59E0B' },
    { key: 'clicks',      label: 'Clicks',      color: '#F97316' },
    { key: 'views',       label: 'Views',       color: '#06B6D4' },
    { key: 'impressions', label: 'Impressions', color: '#64748B' },
    { key: 'reach',       label: 'Reach',       color: '#14B8A6' },
    { key: 'erPct',       label: 'ER%',         color: '#10B981' },
  ]

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden col-span-full">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
        <span className="text-[13px] font-semibold text-text">Top Performing Posts</span>
        {isMock && <DemoChip />}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 min-w-[220px]">Post</th>
              {metaCols.map(c => (
                <th key={c.key} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap"
                  style={{ color: c.color }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !isMock ? (
              <tr>
                <td colSpan={metaCols.length + 1} className="px-4 py-10 text-center">
                  <p className="text-[13px] font-medium text-text">No post details available yet</p>
                  <p className="text-[11px] text-text-soft mt-1 max-w-[320px] mx-auto">
                    Post-level metrics will appear here once individual post records are available for this period.
                  </p>
                </td>
              </tr>
            ) : data.map((post, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {/* Placeholder thumbnail */}
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200">
                      <PlatformAvatar id={post.platform} size={18} />
                    </div>
                    <div>
                      <p className="text-[12px] text-text font-medium leading-tight max-w-[160px] truncate">{post.caption}</p>
                      <p className="text-[10px] text-text-soft mt-0.5">{post.date}</p>
                    </div>
                  </div>
                </td>
                {metaCols.map(c => {
                  const val = post[c.key as keyof typeof post]
                  return (
                    <td key={c.key} className="px-3 py-3">
                      {c.key === 'erPct' ? (
                        <span className="text-[11px] font-semibold text-emerald-600">{val}%</span>
                      ) : (
                        <span className="text-[12px] text-text">{val === 0 ? '—' : fmt(Number(val))}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Posting Frequency vs Engagement ───────────────────────────────────────────

function PostingFrequencyChart({ isMock }: { isMock: boolean }) {
  const { postingFrequency: data, optimalCadence: optimal } = useContext(PostingDataContext)

  const igColor  = '#3B82F6'
  const fbColor  = '#60A5FA'

  const igData = data.filter(d => d.platform?.toLowerCase() === 'instagram')
  const fbData = data.filter(d => d.platform?.toLowerCase() === 'facebook')
  const maxY = Math.max(5, ...data.map(d => d.y), 0)

  const tickFormatter = (v: number) => {
    const labels: Record<number, string> = { 1: '< 1/wk', 2: '1–2/wk', 3: '3–4/wk', 4: '5+/wk' }
    return labels[v] ?? ''
  }

  return (
    <ChartCard
      title="Posting Frequency vs Engagement"
      isMock={isMock}
    >
      <div className="px-4 pt-4 pb-2">
        <ResponsiveContainer width="100%" height={200}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="x" type="number" domain={[0.5, 4.5]}
              ticks={[1, 2, 3, 4]}
              tickFormatter={tickFormatter}
              tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false}
            />
            <YAxis
              dataKey="y" type="number"
              domain={[0, Math.ceil(maxY + 1)]}
              tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={32}
              tickFormatter={(v: number) => `${v}%`}
            />
            <ZAxis range={[40, 40]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f0f0f0' }}
              content={({ payload }) => {
                if (!payload?.length) return null
                const d = payload[0]?.payload
                return (
                  <div className="bg-white border border-gray-100 rounded-xl p-2.5 shadow text-[11px]">
                    <p className="font-medium text-text">{d.freqLabel}</p>
                    <p className="text-text-sec">{PLATFORM_META[d.platform]?.label}: {d.y}%</p>
                  </div>
                )
              }}
            />
            <Scatter data={igData} fill={igColor} name="Instagram" />
            <Scatter data={fbData} fill={fbColor} name="Facebook" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="px-4 pb-4 space-y-1.5">
        <p className="text-[10px] font-semibold text-text-soft uppercase tracking-wide">Optimal cadence per platform</p>
        {optimal.map(o => (
          <div key={o.platform} className="flex items-center gap-1.5 text-[11px] text-text-sec">
            <PlatformAvatar id={o.platform} size={14} />
            <span className="font-medium">{o.label}</span>
            <span className="text-text-soft">{o.cadence} · {o.engRate}%</span>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

// ── Engagement Accumulation ────────────────────────────────────────────────────

function EngagementAccumulationChart({ isMock }: { isMock: boolean }) {
  const { engagementAccumulation: data, halfEngagementTime, eightyPctTime } = useContext(PostingDataContext)

  return (
    <ChartCard
      title="Engagement Accumulation"
      subtitle="How engagement accumulates after publishing"
      isMock={isMock}
    >
      <div className="px-4 pt-4 pb-2">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="engAccumGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={32}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f0f0f0' }}
              formatter={(v: unknown) => [`${v}%`, 'Cumulative']}
            />
            <ReferenceLine y={50} stroke="#10B981" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: '50%', position: 'right', fontSize: 10, fill: '#10B981' }} />
            <ReferenceLine y={80} stroke="#F59E0B" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: '80%', position: 'right', fontSize: 10, fill: '#F59E0B' }} />
            <Area type="monotone" dataKey="pct" stroke="#3B82F6" strokeWidth={2} fill="url(#engAccumGrad)" dot={false} name="% of engagement" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="px-4 pb-4 flex items-center gap-1.5 text-[11px] text-text-sec">
        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] inline-block" />
        Half of engagement by <strong className="text-text mx-0.5">{halfEngagementTime}</strong>
        {' · '}
        80% within <strong className="text-text mx-0.5">{eightyPctTime}</strong>
      </div>
    </ChartCard>
  )
}

// ── Inbox Analytics Tab ────────────────────────────────────────────────────────

function InboxActivityHeatmap({
  isMock,
  cells,
}: {
  isMock: boolean
  cells: AnalyticsInboxData['activityHeatmap']
}) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const hours = [0, 3, 6, 9, 12, 15, 18, 21]
  const grid = days.map(day =>
    hours.map(hour => cells.find(c => c.day === day && c.hour === hour)?.count ?? 0),
  )
  const maxVal = Math.max(...grid.flat(), 1)

  return (
    <div className="rounded-2xl border border-gray-100 bg-white">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
        <span className="text-[13px] font-semibold text-text">When messages land</span>
        {isMock && <DemoChip />}
      </div>
      <div className="px-4 pt-3 pb-4 overflow-x-auto">
        <div className="flex gap-1 min-w-[320px]">
          <div className="flex flex-col gap-1 pr-1">
            <div className="h-5" />
            {days.map(d => (
              <div key={d} className="h-5 flex items-center text-[10px] text-text-soft w-7">{d}</div>
            ))}
          </div>
          <div className="flex-1">
            <div className="grid mb-1" style={{ gridTemplateColumns: `repeat(${hours.length}, 1fr)` }}>
              {hours.map(h => (
                <div key={h} className="text-[9px] text-text-soft text-center leading-5">{h}h</div>
              ))}
            </div>
            {grid.map((row, rowIdx) => (
              <div key={days[rowIdx]} className="grid gap-1 mb-1" style={{ gridTemplateColumns: `repeat(${hours.length}, 1fr)` }}>
                {row.map((value, colIdx) => (
                  <div
                    key={`${days[rowIdx]}-${hours[colIdx]}`}
                    className="h-5 rounded-sm"
                    style={{ background: heatmapColor(value, maxVal) }}
                    title={`${days[rowIdx]} ${hours[colIdx]}:00 — ${value} messages`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function InboxAnalyticsContent({
  isMock,
  dataState,
  fetchError,
  loading,
  inbox,
  onConnect,
}: {
  isMock: boolean
  dataState: AnalyticsDataState
  fetchError: string
  loading: boolean
  inbox: AnalyticsInboxData
  onConnect: () => void
}) {
  if (dataState === 'empty') {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-6 py-14 text-center">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
          <Plus size={20} className="text-[#3B82F6]" />
        </div>
        <p className="text-[15px] font-semibold text-text mb-2">Connect a social account</p>
        <p className="text-[13px] text-text-sec max-w-md mx-auto mb-5">
          Inbox analytics will populate from your connected accounts. Connect Instagram, Facebook, or other platforms to get started.
        </p>
        <button
          type="button"
          onClick={onConnect}
          className="inline-flex items-center gap-1.5 bg-[#3B82F6] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#2563EB] transition-colors"
        >
          <Plus size={14} /> Connect accounts
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {fetchError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-xs font-medium text-red-600">{fetchError}</p>
        </div>
      )}

      {loading && !fetchError && (
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
          <p className="text-xs text-text-sec">Loading inbox analytics…</p>
        </div>
      )}

      {/* Summary cards — mirrors Zernio inbox analytics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Received', value: `${inbox.received}`, warn: false },
          { label: 'Sent', value: `${inbox.sent}`, warn: false },
          { label: 'Read', value: `${inbox.read}`, warn: false },
          { label: 'Failed', value: `${inbox.failed}`, warn: inbox.failed > 0 },
          { label: 'Conversations', value: `${inbox.conversations}`, warn: false },
          { label: 'Median response', value: inbox.medianResponseLabel ?? '—', warn: Boolean(inbox.medianResponseLabel) },
        ].map(({ label, value, warn }) => (
          <div key={label} className="relative bg-white rounded-2xl border border-gray-100 p-4">
            {isMock && <DemoDot />}
            <p className="text-[10px] font-medium text-text-soft uppercase tracking-wide mb-1.5">{label}</p>
            <p className={`text-[22px] font-[500] ${warn && label === 'Failed' ? 'text-red-600' : warn ? 'text-amber-700' : 'text-text'}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Total Comments', value: `${inbox.totalComments}` },
          { label: 'Total DMs',      value: `${inbox.totalDMs}` },
          { label: 'Response Rate',  value: `${inbox.responseRate}%` },
        ].map(({ label, value }) => (
          <div key={label} className="relative bg-white rounded-2xl border border-gray-100 p-5">
            {isMock && <DemoDot />}
            <p className="text-[11px] font-medium text-text-soft uppercase tracking-wide mb-2">{label}</p>
            <p className="text-[26px] font-[500] text-text">{value}</p>
          </div>
        ))}
      </div>

      {inbox.messagesOverTime.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <span className="text-[13px] font-semibold text-text">Messages over time</span>
            {isMock && <DemoChip />}
          </div>
          <div className="px-4 pt-4 pb-3">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={inbox.messagesOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={26} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f0f0f0' }} />
                <Line type="monotone" dataKey="received" stroke="#3B82F6" strokeWidth={2} dot={false} name="Received" />
                <Line type="monotone" dataKey="sent" stroke="#10B981" strokeWidth={2} dot={false} name="Sent" />
                <Line type="monotone" dataKey="read" stroke="#8B5CF6" strokeWidth={2} dot={false} name="Read" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Platform breakdown */}
      <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <span className="text-[13px] font-semibold text-text">Platform breakdown</span>
          {isMock && <DemoChip />}
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[420px]">
          <thead>
            <tr className="border-b border-gray-50">
              {['Platform', 'Comments', 'Received', 'Sent', 'Unread'].map(h => (
                <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inbox.platforms.map((p, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <PlatformAvatar id={p.platform} size={20} />
                    <span className="text-[12px] font-medium text-text">{PLATFORM_META[p.platform]?.label ?? p.platform}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-[12px] text-text">{p.comments}</td>
                <td className="px-5 py-3 text-[12px] text-text">{p.received ?? p.dms}</td>
                <td className="px-5 py-3 text-[12px] text-text">{p.sent ?? '—'}</td>
                <td className="px-5 py-3">
                  {p.unread > 0
                    ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: '#FEF3C7', color: '#92400E' }}>{p.unread} unread</span>
                    : <span className="text-[11px] text-text-soft">—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {inbox.responseTimeBuckets.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <span className="text-[13px] font-semibold text-text">Response time</span>
            {isMock && <DemoChip />}
          </div>
          <div className="px-4 pt-4 pb-3">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={inbox.responseTimeBuckets} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={26} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f0f0f0' }} />
                <Bar dataKey="count" fill="#3B82F6" radius={[3, 3, 0, 0]} name="Replies" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {inbox.topAccounts.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <span className="text-[13px] font-semibold text-text">Top accounts by volume</span>
            {isMock && <DemoChip />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="border-b border-gray-50">
                  {['Account', 'Received', 'Sent', 'Conversations', 'Median response'].map(h => (
                    <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inbox.topAccounts.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <PlatformAvatar id={row.platform} size={20} />
                        <span className="text-[12px] font-medium text-text">{row.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[12px] text-text">{row.received}</td>
                    <td className="px-5 py-3 text-[12px] text-text">{row.sent}</td>
                    <td className="px-5 py-3 text-[12px] text-text">{row.conversations}</td>
                    <td className="px-5 py-3 text-[12px] text-text">{row.medianResponseLabel ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {inbox.outboundBySource.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <span className="text-[13px] font-semibold text-text">Outbound by source</span>
            {isMock && <DemoChip />}
          </div>
          <div className="px-4 pt-4 pb-3">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={inbox.outboundBySource} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="source" tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={26} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f0f0f0' }} />
                <Bar dataKey="count" fill="#64748B" radius={[3, 3, 0, 0]} name="Sent" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {inbox.activityHeatmap.length > 0 && (
        <InboxActivityHeatmap isMock={isMock} cells={inbox.activityHeatmap} />
      )}

      {/* Comments + DMs trend */}
      <div className="rounded-2xl border border-gray-100 bg-white">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <span className="text-[13px] font-semibold text-text">Engagement trend</span>
          {isMock && <DemoChip />}
        </div>
        <div className="px-4 pt-4 pb-3">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={inbox.trend} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={26} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f0f0f0' }} />
              <Bar dataKey="comments" fill="#3B82F6" radius={[3, 3, 0, 0]} name="Comments" />
              <Bar dataKey="dms"      fill="#94A3B8" radius={[3, 3, 0, 0]} name="DMs" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 flex items-center justify-between gap-3">
        <p className="text-[12px] text-text-sec">
          Manage and reply to comments and DMs from your connected accounts.
        </p>
        {!isMock && (
          <Link
            href="/dashboard/inbox"
            className="text-[12px] font-semibold text-[#3B82F6] hover:underline whitespace-nowrap"
          >
            Open inbox →
          </Link>
        )}
      </div>

      {isMock && <UpgradeCard />}
    </div>
  )
}

// ── Google Analytics Tab ───────────────────────────────────────────────────────

const GA_CHANNEL_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#06B6D4', '#F97316', '#64748B']

/** Live GA returns YYYYMMDD date strings; mock data uses weekday labels. */
function fmtGaDay(day: string) {
  if (/^\d{8}$/.test(day)) return `${Number(day.slice(4, 6))}/${Number(day.slice(6, 8))}`
  return day
}

function fmtDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

/** Recharts dot renderer that marks only the last data point, GA-style. */
function makeEndDot(color: string, lastIndex: number) {
  return function EndDot(props: { cx?: number; cy?: number; index?: number }) {
    const { cx, cy, index } = props
    if (index !== lastIndex || cx === undefined || cy === undefined) {
      return <g key={`end-dot-${index}`} />
    }
    return (
      <g key={`end-dot-${index}`}>
        <circle cx={cx} cy={cy} r={6} fill={color} fillOpacity={0.2} />
        <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5} />
      </g>
    )
  }
}

function GaDelta({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return null
  const positive = value >= 0
  return (
    <span className={`flex items-center gap-0.5 text-[11px] font-medium ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
      {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(value)}%
      <span className="text-text-soft font-normal ml-0.5">vs prev</span>
    </span>
  )
}

function GoogleAnalyticsContent({
  isMock, gaId, gaData, gaPending, gaNeedsReconnect, gaFetchError, onConnect,
}: {
  isMock: boolean
  gaId: string | null
  gaData: GaData | null
  gaPending: boolean
  gaNeedsReconnect: boolean
  gaFetchError: string
  onConnect: () => void
}) {
  const data: GaData | null = isMock
    ? {
        summary: MOCK_GA_DATA.summary,
        deltas: MOCK_GA_DATA.deltas,
        chartData: MOCK_GA_DATA.chartData,
        activityData: MOCK_GA_DATA.activityData,
        topPages: MOCK_GA_DATA.topPages.map(p => ({ path: p.path, views: p.sessions })),
        channels: MOCK_GA_DATA.trafficSources.map(s => ({ channel: s.source, sessions: s.pct })),
        countries: MOCK_GA_DATA.countries,
        devices: MOCK_GA_DATA.devices,
        events: MOCK_GA_DATA.events,
        hostnames: MOCK_GA_DATA.hostnames,
        sources: MOCK_GA_DATA.sources,
      }
    : gaData

  // Live state, no property connected yet
  if (!isMock && !gaId) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-8 py-16 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
          <Globe size={22} className="text-[#3B82F6]" />
        </div>
        <p className="text-[15px] font-semibold text-text mb-1.5">Connect Google Analytics</p>
        <p className="text-[13px] text-text-sec max-w-sm leading-relaxed mb-5">
          See your website traffic next to your social performance — sessions, visitors,
          top pages, and where your traffic comes from.
        </p>
        <button
          onClick={onConnect}
          className="bg-[#3B82F6] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#2563EB] transition-colors"
        >
          Connect Google Analytics
        </button>
      </div>
    )
  }

  // OAuth session expired or lost GA access — prompt reconnect instead of SA setup copy.
  if (!isMock && gaNeedsReconnect && !data) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-5">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-amber-800">Connection needs refresh</p>
            <p className="text-[12px] text-amber-700 mt-0.5">
              Property {gaId} is still linked, but your Google sign-in needs to be renewed to load analytics again.
            </p>
          </div>
        </div>
        <button
          onClick={onConnect}
          className="mt-4 bg-[#3B82F6] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#2563EB] transition-colors"
        >
          Reconnect Google Analytics
        </button>
      </div>
    )
  }

  // Manual property ID — waiting on service-account Viewer access from setup.
  if (!isMock && gaPending && !data) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-5 flex items-start gap-3">
        <Info size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-semibold text-amber-800">Access pending</p>
          <p className="text-[12px] text-amber-700 mt-0.5">
            Property {gaId} is linked, but read access is still being set up for this account.
            This usually resolves within a few minutes after our team completes the connection.
          </p>
        </div>
      </div>
    )
  }

  // Connected, data still loading
  if (!data) {
    if (gaFetchError) {
      return (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-6 py-5">
          <p className="text-[13px] font-semibold text-red-700">Couldn&apos;t load Google Analytics</p>
          <p className="text-[12px] text-red-600 mt-1">{gaFetchError}</p>
          <button
            onClick={onConnect}
            className="mt-4 bg-[#3B82F6] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#2563EB] transition-colors"
          >
            Reconnect Google Analytics
          </button>
        </div>
      )
    }

    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-8 py-16 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const s = data.summary
  const d = data.deltas
  const activity = data.activityData ?? []
  const topPages = data.topPages ?? []
  const channels = data.channels ?? []
  const countries = data.countries ?? []
  const devices = data.devices ?? []
  const events = data.events ?? []
  const hostnames = data.hostnames ?? []
  const sources = data.sources ?? []
  const maxPageViews = Math.max(...topPages.map(p => p.views), 1)
  const totalChannelSessions = channels.reduce((sum, c) => sum + c.sessions, 0) || 1
  const maxCountryUsers = Math.max(...countries.map(c => c.users), 1)
  const totalDeviceUsers = devices.reduce((sum, dv) => sum + dv.users, 0) || 1
  const maxEventCount = Math.max(...events.map(e => e.count), 1)
  const maxHostnameSessions = Math.max(...hostnames.map(h => h.sessions), 1)
  const totalSourceSessions = sources.reduce((sum, s) => sum + s.sessions, 0) || 1

  const kpis: { label: string; value: string; delta?: number | null }[] = [
    { label: 'Sessions',     value: fmt(s.sessions),  delta: d?.sessions },
    { label: 'Active users', value: fmt(s.users),     delta: d?.users },
    { label: 'New users',    value: s.newUsers !== undefined ? fmt(s.newUsers) : '—', delta: d?.newUsers },
    { label: 'Pageviews',    value: fmt(s.pageviews), delta: d?.pageviews },
    { label: 'Bounce rate',  value: `${s.bounceRate}%` },
    { label: 'Avg session',  value: s.avgSessionDuration !== undefined ? fmtDuration(s.avgSessionDuration) : '—' },
  ]

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map(k => (
          <div key={k.label} className="relative bg-white rounded-2xl border border-gray-100 p-4">
            {isMock && <DemoDot />}
            <p className="text-[11px] font-medium text-text-soft uppercase tracking-wide mb-2">{k.label}</p>
            <span className="text-[22px] font-[500] text-text leading-none">{k.value}</span>
            <div className="mt-2 h-4">
              <GaDelta value={k.delta} />
            </div>
          </div>
        ))}
      </div>

      {/* Traffic over time + User activity over time */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Traffic over time" subtitle="Sessions and active users" isMock={isMock}>
          <div className="px-4 pt-3 pb-3">
            <div className="flex items-center gap-4 px-2 pb-2">
              <span className="flex items-center gap-1.5 text-[11px] text-text-sec">
                <span className="w-2 h-2 rounded-full bg-[#3B82F6]" /> Sessions
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-text-sec">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" /> Active users
              </span>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={data.chartData}>
                <defs>
                  <linearGradient id="gaGradSessions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gaGradUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="day" tickFormatter={fmtGaDay} tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  labelFormatter={(v) => fmtGaDay(String(v))}
                  contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #f0f0f0', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}
                />
                <Area type="monotone" dataKey="sessions" stroke="#3B82F6" strokeWidth={2.5} fill="url(#gaGradSessions)" name="Sessions"
                  dot={makeEndDot('#3B82F6', data.chartData.length - 1)} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="users" stroke="#10B981" strokeWidth={2.5} fill="url(#gaGradUsers)" name="Active users"
                  dot={makeEndDot('#10B981', data.chartData.length - 1)} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* User activity over time — rolling 1 / 7 / 30-day active users */}
        {activity.length > 0 && (
          <ChartCard title="User activity over time" subtitle="Rolling active users" isMock={isMock}>
            <div className="flex items-stretch px-4 pt-3 pb-3 gap-2">
              <div className="flex-1 min-w-0 pt-7">
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={activity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="day" tickFormatter={fmtGaDay} tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={36} />
                    <Tooltip
                      labelFormatter={(v) => fmtGaDay(String(v))}
                      contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #f0f0f0', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}
                    />
                    <Line type="monotone" dataKey="mau" stroke="#3B82F6" strokeWidth={2.5} name="30 days"
                      dot={makeEndDot('#3B82F6', activity.length - 1)} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="wau" stroke="#10B981" strokeWidth={2.5} name="7 days"
                      dot={makeEndDot('#10B981', activity.length - 1)} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="dau" stroke="#F59E0B" strokeWidth={2.5} name="1 day"
                      dot={makeEndDot('#F59E0B', activity.length - 1)} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col justify-center gap-4 pl-3 pr-2 border-l border-gray-50 flex-shrink-0">
                {[
                  { label: '30 days', value: activity[activity.length - 1]?.mau ?? 0, color: '#3B82F6' },
                  { label: '7 days',  value: activity[activity.length - 1]?.wau ?? 0, color: '#10B981' },
                  { label: '1 day',   value: activity[activity.length - 1]?.dau ?? 0, color: '#F59E0B' },
                ].map(item => (
                  <div key={item.label}>
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-text-soft uppercase tracking-wide">
                      <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                      {item.label}
                    </span>
                    <span className="block text-[22px] font-[500] text-text leading-tight mt-0.5">{fmt(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top pages */}
        {topPages.length > 0 && (
          <ChartCard title="Top pages" subtitle="Most viewed pages this period" isMock={isMock}>
            <div className="px-5 py-4 space-y-3">
              {topPages.map(p => (
                <div key={p.path} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-[12px] font-medium text-text truncate">{p.path}</span>
                      <span className="text-[12px] text-text-sec flex-shrink-0">{fmt(p.views)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#3B82F6]"
                        style={{ width: `${Math.max((p.views / maxPageViews) * 100, 3)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        )}

        {/* Traffic channels */}
        {channels.length > 0 && (
          <ChartCard title="Traffic channels" subtitle="Where your sessions come from" isMock={isMock}>
            <div className="px-5 py-4 space-y-3">
              {channels.map((c, i) => {
                const pct = Math.round((c.sessions / totalChannelSessions) * 100)
                const color = GA_CHANNEL_COLORS[i % GA_CHANNEL_COLORS.length]
                return (
                  <div key={c.channel} className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="text-[12px] font-medium text-text truncate">{c.channel}</span>
                        <span className="text-[12px] text-text-sec flex-shrink-0">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 3)}%`, background: color }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ChartCard>
        )}
      </div>

      {(hostnames.length > 0 || sources.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {hostnames.length > 0 && (
            <ChartCard title="Hostnames" subtitle="Which domains sent traffic to this property" isMock={isMock}>
              <div className="px-5 py-4 space-y-3">
                {hostnames.map(h => (
                  <div key={h.hostname} className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-[12px] font-medium text-text truncate">{h.hostname}</span>
                      <span className="text-[12px] text-text-sec flex-shrink-0">{fmt(h.sessions)} sessions</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#3B82F6]"
                        style={{ width: `${Math.max((h.sessions / maxHostnameSessions) * 100, 3)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}

          {sources.length > 0 && (
            <ChartCard title="Session source / medium" subtitle="Where sessions started — e.g. google / organic" isMock={isMock}>
              <div className="px-5 py-4 space-y-3">
                {sources.map((src, i) => {
                  const pct = Math.round((src.sessions / totalSourceSessions) * 100)
                  const color = GA_CHANNEL_COLORS[i % GA_CHANNEL_COLORS.length]
                  return (
                    <div key={src.label} className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-[12px] font-medium text-text truncate font-mono">{src.label}</span>
                          <span className="text-[12px] text-text-sec flex-shrink-0">{fmt(src.sessions)} · {pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 3)}%`, background: color }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ChartCard>
          )}
        </div>
      )}

      {(countries.length > 0 || devices.length > 0 || events.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Users by country */}
          {countries.length > 0 && (
            <ChartCard title="Users by country" subtitle="Top countries this period" isMock={isMock}>
              <div className="px-5 py-4 space-y-3">
                {countries.map(c => (
                  <div key={c.country} className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-[12px] font-medium text-text truncate">{c.country}</span>
                      <span className="text-[12px] text-text-sec flex-shrink-0">{fmt(c.users)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#3B82F6]"
                        style={{ width: `${Math.max((c.users / maxCountryUsers) * 100, 3)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}

          {/* Devices */}
          {devices.length > 0 && (
            <ChartCard title="Devices" subtitle="Active users by device" isMock={isMock}>
              <div className="px-5 py-4 space-y-4">
                {devices.map((dv, i) => {
                  const pct = Math.round((dv.users / totalDeviceUsers) * 100)
                  const color = GA_CHANNEL_COLORS[i % GA_CHANNEL_COLORS.length]
                  return (
                    <div key={dv.device} className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-[12px] font-medium text-text capitalize">{dv.device}</span>
                          <span className="text-[12px] text-text-sec flex-shrink-0">{pct}% · {fmt(dv.users)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 3)}%`, background: color }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ChartCard>
          )}

          {/* Top events */}
          {events.length > 0 && (
            <ChartCard title="Top events" subtitle="Event count by event name" isMock={isMock}>
              <div className="px-5 py-4 space-y-2.5">
                {events.map(e => (
                  <div key={e.name} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="h-1 rounded-full bg-[#8B5CF6]/60 flex-shrink-0" style={{ width: `${Math.max((e.count / maxEventCount) * 48, 4)}px` }} />
                      <span className="text-[12px] font-medium text-text truncate font-mono">{e.name}</span>
                    </div>
                    <span className="text-[12px] text-text-sec flex-shrink-0">{fmt(e.count)}</span>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}
        </div>
      )}

      {isMock && <UpgradeCard />}
    </div>
  )
}

// ── Posting Analytics Tab ──────────────────────────────────────────────────────

function PostingAnalyticsContent({
  isMock,
  dataState,
  fetchError,
  loading,
  syncPending,
  onConnect,
}: {
  isMock: boolean
  dataState: AnalyticsDataState
  fetchError: string
  loading: boolean
  syncPending: boolean
  onConnect: () => void
}) {
  if (dataState === 'empty') {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-6 py-14 text-center">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
          <Plus size={20} className="text-[#3B82F6]" />
        </div>
        <p className="text-[15px] font-semibold text-text mb-2">Connect a social account</p>
        <p className="text-[13px] text-text-sec max-w-md mx-auto mb-5">
          Posting analytics will populate from your connected accounts. Connect Instagram, Facebook, or other platforms to get started.
        </p>
        <button
          type="button"
          onClick={onConnect}
          className="inline-flex items-center gap-1.5 bg-[#3B82F6] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#2563EB] transition-colors"
        >
          <Plus size={14} /> Connect accounts
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {fetchError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-xs font-medium text-red-600">{fetchError}</p>
        </div>
      )}

      {!isMock && syncPending && !fetchError && (
        <div className="flex items-start gap-3 rounded-xl border border-pink-100 bg-pink-50 px-4 py-3">
          <Info size={16} className="text-[#F5349B] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-pink-950">Metrics still syncing</p>
            <p className="text-[11px] text-pink-900/80 mt-0.5 leading-relaxed">
              Your account is connected, but post reach and engagement can take up to 24 hours to backfill after a reconnect. Follower count may update first.
            </p>
          </div>
        </div>
      )}

      {loading && !fetchError && (
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
          <p className="text-xs text-text-sec">Loading analytics…</p>
        </div>
      )}

      <StatCards isMock={isMock} />

      {/* Keep Maya's briefing only in mock/demo mode; live Zernio layout does not include it. */}
      {isMock && <MayaBriefingCard isMock={isMock} />}

      {/* 2-col grid for paired charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PostsPerPlatformChart isMock={isMock} />
        <PostsOverTimeChart    isMock={isMock} />
        <LikesPerPlatformChart isMock={isMock} />
        <LikesOverTimeChart    isMock={isMock} />
        <EngagementOverTimeChart isMock={isMock} />
        <BestTimeToPostHeatmap   isMock={isMock} />
        <FollowerEvolutionChart  isMock={isMock} />
        <PlatformBreakdownTable  isMock={isMock} />
        <TopPerformingPostsTable isMock={isMock} />
        <PostingFrequencyChart        isMock={isMock} />
        <EngagementAccumulationChart  isMock={isMock} />
      </div>

      {isMock && <UpgradeCard />}
    </div>
  )
}

// ── Connect Panel ─────────────────────────────────────────────────────────────

function ConnectPanel({
  open, onClose, dataState, plan, connectedPlatforms, connectedAccounts, onAccountsChange, onDisconnect,
  gaPropertyId, gaOAuthEmail, onGAConnect, onGADisconnect,
}: {
  open: boolean
  onClose: () => void
  dataState: AnalyticsDataState
  plan: string
  connectedPlatforms: string[]
  connectedAccounts: ZernioConnectedAccountInfo[]
  onAccountsChange: (accounts: ZernioConnectedAccountInfo[]) => void
  onDisconnect: (platform: string, remaining?: string[]) => void
  gaPropertyId: string | null
  gaOAuthEmail: string | null
  onGAConnect: () => void
  onGADisconnect: () => Promise<void>
}) {
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [connectError, setConnectError] = useState('')
  const [xCostModal, setXCostModal] = useState(false)
  const [xUpgradeModal, setXUpgradeModal] = useState(false)
  const [pendingXConnect, setPendingXConnect] = useState(false)
  const [metaModalPlatform, setMetaModalPlatform] = useState<string | null>(null)
  const [metaModalMode, setMetaModalMode] = useState<'connect' | 'reconnect'>('connect')
  const [pendingMetaConnect, setPendingMetaConnect] = useState(false)
  const [pendingMetaReconnect, setPendingMetaReconnect] = useState(false)
  const [accountsLoading, setAccountsLoading] = useState(false)

  useEffect(() => {
    if (!open || dataState !== 'live') return
    let cancelled = false
    setAccountsLoading(true)
    fetch('/api/integrations/zernio/accounts', { cache: 'no-store' })
      .then(res => res.json())
      .then((json: { accounts?: ZernioConnectedAccountInfo[] }) => {
        if (cancelled || !Array.isArray(json.accounts)) return
        onAccountsChange(json.accounts)
      })
      .catch(() => { /* fail soft */ })
      .finally(() => {
        if (!cancelled) setAccountsLoading(false)
      })
    return () => { cancelled = true }
  }, [open, dataState, onAccountsChange])

  const handleConnect = async (platform: string, opts?: { reconnect?: boolean }) => {
    if (platformRequiresGrowthPlus(platform) && !canConnectSocialPlatform(plan, platform)) {
      setXUpgradeModal(true)
      return
    }
    if (platform === 'x' && !pendingXConnect) {
      setXCostModal(true)
      return
    }
    if (isMetaOAuthPlatform(platform) && !pendingMetaConnect && !pendingMetaReconnect && !opts?.reconnect) {
      setMetaModalMode(opts?.reconnect ? 'reconnect' : 'connect')
      setMetaModalPlatform(platform)
      return
    }
    setPendingXConnect(false)
    setPendingMetaConnect(false)
    const isReconnect = pendingMetaReconnect || opts?.reconnect === true
    setPendingMetaReconnect(false)
    setConnecting(platform)
    setConnectError('')
    try {
      const res = await fetch('/api/integrations/zernio/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, reconnect: isReconnect }),
      })
      const data = await res.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
        return // page is navigating away — leave button in "Opening..." state
      }
      // API responded but no authUrl — surface the actual error
      if (data.error === 'payment_required') {
        setConnectError(data.message ?? 'Account connection limit reached. Please contact support to connect more accounts.')
      } else if (data.error === 'growth_plan_required') {
        setConnectError(data.message ?? X_CONNECT_GROWTH_GATE_MESSAGE)
        setXUpgradeModal(true)
      } else {
        setConnectError(data.error ?? data.message ?? 'Could not open connect page. Try again.')
      }
      setConnecting(null)
    } catch {
      setConnectError('Network error. Please try again.')
      setConnecting(null)
    }
  }

  const handleDisconnect = async (platform: string, accountId?: string) => {
    setDisconnecting(platform)
    setConnectError('')
    try {
      const res = await fetch('/api/integrations/zernio/disconnect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, accountId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setConnectError(data.error ?? 'Could not disconnect. Try again.')
        return
      }
      const remaining = Array.isArray(data.remaining)
        ? (data.remaining as string[]).map(p => p.toLowerCase())
        : undefined
      onDisconnect(platform, remaining)

      const accountsRes = await fetch('/api/integrations/zernio/accounts', { cache: 'no-store' })
      const accountsJson = await accountsRes.json().catch(() => ({}))
      if (accountsRes.ok && Array.isArray(accountsJson.accounts)) {
        onAccountsChange(accountsJson.accounts)
      } else if (remaining) {
        onAccountsChange(connectedAccounts.filter(a => remaining.includes(a.platform.toLowerCase())))
      } else {
        onAccountsChange(connectedAccounts.filter(a => a.platform !== platform))
      }
    } finally {
      setDisconnecting(null)
    }
  }

  const handleGADisconnect = async () => {
    setDisconnecting('google_analytics')
    try {
      await onGADisconnect()
    } finally {
      setDisconnecting(null)
    }
  }

  if (!open) return null

  return (
    <>
      <MetaConnectDisclosureModal
        open={Boolean(metaModalPlatform)}
        platform={metaModalPlatform}
        mode={metaModalMode}
        onCancel={() => {
          setMetaModalPlatform(null)
          setMetaModalMode('connect')
        }}
        onContinue={() => {
          const platform = metaModalPlatform
          const reconnect = metaModalMode === 'reconnect'
          setMetaModalPlatform(null)
          setMetaModalMode('connect')
          if (!platform) return
          if (reconnect) {
            setPendingMetaReconnect(true)
          } else {
            setPendingMetaConnect(true)
          }
          handleConnect(platform, { reconnect })
        }}
      />

      {/* X/Twitter connect disclosure (Growth+ only) */}
      {xCostModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <p className="text-[15px] font-semibold text-text mb-1">Connect X / Twitter</p>
            <p className="text-[13px] text-text-sec mb-4 leading-relaxed">
              X is included on Growth and ProAgent plans. Agent7even covers platform API fees with fair-use limits while we measure usage.
            </p>
            <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1.5">
              <p className="text-[13px] text-text-sec">Analytics, publishing, and scheduling work like your other connected accounts.</p>
              <p className="text-[12px] text-text-soft">Heavy automated usage may be throttled to protect your workspace.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setXCostModal(false)}
                className="flex-1 border border-gray-200 text-sm font-medium text-text-sec px-4 py-2 rounded-xl hover:border-gray-300 transition-colors">
                Cancel
              </button>
              <button onClick={() => { setXCostModal(false); setPendingXConnect(true); handleConnect('x') }}
                className="flex-1 bg-[#3B82F6] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#2563EB] transition-colors">
                Connect X
              </button>
            </div>
          </div>
        </div>
      )}

      {/* X / Twitter Growth+ upgrade gate */}
      {xUpgradeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <p className="text-[15px] font-semibold text-text mb-1">Upgrade to connect X</p>
            <p className="text-[13px] text-text-sec mb-4 leading-relaxed">
              {X_CONNECT_GROWTH_GATE_MESSAGE} Instagram, Facebook, TikTok, YouTube, and LinkedIn remain available on Starter.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setXUpgradeModal(false)}
                className="flex-1 border border-gray-200 text-sm font-medium text-text-sec px-4 py-2 rounded-xl hover:border-gray-300 transition-colors">
                Not now
              </button>
              <a href="/dashboard/billing"
                className="flex-1 bg-[#3B82F6] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#2563EB] transition-colors text-center">
                View plans
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-sm z-50 bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <p className="text-[15px] font-semibold text-text">Connect your accounts</p>
            <p className="text-xs text-text-sec mt-0.5">Maya uses these to track performance and publish content.</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
            <X size={14} className="text-gray-500" />
          </button>
        </div>

        {dataState === 'mock' ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
              <span className="text-amber-500 text-xl">🔒</span>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-text mb-2">Activate your plan first</p>
              <p className="text-sm text-text-sec leading-relaxed">
                Connecting social accounts requires an active paid plan. Trial users see demo data only.
              </p>
            </div>
            <a href="/dashboard/billing"
              className="bg-[#3B82F6] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#2563EB] transition-colors w-full text-center">
              Activate your plan →
            </a>
            <a href="/pricing" className="text-sm text-[#3B82F6] hover:underline">View plan options</a>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {connectError && (
              <div className="mb-3 px-3 py-2 rounded-lg text-[12px] text-red-700 bg-red-50 border border-red-100">
                {connectError}
              </div>
            )}
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-soft mb-3">Web analytics</p>
            <div className="flex items-center justify-between py-2.5 mb-5 border-b border-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Globe size={15} className="text-gray-500" />
                </div>
                <div>
                  <span className="text-[13px] font-medium text-text">Google Analytics</span>
                  {gaPropertyId ? (
                    <p className="text-[11px] text-[#10B981]">
                      Connected{gaOAuthEmail ? ` · ${gaOAuthEmail}` : ` · Property ${gaPropertyId}`}
                    </p>
                  ) : (
                    <p className="text-[11px] text-text-soft">Website traffic & top pages</p>
                  )}
                </div>
              </div>
              {gaPropertyId ? (
                <button
                  onClick={handleGADisconnect}
                  disabled={disconnecting === 'google_analytics'}
                  className="text-[12px] font-medium text-red-500 hover:text-red-600 disabled:opacity-50 transition-colors"
                >
                  {disconnecting === 'google_analytics' ? 'Removing…' : 'Disconnect'}
                </button>
              ) : (
                <button
                  onClick={onGAConnect}
                  className="text-[12px] font-semibold text-[#3B82F6] border border-[#BFDBFE] bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  Connect
                </button>
              )}
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-soft mb-3">Social accounts</p>
            <SocialMetaConnectNotice className="mb-3" />
            {accountsLoading && (
              <p className="text-[11px] text-text-soft mb-2">Refreshing connected accounts…</p>
            )}
            <div className="space-y-0.5">
              {ALL_PLATFORMS.map(id => {
                const meta = PLATFORM_META[id]
                const account = connectedAccounts.find(a => a.platform === id)
                const isConnected = dataState === 'live'
                  ? Boolean(account)
                  : connectedPlatforms.includes(id)
                const isConnecting = connecting === id
                const isDisconnecting = disconnecting === id
                const xGrowthGated = id === 'x' && !isConnected && !canConnectSocialPlatform(plan, id)
                return (
                  <div key={id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <PlatformAvatar id={id} size={28} />
                      <div>
                        <span className="text-[13px] font-medium text-text">{meta?.label ?? id}</span>
                        {id === 'x' && !isGrowthPlusPlan(plan) && !isConnected && (
                          <p className="text-[11px] text-text-soft">Growth or ProAgent</p>
                        )}
                        {isConnected && (
                          <p className="text-[11px] text-[#10B981]">{formatConnectedAccountLabel(account)}</p>
                        )}
                      </div>
                    </div>
                    {isConnected ? (
                      <div className="flex items-center gap-2">
                        {(isMetaOAuthPlatform(id) || id === 'x') && (
                          <button
                            type="button"
                            onClick={() => handleConnect(id, { reconnect: true })}
                            disabled={isConnecting || isDisconnecting}
                            className="text-[12px] font-medium text-[#3B82F6] hover:text-[#2563EB] disabled:opacity-50 transition-colors"
                          >
                            {isConnecting ? 'Opening…' : 'Reconnect'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDisconnect(id, account?.id)}
                          disabled={isDisconnecting}
                          className="text-[12px] font-medium text-red-500 hover:text-red-600 disabled:opacity-50 transition-colors"
                        >
                          {isDisconnecting ? 'Removing…' : 'Disconnect'}
                        </button>
                      </div>
                    ) : xGrowthGated ? (
                      <a
                        href="/dashboard/billing"
                        className="text-[12px] font-semibold text-[#3B82F6] border border-[#BFDBFE] bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        Upgrade
                      </a>
                    ) : (
                      <button
                        onClick={() => handleConnect(id)}
                        disabled={isConnecting}
                        className="text-[12px] font-semibold text-[#3B82F6] border border-[#BFDBFE] bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                      >
                        {isConnecting ? 'Opening…' : 'Connect'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── GA Connect Modal ──────────────────────────────────────────────────────────

function GAConnectModal({
  onClose, onAgencySuccess, currentPropertyId,
}: {
  onClose: () => void
  onAgencySuccess: (value: string) => void
  currentPropertyId: string
}) {
  const [showAgencyForm, setShowAgencyForm] = useState(false)
  const [value, setValue] = useState(currentPropertyId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submitAgency = async () => {
    if (!value.trim()) { setError('Please enter a Property ID.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/analytics/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'google_analytics', value: value.trim() }),
      })
      if (!res.ok) throw new Error('Failed')
      onAgencySuccess(value.trim())
    } catch { setError('Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
        <button onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
          <X size={14} className="text-gray-500" />
        </button>
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-gray-100 flex-shrink-0">
            <Globe size={16} className="text-gray-500" />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-widest uppercase text-text-soft">Connect</p>
            <h2 className="text-lg font-bold text-text leading-tight">Google Analytics</h2>
          </div>
        </div>
        {!showAgencyForm ? (
          <>
            <p className="text-sm text-text-sec mb-5">Sign in with Google to automatically connect your GA4 property.</p>
            <a href="/api/analytics/ga-connect"
              className="flex items-center justify-center gap-3 w-full py-3 bg-white border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all text-sm font-semibold text-gray-700 mb-4">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </a>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
              <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400">or</span></div>
            </div>
            <button onClick={() => setShowAgencyForm(true)}
              className="w-full py-2.5 text-sm font-medium text-text-sec hover:text-text transition-colors">
              Set up with Agent7even&apos;s help →
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-text-sec mb-5">Enter your GA4 Property ID and our team will complete the connection.</p>
            <label className="block text-xs font-semibold text-text mb-1.5">GA4 Property ID</label>
            <input type="text" value={value} onChange={e => { setValue(e.target.value); setError('') }}
              placeholder="123456789"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-text placeholder-gray-300 focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-colors" />
            <p className="text-xs text-gray-400 mt-2">Find in Google Analytics → Admin → Property Settings → Property ID.</p>
            {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAgencyForm(false)}
                className="flex-1 py-2.5 text-sm font-medium text-text-sec border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">Back</button>
              <button onClick={submitAgency} disabled={loading}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#3B82F6] rounded-xl hover:bg-[#2563EB] disabled:opacity-50 transition-colors">
                {loading ? 'Saving…' : 'Request connection'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PropertySelectorModal({
  oauthEmail, onClose, onSelect,
}: {
  oauthEmail: string | null
  onClose: () => void
  onSelect: (propertyId: string) => void
}) {
  const [properties, setProperties] = useState<GAProperty[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/analytics/ga-properties')
      .then(r => r.json())
      .then(d => {
        if (d.needsReconnect) {
          setError(d.error ?? 'Your Google sign-in expired. Reconnect to continue.')
          return
        }
        if (d.error) {
          setError(d.error.startsWith('API error:') ? d.error : `API error: ${d.error}`)
          return
        }
        setProperties(d.properties ?? [])
        if (d.properties?.length === 1) setSelected(d.properties[0].id)
      })
      .catch(() => setError('Could not load properties.'))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    if (!selected) { setError('Please select a property.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/analytics/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'google_analytics', value: selected }),
      })
      if (!res.ok) throw new Error('Failed')
      onSelect(selected)
    } catch { setError('Something went wrong.') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
        <button onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
          <X size={14} className="text-gray-500" />
        </button>
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle size={18} className="text-emerald-500" />
          <p className="text-[10px] font-semibold tracking-widest uppercase text-emerald-600">Google Connected</p>
        </div>
        <h2 className="text-lg font-bold text-text mb-1">Select your property</h2>
        {oauthEmail && <p className="text-xs text-gray-400 mb-5">Signed in as <span className="font-medium text-text-sec">{oauthEmail}</span></p>}
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="w-6 h-6 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-text font-medium mb-2">
              {error ? 'Reconnect Google Analytics' : 'No GA4 properties found'}
            </p>
            {!error && (
              <p className="text-xs text-text-sec mb-4">
                This Google account may not have access to any GA4 properties yet.
              </p>
            )}
            <a href="/api/analytics/ga-connect"
              className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-[#3B82F6] px-4 py-2.5 rounded-lg hover:bg-[#2563EB] transition-colors">
              {error ? 'Reconnect Google Analytics' : 'Try a different Google account'}
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {properties.map(p => (
              <button key={p.id} onClick={() => setSelected(p.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${selected === p.id ? 'border-[#3B82F6] bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                <div>
                  <p className="text-sm font-semibold text-text">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.account ? `${p.account} · ` : ''}ID: {p.id}</p>
                </div>
                {selected === p.id && <CheckCircle size={16} className="text-[#3B82F6] flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        {properties.length > 0 && (
          <button onClick={save} disabled={saving || !selected}
            className="w-full mt-5 py-3 text-sm font-semibold text-white bg-[#3B82F6] rounded-xl hover:bg-[#2563EB] disabled:opacity-50 transition-colors">
            {saving ? 'Connecting…' : 'Connect property'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AnalyticsClient({
  companyName,
  plan,
  dataState,
  gaMeasurementId,
  gaOAuthConnected,
  gaOAuthEmail,
  zernioConnectedPlatforms,
  zernioConnectedAccounts,
  canManageConnections = true,
}: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [activeTab, setActiveTab]           = useState<PostingTab>('posting')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [sourceFilter, setSourceFilter]     = useState('all')
  const [dateRange, setDateRange]           = useState<DateRange>('30d')

  // Restore filter state persisted from a previous session
  useEffect(() => {
    const pl  = localStorage.getItem('analytics_platform')
    const src = localStorage.getItem('analytics_source')
    const dr  = localStorage.getItem('analytics_dateRange') as DateRange | null
    const validRanges: DateRange[] = ['7d', '30d', '90d', '6m', '1y']
    if (pl)  setPlatformFilter(pl)
    if (src) setSourceFilter(src)
    if (dr && validRanges.includes(dr)) setDateRange(dr)
  }, [])
  const [connectPanelOpen, setConnectPanelOpen] = useState(false)
  const [showGAModal, setShowGAModal]       = useState(false)
  const [showPropertySelector, setShowPropertySelector] = useState(false)
  const [oauthError, setOauthError]         = useState('')
  const [oauthErrorScope, setOauthErrorScope] = useState<'ga' | 'zernio' | null>(null)
  const [gaId, setGaId]                     = useState(gaMeasurementId)
  const [oauthConnected, setOauthConnected] = useState(gaOAuthConnected)
  const [gaData, setGaData]                 = useState<GaData | null>(null)
  const [gaPending, setGaPending]           = useState(false)
  const [gaNeedsReconnect, setGaNeedsReconnect] = useState(false)
  const [gaFetchError, setGaFetchError] = useState('')
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>(zernioConnectedPlatforms)
  const [connectedAccounts, setConnectedAccounts] = useState<ZernioConnectedAccountInfo[]>(zernioConnectedAccounts)
  const [zernioToast, setZernioToast]       = useState('')
  const [postingData, setPostingData]       = useState<PostingAnalytics>(() => initialPostingData(dataState))
  const [postingFetchError, setPostingFetchError] = useState('')
  const [postingLoading, setPostingLoading] = useState(false)
  const [analyticsSyncPending, setAnalyticsSyncPending] = useState(false)
  const [inboxData, setInboxData]           = useState<AnalyticsInboxData>(() => initialInboxData(dataState))
  const [inboxFetchError, setInboxFetchError] = useState('')
  const [inboxLoading, setInboxLoading]     = useState(false)
  const zernioFetchGen = useRef(0)

  const isMock = dataState === 'mock'

  const mayaContext = useMemo(
    () => buildAnalyticsMayaContext({
      companyName,
      dataState,
      activeTab,
      dateRange,
      gaId,
      oauthConnected,
      gaOAuthEmail,
      gaData,
      gaPending,
      connectedPlatforms,
      postingData,
      inboxData,
      connectPanelOpen,
      showGAModal,
      showPropertySelector,
    }),
    [
      companyName,
      dataState,
      activeTab,
      dateRange,
      gaId,
      oauthConnected,
      gaOAuthEmail,
      gaData,
      gaPending,
      connectedPlatforms,
      postingData,
      inboxData,
      connectPanelOpen,
      showGAModal,
      showPropertySelector,
    ],
  )
  useMayaContext(mayaContext)

  // GA OAuth redirects
  useEffect(() => {
    const oauthStatus = searchParams.get('ga_oauth')
    const gaError     = searchParams.get('ga_error')
    if (oauthStatus === 'success') {
      setOauthConnected(true); setShowPropertySelector(true)
      router.replace('/dashboard/analytics')
    } else if (gaError) {
      const msgs: Record<string, string> = {
        access_denied:         'Google sign-in was cancelled.',
        invalid_state:         'Session expired — please try reconnecting.',
        invalid_client:        'Google OAuth is misconfigured on our side (client secret). Contact support if this persists.',
        token_exchange_failed: 'Google sign-in completed but we could not finish the connection. Please try again.',
        no_refresh_token:      'Google did not issue a new connection token. Remove Agent7even from your Google Account connections (myaccount.google.com → Security → Third-party access), then reconnect.',
        save_failed:           'Failed to save connection. Please try again.',
      }
      setOauthError(msgs[gaError] ?? 'Something went wrong.')
      setOauthErrorScope('ga')
      setActiveTab('ga')
      router.replace('/dashboard/analytics')
    }
  }, [searchParams, router])

  // Zernio OAuth redirects
  useEffect(() => {
    const connected = searchParams.get('zernio_connected')
    const zernioErr = searchParams.get('zernio_error')
    const username = searchParams.get('zernio_username')
    const accountId = searchParams.get('zernio_account_id')
    if (connected) {
      const label = connected.charAt(0).toUpperCase() + connected.slice(1)
      const handle = username?.replace(/^@/, '') ?? ''
      setZernioToast(`${label} connected${handle ? ` as @${handle}` : ''}`)
      setConnectedPlatforms(prev => prev.includes(connected) ? prev : [...prev, connected])
      if (handle) {
        setConnectedAccounts(prev => {
          const rest = prev.filter(a => a.platform !== connected)
          return [...rest, {
            id: accountId ?? '',
            platform: connected,
            username: handle,
            displayName: '',
            followersCount: 0,
            connectedAt: new Date().toISOString(),
          }]
        })
      }
      router.replace('/dashboard/analytics')
    } else if (zernioErr) {
      const msgs: Record<string, string> = {
        access_denied:      'Account connection was cancelled.',
        invalid_state:      'Session expired — please try again.',
        save_failed:        'Failed to save connection. Please try again.',
        profile_not_found:  'Profile not found. Please try again.',
        profile_mismatch:   'Account profile mismatch. Please reconnect this platform.',
        no_pages:           'No Facebook Pages found on this account. Connect a Page in Meta Business Suite first.',
      }
      setOauthError(msgs[zernioErr] ?? 'Something went wrong connecting your account.')
      setOauthErrorScope('zernio')
      router.replace('/dashboard/analytics')
    }
  }, [searchParams, router])

  // Fetch GA data (live/empty state only)
  const fetchGaData = useCallback(async () => {
    if (dataState === 'mock' || !gaId) return
    setGaFetchError('')
    try {
      const res  = await fetch(`/api/analytics/ga-data?range=${dateRange}`)
      const json = await res.json()
      if (json.connected) {
        setGaData(json)
        setGaPending(false)
        setGaNeedsReconnect(false)
      } else if (json.needsReconnect) {
        setGaData(null)
        setGaPending(false)
        setGaNeedsReconnect(true)
      } else if (json.pending) {
        setGaData(null)
        setGaPending(true)
        setGaNeedsReconnect(false)
      } else {
        setGaData(null)
        setGaPending(false)
        setGaNeedsReconnect(false)
        setGaFetchError(
          typeof json.error === 'string'
            ? json.error
            : "Couldn't load Google Analytics. Try reconnecting your property.",
        )
      }
    } catch {
      setGaData(null)
      setGaPending(false)
      setGaNeedsReconnect(false)
      setGaFetchError("Couldn't load Google Analytics. Check your connection and try again.")
    }
  }, [dataState, gaId, dateRange])

  useEffect(() => { fetchGaData() }, [fetchGaData])

  // Clear stale analytics immediately when platform or date range changes.
  useEffect(() => {
    if (dataState !== 'live') return
    setPostingData(emptyLivePostingAnalytics())
    setPostingFetchError('')
    setAnalyticsSyncPending(false)
  }, [platformFilter, dateRange, dataState])

  // Fetch Zernio social analytics (live state only)
  const fetchZernioData = useCallback(async () => {
    if (dataState !== 'live') return
    const fetchGen = ++zernioFetchGen.current
    setPostingLoading(true)
    setPostingFetchError('')
    try {
      const q = new URLSearchParams({ dateRange })
      if (platformFilter !== 'all') q.set('platform', platformFilter)
      const res  = await fetch(`/api/analytics/zernio/social?${q}`, { cache: 'no-store' })
      const json = await res.json()
      if (fetchGen !== zernioFetchGen.current) return
      if (!res.ok || json.error) {
        const detail = typeof json.detail === 'string' ? json.detail : ''
        setPostingFetchError(
          detail
            ? `Couldn't load analytics — ${detail}`
            : "Couldn't load analytics. Try again or reconnect your accounts.",
        )
        setPostingData(emptyLivePostingAnalytics())
        setAnalyticsSyncPending(false)
        return
      }
      const mapped = mapZernioResponse(json, dateRange, platformFilter)
      if (fetchGen !== zernioFetchGen.current) return
      setPostingData(mapped ?? emptyLivePostingAnalytics())
      setAnalyticsSyncPending(Boolean(json.analyticsSyncPending))
    } catch {
      if (fetchGen !== zernioFetchGen.current) return
      setPostingFetchError("Couldn't load analytics. Check your connection and try again.")
      setPostingData(emptyLivePostingAnalytics())
      setAnalyticsSyncPending(false)
    } finally {
      if (fetchGen === zernioFetchGen.current) setPostingLoading(false)
    }
  }, [dataState, dateRange, platformFilter])

  useEffect(() => { fetchZernioData() }, [fetchZernioData])

  const fetchInboxData = useCallback(async () => {
    if (dataState !== 'live') return
    setInboxLoading(true)
    setInboxFetchError('')
    try {
      const q = new URLSearchParams({ dateRange })
      const res  = await fetch(`/api/analytics/zernio/inbox?${q}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || json.error) {
        const detail = typeof json.detail === 'string' ? json.detail : ''
        setInboxFetchError(
          detail
            ? `Couldn't load inbox analytics — ${detail}`
            : "Couldn't load inbox analytics. Try again or reconnect your accounts.",
        )
        setInboxData(emptyAnalyticsInbox())
        return
      }
      setInboxData(json.inbox ?? emptyAnalyticsInbox())
    } catch {
      setInboxFetchError("Couldn't load inbox analytics. Check your connection and try again.")
      setInboxData(emptyAnalyticsInbox())
    } finally {
      setInboxLoading(false)
    }
  }, [dataState, dateRange])

  useEffect(() => { fetchInboxData() }, [fetchInboxData])

  const requestConnect = () => {
    if (canManageConnections) setConnectPanelOpen(true)
  }

  const handleGAConnect = () => {
    if (!canManageConnections) return
    if (gaNeedsReconnect) {
      window.location.href = '/api/analytics/ga-connect'
      return
    }
    oauthConnected ? setShowPropertySelector(true) : setShowGAModal(true)
  }

  const handleGADisconnect = async () => {
    await fetch('/api/analytics/disconnect', { method: 'POST' })
    setGaId(null)
    setGaData(null)
    setGaPending(false)
    setGaNeedsReconnect(false)
    setOauthConnected(false)
  }

  const TABS: { id: PostingTab; label: string }[] = [
    { id: 'posting', label: 'Posting analytics' },
    { id: 'inbox',   label: 'Inbox analytics'   },
    { id: 'ga',      label: 'Google analytics'  },
  ]

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-8">

      {/* Modals */}
      {showGAModal && (
        <GAConnectModal
          currentPropertyId={gaId ?? ''}
          onClose={() => setShowGAModal(false)}
          onAgencySuccess={v => { setGaId(v); setShowGAModal(false) }}
        />
      )}
      {showPropertySelector && (
        <PropertySelectorModal
          oauthEmail={gaOAuthEmail}
          onClose={() => setShowPropertySelector(false)}
          onSelect={id => { setGaId(id); setShowPropertySelector(false) }}
        />
      )}

      <ConnectPanel
        open={connectPanelOpen}
        onClose={() => setConnectPanelOpen(false)}
        dataState={dataState}
        plan={plan}
        connectedPlatforms={connectedPlatforms}
        connectedAccounts={connectedAccounts}
        onAccountsChange={setConnectedAccounts}
        onDisconnect={(p, remaining) => {
          if (remaining) {
            setConnectedPlatforms(remaining)
            setConnectedAccounts(prev => prev.filter(a => remaining.includes(a.platform.toLowerCase())))
          } else {
            setConnectedPlatforms(prev => prev.filter(x => x !== p))
            setConnectedAccounts(prev => prev.filter(a => a.platform !== p))
          }
        }}
        gaPropertyId={gaId}
        gaOAuthEmail={gaOAuthEmail}
        onGAConnect={() => { setConnectPanelOpen(false); handleGAConnect() }}
        onGADisconnect={handleGADisconnect}
      />

      {/* Zernio connect toast */}
      {zernioToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#0F172A] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-xl"
          onAnimationEnd={() => setZernioToast('')}>
          <CheckCircle size={14} className="text-[#10B981]" />
          {zernioToast}
          <button onClick={() => setZernioToast('')} className="ml-2 opacity-60 hover:opacity-100">
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-[500] text-text">Analytics</h1>
            <p className="text-[13px] text-text-sec mt-0.5">View post performance metrics</p>
          </div>
          {canManageConnections && (
            <button
              onClick={() => setConnectPanelOpen(true)}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-[#3B82F6] bg-blue-50 border border-[#BFDBFE] px-3.5 py-2 rounded-xl hover:bg-blue-100 transition-colors"
            >
              <Plus size={13} /> Connect accounts
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-end gap-0 border-b border-gray-200 mt-4 overflow-x-auto overflow-y-hidden">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`whitespace-nowrap px-3 py-3 text-[13px] font-medium border-b-2 transition-colors -mb-px sm:px-4 ${
                activeTab === t.id
                  ? 'border-[#3B82F6] text-[#3B82F6] font-semibold'
                  : 'border-transparent text-text-sec hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter bar + demo banner ──────────────────────────────────────── */}
      <FilterBar
        activeTab={activeTab}
        platform={platformFilter}
        profile="default"
        source={sourceFilter}
        dateRange={dateRange}
        isMock={isMock}
        onPlatformChange={v => { setPlatformFilter(v); localStorage.setItem('analytics_platform', v) }}
        onSourceChange={v => { setSourceFilter(v); localStorage.setItem('analytics_source', v) }}
        onDateRangeChange={v => { setDateRange(v as DateRange); localStorage.setItem('analytics_dateRange', v) }}
      />

      {isMock && <AmberBanner />}

      {/* Error toast */}
      {oauthError && (oauthErrorScope !== 'ga' || activeTab === 'ga') && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 mb-5">
          <p className="text-xs font-medium text-red-600">{oauthError}</p>
          <button onClick={() => { setOauthError(''); setOauthErrorScope(null) }} className="text-red-400"><X size={14} /></button>
        </div>
      )}

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      <DateRangeContext.Provider value={dateRange}>
        <PostingDataContext.Provider value={postingData}>
          {activeTab === 'posting' && (
            <PostingAnalyticsContent
              key={`${platformFilter}-${dateRange}`}
              isMock={isMock}
              dataState={dataState}
              fetchError={postingFetchError}
              loading={postingLoading}
              syncPending={analyticsSyncPending}
              onConnect={requestConnect}
            />
          )}
          {activeTab === 'inbox'   && (
            <InboxAnalyticsContent
              isMock={isMock}
              dataState={dataState}
              fetchError={inboxFetchError}
              loading={inboxLoading}
              inbox={inboxData}
              onConnect={requestConnect}
            />
          )}
          {activeTab === 'ga'      && (
            <GoogleAnalyticsContent
              isMock={isMock}
              gaId={gaId}
              gaData={gaData}
              gaPending={gaPending}
              gaNeedsReconnect={gaNeedsReconnect}
              gaFetchError={gaFetchError}
              onConnect={handleGAConnect}
            />
          )}
        </PostingDataContext.Provider>
      </DateRangeContext.Provider>
    </div>
  )
}
