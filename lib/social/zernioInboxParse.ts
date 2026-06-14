import { MOCK_ANALYTICS_INBOX } from '@/lib/analytics/mockData'

/** UI shape consumed by InboxAnalyticsContent — matches mockData for drop-in use. */
export type AnalyticsInboxData = typeof MOCK_ANALYTICS_INBOX

export function emptyAnalyticsInbox(): AnalyticsInboxData {
  return {
    totalComments: 0,
    totalDMs: 0,
    responseRate: 0,
    platforms: [],
    trend: [],
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0
}

function unwrap(raw: unknown): Record<string, unknown> {
  const obj = asObject(raw)
  for (const key of ['data', 'result', 'response'] as const) {
    const nested = obj[key]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested as Record<string, unknown>
    }
  }
  return obj
}

function inDateRange(iso: string | undefined, fromDate: string, toDate: string): boolean {
  if (!iso) return false
  const day = iso.slice(0, 10)
  return day >= fromDate && day <= toDate
}

function fmtTrendLabel(dateStr: string, dateRange: string): string {
  if (!dateStr) return ''
  const d = new Date(`${dateStr}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return dateStr
  if (dateRange === '7d') {
    return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

type CommentRow = {
  platform?: string
  createdTime?: string
  commentCount?: number
}

type ConversationRow = {
  platform?: string
  received?: number
  read?: number
}

type TimeseriesRow = {
  date?: string
  received?: number
  sent?: number
}

type PlatformRow = {
  platform?: string
  received?: number
  sent?: number
  read?: number
}

function extractComments(raw: unknown): CommentRow[] {
  const root = asObject(raw)
  return asArray<CommentRow>(root.data ?? root.comments ?? root.items)
}

function extractConversations(raw: unknown): ConversationRow[] {
  const root = asObject(raw)
  return asArray<ConversationRow>(root.items ?? root.conversations ?? root.data)
}

function extractVolumeSummary(raw: unknown): { received: number; sent: number; read: number } {
  const root = asObject(raw)
  const summary = asObject(root.summary)
  return {
    received: num(summary.received),
    sent: num(summary.sent),
    read: num(summary.read),
  }
}

function extractTimeseries(raw: unknown): TimeseriesRow[] {
  const root = asObject(raw)
  return asArray<TimeseriesRow>(root.timeseries ?? root.timeSeries ?? root.series)
}

function extractByPlatform(raw: unknown): PlatformRow[] {
  const root = asObject(raw)
  return asArray<PlatformRow>(root.byPlatform ?? root.platformBreakdown ?? root.platforms)
}

/** Map Zernio inbox payloads into the Analytics inbox tab shape. */
export function mapZernioInboxToUi(
  raw: {
    volume?: unknown
    comments?: unknown
    conversations?: unknown
  },
  opts: { fromDate: string; toDate: string; dateRange?: string },
): AnalyticsInboxData {
  const volume = unwrap(raw.volume)
  const summary = extractVolumeSummary(volume)
  const comments = extractComments(raw.comments).filter(c =>
    inDateRange(c.createdTime, opts.fromDate, opts.toDate),
  )
  const conversations = extractConversations(raw.conversations)

  const commentsByPlatform = new Map<string, number>()
  let totalComments = 0
  for (const row of comments) {
    const platform = (row.platform ?? 'unknown').toLowerCase()
    const count = num(row.commentCount) || 1
    totalComments += count
    commentsByPlatform.set(platform, (commentsByPlatform.get(platform) ?? 0) + count)
  }

  const unreadByPlatform = new Map<string, number>()
  for (const row of conversations) {
    const platform = (row.platform ?? 'unknown').toLowerCase()
    const unread = Math.max(0, num(row.received) - num(row.read))
    if (unread > 0) {
      unreadByPlatform.set(platform, (unreadByPlatform.get(platform) ?? 0) + unread)
    }
  }

  const totalDMs = summary.received
  const responseRate = summary.received > 0
    ? Math.round((summary.sent / summary.received) * 100)
    : 0

  const dmsByPlatform = new Map<string, number>()
  const byPlatformRows = extractByPlatform(volume)
  if (byPlatformRows.length > 0) {
    for (const row of byPlatformRows) {
      const platform = (row.platform ?? 'unknown').toLowerCase()
      dmsByPlatform.set(platform, (dmsByPlatform.get(platform) ?? 0) + num(row.received))
    }
  } else {
    for (const row of conversations) {
      const platform = (row.platform ?? 'unknown').toLowerCase()
      dmsByPlatform.set(platform, (dmsByPlatform.get(platform) ?? 0) + num(row.received))
    }
  }

  const platformKeys = new Set<string>([
    ...commentsByPlatform.keys(),
    ...dmsByPlatform.keys(),
    ...unreadByPlatform.keys(),
  ])

  const platforms = Array.from(platformKeys)
    .filter(p => p !== 'unknown')
    .sort()
    .map(platform => ({
      platform,
      comments: commentsByPlatform.get(platform) ?? 0,
      dms: dmsByPlatform.get(platform) ?? 0,
      unread: unreadByPlatform.get(platform) ?? 0,
    }))

  const commentsByDay = new Map<string, number>()
  for (const row of comments) {
    const day = (row.createdTime ?? '').slice(0, 10)
    if (!day) continue
    const count = num(row.commentCount) || 1
    commentsByDay.set(day, (commentsByDay.get(day) ?? 0) + count)
  }

  const dateRange = opts.dateRange ?? '30d'
  const trend = extractTimeseries(volume).map(row => {
    const day = row.date ?? ''
    return {
      date: fmtTrendLabel(day, dateRange),
      comments: commentsByDay.get(day) ?? 0,
      dms: num(row.received),
    }
  })

  return {
    totalComments,
    totalDMs,
    responseRate,
    platforms,
    trend,
  }
}

/** Merge inbox UI payloads from multiple Zernio profiles. */
export function mergeInboxData(items: AnalyticsInboxData[]): AnalyticsInboxData {
  if (items.length === 0) return emptyAnalyticsInbox()
  if (items.length === 1) return items[0]

  const platformMap = new Map<string, { comments: number; dms: number; unread: number }>()
  const trendMap = new Map<string, { comments: number; dms: number }>()

  let totalComments = 0
  let totalDMs = 0
  let totalSent = 0

  for (const item of items) {
    totalComments += item.totalComments
    totalDMs += item.totalDMs
    totalSent += item.totalDMs > 0
      ? Math.round((item.responseRate / 100) * item.totalDMs)
      : 0

    for (const p of item.platforms) {
      const cur = platformMap.get(p.platform) ?? { comments: 0, dms: 0, unread: 0 }
      platformMap.set(p.platform, {
        comments: cur.comments + p.comments,
        dms: cur.dms + p.dms,
        unread: cur.unread + p.unread,
      })
    }

    for (const t of item.trend) {
      const cur = trendMap.get(t.date) ?? { comments: 0, dms: 0 }
      trendMap.set(t.date, {
        comments: cur.comments + t.comments,
        dms: cur.dms + t.dms,
      })
    }
  }

  const responseRate = totalDMs > 0 ? Math.round((totalSent / totalDMs) * 100) : 0

  return {
    totalComments,
    totalDMs,
    responseRate,
    platforms: Array.from(platformMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([platform, stats]) => ({ platform, ...stats })),
    trend: Array.from(trendMap.entries()).map(([date, stats]) => ({ date, ...stats })),
  }
}
