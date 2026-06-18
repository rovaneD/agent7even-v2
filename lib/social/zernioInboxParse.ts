/** UI shape consumed by InboxAnalyticsContent. */
export type AnalyticsInboxData = {
  totalComments: number
  totalDMs: number
  responseRate: number
  received: number
  sent: number
  read: number
  failed: number
  conversations: number
  medianResponseLabel: string | null
  platforms: Array<{
    platform: string
    comments: number
    dms: number
    unread: number
    sent?: number
    received?: number
  }>
  trend: Array<{ date: string; comments: number; dms: number }>
  messagesOverTime: Array<{ date: string; received: number; sent: number; read: number }>
  responseTimeBuckets: Array<{ label: string; count: number }>
  topAccounts: Array<{
    platform: string
    username: string
    received: number
    sent: number
    conversations: number
    medianResponseLabel: string | null
  }>
  outboundBySource: Array<{ source: string; count: number }>
  activityHeatmap: Array<{ day: string; hour: number; count: number }>
}

export function emptyAnalyticsInbox(): AnalyticsInboxData {
  return {
    totalComments: 0,
    totalDMs: 0,
    responseRate: 0,
    received: 0,
    sent: 0,
    read: 0,
    failed: 0,
    conversations: 0,
    medianResponseLabel: null,
    platforms: [],
    trend: [],
    messagesOverTime: [],
    responseTimeBuckets: [],
    topAccounts: [],
    outboundBySource: [],
    activityHeatmap: [],
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

export function fmtInboxDuration(seconds: number): string | null {
  if (!seconds || seconds <= 0 || !Number.isFinite(seconds)) return null
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600)
    const m = Math.round((seconds % 3600) / 60)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  const d = Math.floor(seconds / 86400)
  const h = Math.round((seconds % 86400) / 3600)
  return h > 0 ? `${d}d ${h}h` : `${d}d`
}

function readDurationLabel(row: Record<string, unknown>): string | null {
  for (const key of ['medianResponseLabel', 'medianResponse', 'medianFirstResponse', 'responseTimeLabel']) {
    const v = row[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  for (const key of ['medianResponseSeconds', 'medianFirstResponseSeconds', 'medianResponseMs', 'medianMs']) {
    const raw = row[key]
    const seconds = key.includes('Ms') ? num(raw) / 1000 : num(raw)
    const label = fmtInboxDuration(seconds)
    if (label) return label
  }
  return null
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
  sent?: number
  username?: string
  displayName?: string
  conversations?: number
  medianResponseSeconds?: number
  medianFirstResponseSeconds?: number
}

type TimeseriesRow = {
  date?: string
  received?: number
  sent?: number
  read?: number
}

type PlatformRow = {
  platform?: string
  received?: number
  sent?: number
  read?: number
}

type BucketRow = {
  label?: string
  bucket?: string
  range?: string
  count?: number
  replies?: number
}

type AccountRow = {
  platform?: string
  username?: string
  displayName?: string
  received?: number
  sent?: number
  conversations?: number
  medianResponseSeconds?: number
  medianFirstResponseSeconds?: number
}

type SourceRow = {
  source?: string
  label?: string
  count?: number
  sent?: number
}

type HeatmapRow = {
  day?: string
  weekday?: string
  hour?: number
  count?: number
  received?: number
}

function extractComments(raw: unknown): CommentRow[] {
  const root = asObject(raw)
  return asArray<CommentRow>(root.data ?? root.comments ?? root.items)
}

function extractConversations(raw: unknown): ConversationRow[] {
  const root = asObject(raw)
  return asArray<ConversationRow>(root.items ?? root.conversations ?? root.data)
}

function extractVolumeSummary(raw: unknown): {
  received: number
  sent: number
  read: number
  failed: number
  conversations: number
  medianResponseLabel: string | null
} {
  const root = asObject(raw)
  const summary = asObject(root.summary ?? root.totals ?? root.metrics)
  return {
    received: num(summary.received ?? root.received),
    sent: num(summary.sent ?? root.sent),
    read: num(summary.read ?? root.read),
    failed: num(summary.failed ?? root.failed),
    conversations: num(summary.conversations ?? summary.conversationCount ?? root.conversations),
    medianResponseLabel: readDurationLabel(summary) ?? readDurationLabel(root),
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

function extractResponseTimeBuckets(raw: unknown): AnalyticsInboxData['responseTimeBuckets'] {
  const root = unwrap(raw)
  const rows = asArray<BucketRow>(
    root.responseTimeBuckets ?? root.responseTimes ?? root.firstResponseTime ?? root.responseTimeDistribution,
  )
  return rows
    .map(row => ({
      label: (row.label ?? row.bucket ?? row.range ?? '').trim() || 'Unknown',
      count: num(row.count ?? row.replies),
    }))
    .filter(row => row.count > 0 || rows.length <= 8)
}

function extractTopAccounts(raw: unknown): AnalyticsInboxData['topAccounts'] {
  const root = unwrap(raw)
  const rows = asArray<AccountRow>(
    root.topAccounts ?? root.accounts ?? root.byAccount ?? root.accountBreakdown,
  )
  return rows
    .map(row => {
      const username = (row.username ?? row.displayName ?? '').trim()
      if (!username) return null
      const medianResponseLabel =
        readDurationLabel(row as Record<string, unknown>) ??
        fmtInboxDuration(num(row.medianResponseSeconds ?? row.medianFirstResponseSeconds))
      return {
        platform: (row.platform ?? 'unknown').toLowerCase(),
        username,
        received: num(row.received),
        sent: num(row.sent),
        conversations: num(row.conversations),
        medianResponseLabel,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .slice(0, 10)
}

function extractOutboundBySource(raw: unknown): AnalyticsInboxData['outboundBySource'] {
  const root = unwrap(raw)
  const rows = asArray<SourceRow>(
    root.outboundBySource ?? root.sentBySource ?? root.bySource ?? root.sourceBreakdown,
  )
  return rows
    .map(row => ({
      source: (row.source ?? row.label ?? 'unknown').trim() || 'unknown',
      count: num(row.count ?? row.sent),
    }))
    .filter(row => row.count > 0)
}

function extractActivityHeatmap(raw: unknown): AnalyticsInboxData['activityHeatmap'] {
  const root = unwrap(raw)
  const rows = asArray<HeatmapRow>(
    root.activityHeatmap ?? root.whenMessagesLand ?? root.hourlyActivity ?? root.heatmap,
  )
  return rows
    .map(row => ({
      day: (row.day ?? row.weekday ?? '').trim(),
      hour: num(row.hour),
      count: num(row.count ?? row.received),
    }))
    .filter(row => row.day && row.count > 0)
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
  const sentByPlatform = new Map<string, number>()
  const byPlatformRows = extractByPlatform(volume)
  if (byPlatformRows.length > 0) {
    for (const row of byPlatformRows) {
      const platform = (row.platform ?? 'unknown').toLowerCase()
      dmsByPlatform.set(platform, (dmsByPlatform.get(platform) ?? 0) + num(row.received))
      sentByPlatform.set(platform, (sentByPlatform.get(platform) ?? 0) + num(row.sent))
    }
  } else {
    for (const row of conversations) {
      const platform = (row.platform ?? 'unknown').toLowerCase()
      dmsByPlatform.set(platform, (dmsByPlatform.get(platform) ?? 0) + num(row.received))
      sentByPlatform.set(platform, (sentByPlatform.get(platform) ?? 0) + num(row.sent))
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
      sent: sentByPlatform.get(platform) ?? 0,
      received: dmsByPlatform.get(platform) ?? 0,
    }))

  const commentsByDay = new Map<string, number>()
  for (const row of comments) {
    const day = (row.createdTime ?? '').slice(0, 10)
    if (!day) continue
    const count = num(row.commentCount) || 1
    commentsByDay.set(day, (commentsByDay.get(day) ?? 0) + count)
  }

  const dateRange = opts.dateRange ?? '30d'
  const timeseries = extractTimeseries(volume)
  const trend = timeseries.map(row => {
    const day = row.date ?? ''
    return {
      date: fmtTrendLabel(day, dateRange),
      comments: commentsByDay.get(day) ?? 0,
      dms: num(row.received),
    }
  })

  const messagesOverTime = timeseries.map(row => {
    const day = row.date ?? ''
    return {
      date: fmtTrendLabel(day, dateRange),
      received: num(row.received),
      sent: num(row.sent),
      read: num(row.read),
    }
  })

  const conversationCount = summary.conversations || conversations.length
  let medianResponseLabel = summary.medianResponseLabel
  if (!medianResponseLabel && conversations.length > 0) {
    const seconds = conversations
      .map(row => num(row.medianResponseSeconds ?? row.medianFirstResponseSeconds))
      .filter(v => v > 0)
    if (seconds.length > 0) {
      seconds.sort((a, b) => a - b)
      medianResponseLabel = fmtInboxDuration(seconds[Math.floor(seconds.length / 2)])
    }
  }

  const conversationBuckets = extractResponseTimeBuckets(raw.conversations)
  const responseTimeBuckets = conversationBuckets.length > 0
    ? conversationBuckets
    : extractResponseTimeBuckets(raw.volume)
  const topAccounts =
    extractTopAccounts(raw.conversations).length > 0
      ? extractTopAccounts(raw.conversations)
      : extractTopAccounts(raw.volume)
  const outboundBySource =
    extractOutboundBySource(raw.volume).length > 0
      ? extractOutboundBySource(raw.volume)
      : extractOutboundBySource(raw.conversations)
  const activityHeatmap =
    extractActivityHeatmap(raw.volume).length > 0
      ? extractActivityHeatmap(raw.volume)
      : extractActivityHeatmap(raw.conversations)

  return {
    totalComments,
    totalDMs,
    responseRate,
    received: summary.received,
    sent: summary.sent,
    read: summary.read,
    failed: summary.failed,
    conversations: conversationCount,
    medianResponseLabel,
    platforms,
    trend,
    messagesOverTime,
    responseTimeBuckets,
    topAccounts,
    outboundBySource,
    activityHeatmap,
  }
}

/** Merge inbox UI payloads from multiple Zernio profiles. */
export function mergeInboxData(items: AnalyticsInboxData[]): AnalyticsInboxData {
  if (items.length === 0) return emptyAnalyticsInbox()
  if (items.length === 1) return items[0]

  const platformMap = new Map<string, { comments: number; dms: number; unread: number; sent: number; received: number }>()
  const trendMap = new Map<string, { comments: number; dms: number }>()
  const messagesMap = new Map<string, { received: number; sent: number; read: number }>()
  const bucketMap = new Map<string, number>()
  const sourceMap = new Map<string, number>()
  const accountMap = new Map<string, AnalyticsInboxData['topAccounts'][number]>()
  const heatmapMap = new Map<string, number>()

  let totalComments = 0
  let totalDMs = 0
  let totalSent = 0
  let received = 0
  let sent = 0
  let read = 0
  let failed = 0
  let conversations = 0

  for (const item of items) {
    totalComments += item.totalComments
    totalDMs += item.totalDMs
    totalSent += item.totalDMs > 0
      ? Math.round((item.responseRate / 100) * item.totalDMs)
      : 0
    received += item.received
    sent += item.sent
    read += item.read
    failed += item.failed
    conversations += item.conversations

    for (const p of item.platforms) {
      const cur = platformMap.get(p.platform) ?? { comments: 0, dms: 0, unread: 0, sent: 0, received: 0 }
      platformMap.set(p.platform, {
        comments: cur.comments + p.comments,
        dms: cur.dms + p.dms,
        unread: cur.unread + p.unread,
        sent: cur.sent + (p.sent ?? 0),
        received: cur.received + (p.received ?? p.dms),
      })
    }

    for (const t of item.trend) {
      const cur = trendMap.get(t.date) ?? { comments: 0, dms: 0 }
      trendMap.set(t.date, {
        comments: cur.comments + t.comments,
        dms: cur.dms + t.dms,
      })
    }

    for (const row of item.messagesOverTime) {
      const cur = messagesMap.get(row.date) ?? { received: 0, sent: 0, read: 0 }
      messagesMap.set(row.date, {
        received: cur.received + row.received,
        sent: cur.sent + row.sent,
        read: cur.read + row.read,
      })
    }

    for (const bucket of item.responseTimeBuckets) {
      bucketMap.set(bucket.label, (bucketMap.get(bucket.label) ?? 0) + bucket.count)
    }

    for (const source of item.outboundBySource) {
      sourceMap.set(source.source, (sourceMap.get(source.source) ?? 0) + source.count)
    }

    for (const account of item.topAccounts) {
      const key = `${account.platform}:${account.username}`
      const cur = accountMap.get(key)
      accountMap.set(key, cur
        ? {
            ...cur,
            received: cur.received + account.received,
            sent: cur.sent + account.sent,
            conversations: cur.conversations + account.conversations,
          }
        : account)
    }

    for (const cell of item.activityHeatmap) {
      const key = `${cell.day}:${cell.hour}`
      heatmapMap.set(key, (heatmapMap.get(key) ?? 0) + cell.count)
    }
  }

  const responseRate = totalDMs > 0 ? Math.round((totalSent / totalDMs) * 100) : 0

  return {
    totalComments,
    totalDMs,
    responseRate,
    received,
    sent,
    read,
    failed,
    conversations,
    medianResponseLabel: items.find(i => i.medianResponseLabel)?.medianResponseLabel ?? null,
    platforms: Array.from(platformMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([platform, stats]) => ({ platform, ...stats })),
    trend: Array.from(trendMap.entries()).map(([date, stats]) => ({ date, ...stats })),
    messagesOverTime: Array.from(messagesMap.entries()).map(([date, stats]) => ({ date, ...stats })),
    responseTimeBuckets: Array.from(bucketMap.entries()).map(([label, count]) => ({ label, count })),
    topAccounts: Array.from(accountMap.values())
      .sort((a, b) => b.received - a.received)
      .slice(0, 10),
    outboundBySource: Array.from(sourceMap.entries()).map(([source, count]) => ({ source, count })),
    activityHeatmap: Array.from(heatmapMap.entries()).map(([key, count]) => {
      const [day, hour] = key.split(':')
      return { day, hour: num(hour), count }
    }),
  }
}
