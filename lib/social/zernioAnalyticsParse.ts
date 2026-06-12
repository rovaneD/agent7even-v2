/**
 * Normalise Zernio GET /analytics response shapes into { overview, posts[], accounts[] }.
 * Zernio may return posts as a top-level array OR nested under a posts object — both are handled.
 */

export type ParsedAnalyticsEnvelope = {
  overview: Record<string, unknown>
  posts: unknown[]
  accounts: unknown[]
}

export function parseAnalyticsEnvelope(raw: unknown): ParsedAnalyticsEnvelope {
  if (!raw || typeof raw !== 'object') {
    return { overview: {}, posts: [], accounts: [] }
  }

  const envelope = raw as Record<string, unknown>

  // { overview, posts: Post[], accounts: Account[] }
  if (Array.isArray(envelope.posts)) {
    return {
      overview: pickOverview(envelope),
      posts: envelope.posts,
      accounts: asArray(envelope.accounts),
    }
  }

  // { posts: { overview, posts: Post[], accounts: Account[] }, accounts?: Account[] }
  if (envelope.posts && typeof envelope.posts === 'object' && !Array.isArray(envelope.posts)) {
    const inner = envelope.posts as Record<string, unknown>
    if (Array.isArray(inner.posts) || inner.overview || inner.summary) {
      return {
        overview: pickOverview(inner),
        posts: Array.isArray(inner.posts) ? inner.posts : asArray(inner.items),
        accounts: [...asArray(inner.accounts), ...asArray(envelope.accounts)],
      }
    }
  }

  // { data: { ... } } / { result: { ... } }
  for (const key of ['data', 'result', 'response'] as const) {
    const nested = envelope[key]
    if (nested && typeof nested === 'object' && nested !== envelope) {
      return parseAnalyticsEnvelope(nested)
    }
  }

  if (Array.isArray(envelope.items)) {
    return {
      overview: pickOverview(envelope),
      posts: envelope.items,
      accounts: asArray(envelope.accounts),
    }
  }

  return {
    overview: pickOverview(envelope),
    posts: [],
    accounts: asArray(envelope.accounts),
  }
}

function pickOverview(obj: Record<string, unknown>): Record<string, unknown> {
  const o = obj.overview ?? obj.summary ?? obj.stats
  if (o && typeof o === 'object' && !Array.isArray(o)) return o as Record<string, unknown>
  return {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** Stable dedupe key for a post object */
export function postDedupeKey(post: Record<string, unknown>): string {
  const id = post._id ?? post.id
  if (id) return String(id)
  const date = post.publishedAt ?? post.published_at ?? post.date ?? ''
  const content = post.content ?? post.caption ?? post.text ?? ''
  return `${date}::${String(content).slice(0, 80)}`
}

const SHORTCODE_KEYS = [
  'shortCode',
  'shortcode',
  'mediaShortcode',
  'platformShortcode',
] as const

const PLATFORM_POST_ID_KEYS = [
  'platformPostId',
  'platform_post_id',
  'mediaId',
  'media_id',
] as const

function readStringField(obj: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

/** Reject profile/CDN assets and other non-post links. */
export function looksLikePostUrl(url: string, platform?: string): boolean {
  const u = url.trim().toLowerCase()
  if (!u.startsWith('http')) return false
  if (u.includes('cdninstagram.com') || u.includes('scontent-')) return false
  if (u.includes('fbcdn.net') && !u.includes('/posts/')) return false

  const pl = (platform ?? '').toLowerCase()

  if (pl === 'instagram' || u.includes('instagram.com')) {
    return /instagram\.com\/(p|reel|reels|tv)\//.test(u)
  }
  if (pl === 'facebook' || u.includes('facebook.com') || u.includes('fb.watch')) {
    return /facebook\.com\/.*\/(posts|photos|videos|reel)|facebook\.com\/share\/|photo\.php|story\.php|fb\.watch/.test(u)
  }
  if (pl === 'tiktok' || u.includes('tiktok.com')) {
    return /tiktok\.com\/@[^/]+\/video\//.test(u) || /\/video\//.test(u)
  }
  if (pl === 'linkedin' || u.includes('linkedin.com')) {
    return u.includes('/feed/update/') || u.includes('/posts/') || u.includes('urn:li:')
  }

  return /\/(p|reel|reels|tv|posts|video|share)\//.test(u)
}

function isLikelyInstagramShortcode(code: string): boolean {
  const c = code.trim()
  if (c.length < 8 || c.length > 15) return false
  if (/^[a-f0-9]{24}$/i.test(c)) return false
  if (/^\d+$/.test(c)) return false
  return /^[A-Za-z0-9_-]+$/.test(c)
}

function shortcodeFromPostUrl(url: string): string {
  const match = url.match(/instagram\.com\/(?:p|reel|reels|tv)\/([^/?#]+)/i)
  return match?.[1] ?? ''
}

/** Normalize Instagram permalinks to a stable public URL (matches Zernio dashboard /reels/ paths). */
export function canonicalizeInstagramPostUrl(url: string, mediaType?: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  const shortcode = shortcodeFromPostUrl(trimmed)
  if (!shortcode) return trimmed

  const type = (mediaType ?? '').toLowerCase()
  const isReelPath = /instagram\.com\/(?:reel|reels|tv)\//i.test(trimmed)
  const isReel = type.includes('reel') || type.includes('video') || isReelPath
  const path = isReel ? 'reels' : 'p'
  return `https://www.instagram.com/${path}/${shortcode}/`
}

function canonicalizePostUrl(url: string, platform: string, mediaType?: string): string {
  if (!url) return ''
  const pl = platform.toLowerCase()
  if (pl === 'instagram' || url.includes('instagram.com')) {
    return canonicalizeInstagramPostUrl(url, mediaType)
  }
  return url.trim()
}

function buildPostUrlFromShortcode(source: Record<string, unknown>, platform: string): string {
  const pl = platform.toLowerCase()
  const shortcode = readStringField(source, SHORTCODE_KEYS)
  if (!shortcode || !isLikelyInstagramShortcode(shortcode)) return ''

  if (pl === 'instagram') {
    const mediaType = String(source.mediaType ?? source.type ?? source.postType ?? '').toLowerCase()
    return canonicalizeInstagramPostUrl(`https://www.instagram.com/p/${shortcode}/`, mediaType)
  }
  return ''
}

function buildPostUrlFromPlatformPostId(platformPostId: string, platform: string, mediaType?: string): string {
  if (!isLikelyInstagramShortcode(platformPostId)) return ''
  if (platform.toLowerCase() !== 'instagram') return ''
  return canonicalizeInstagramPostUrl(`https://www.instagram.com/p/${platformPostId}/`, mediaType)
}

function collectPlatformEntries(obj: Record<string, unknown>, analytics: Record<string, unknown>): Record<string, unknown>[] {
  return [
    ...asArray(obj.platforms),
    ...asArray(obj.platformAnalytics),
    ...asArray(obj.platform_analytics),
    ...asArray(analytics.platforms),
    ...asArray(analytics.platformAnalytics),
    ...asArray(analytics.platform_analytics),
  ] as Record<string, unknown>[]
}

function readPlatformPostId(source: Record<string, unknown>): string {
  return readStringField(source, PLATFORM_POST_ID_KEYS)
}

function platformEntryMatchesPost(entry: Record<string, unknown>, postPlatformPostId: string): boolean {
  if (!postPlatformPostId) return true
  const entryId = readPlatformPostId(entry)
  return entryId === postPlatformPostId
}

function sortPlatformEntriesForPost(
  entries: Record<string, unknown>[],
  postPlatformPostId: string,
): Record<string, unknown>[] {
  if (!postPlatformPostId) return entries
  return [...entries].sort((a, b) => {
    const aMatch = platformEntryMatchesPost(a, postPlatformPostId) ? 0 : 1
    const bMatch = platformEntryMatchesPost(b, postPlatformPostId) ? 0 : 1
    return aMatch - bMatch
  })
}

/** Resolve the public post URL for a Zernio analytics post row. */
export function readBestPostUrl(entry: unknown, activePlatform?: string): string {
  if (!entry || typeof entry !== 'object') return ''
  const obj = entry as Record<string, unknown>
  const analytics = (obj.analytics && typeof obj.analytics === 'object' && !Array.isArray(obj.analytics))
    ? obj.analytics as Record<string, unknown>
    : {}

  const postPlatform = String(obj.platform ?? analytics.platform ?? '').toLowerCase()
  const mediaType = String(obj.mediaType ?? obj.type ?? obj.postType ?? '').toLowerCase()
  const platformFilter = activePlatform && activePlatform !== 'all'
    ? activePlatform.toLowerCase()
    : ''

  const readPlatformPostUrl = (source: Record<string, unknown>, pl: string): string => {
    const url = readStringField(source, ['platformPostUrl', 'platform_post_url'])
    if (!url || !looksLikePostUrl(url, pl || postPlatform)) return ''
    return canonicalizePostUrl(url, pl || postPlatform, mediaType)
  }

  const platformEntries = collectPlatformEntries(obj, analytics)
  const postPlatformPostId = readPlatformPostId(obj)
    || readPlatformPostId(analytics)
    || platformEntries.map(readPlatformPostId).find(Boolean)
    || ''

  const scopedEntries = platformFilter
    ? platformEntries.filter((p) => String(p.platform ?? '').toLowerCase() === platformFilter)
    : platformEntries

  const candidateEntries = sortPlatformEntriesForPost(
    scopedEntries.length ? scopedEntries : platformEntries,
    postPlatformPostId,
  )

  // Prefer platform-scoped platformPostUrl — top-level can be stale vs platforms[].
  for (const entryRow of candidateEntries) {
    const pl = String(entryRow.platform ?? platformFilter ?? postPlatform ?? '')
    const url = readPlatformPostUrl(entryRow, pl)
    if (url) return url
  }

  const topUrl = readPlatformPostUrl(obj, platformFilter || postPlatform)
    || readPlatformPostUrl(analytics, platformFilter || postPlatform)
  if (topUrl) {
    const platformShortcode = candidateEntries
      .map((row) => shortcodeFromPostUrl(readPlatformPostUrl(row, String(row.platform ?? postPlatform))))
      .find(Boolean)
    const topShortcode = shortcodeFromPostUrl(topUrl)
    if (!platformShortcode || !topShortcode || platformShortcode === topShortcode) {
      return topUrl
    }
  }

  for (const entryRow of candidateEntries) {
    const pl = String(entryRow.platform ?? platformFilter ?? postPlatform ?? '')
    const built = buildPostUrlFromShortcode(entryRow, pl)
      || buildPostUrlFromPlatformPostId(readPlatformPostId(entryRow), pl, mediaType)
    if (built) return built
  }

  if (postPlatformPostId) {
    const built = buildPostUrlFromPlatformPostId(
      postPlatformPostId,
      platformFilter || postPlatform,
      mediaType,
    )
    if (built) return built
  }

  return topUrl
}

/** Filter posts when UI platform filter is active */
export function filterPostsByPlatform(posts: unknown[], platform?: string): unknown[] {
  if (!platform) return posts
  const pl = platform.toLowerCase()
  return posts.filter((raw) => {
    const post = raw as Record<string, unknown>
    const direct = String(post.platform ?? '').toLowerCase()
    if (direct === pl) return true
    const platforms = [
      ...asArray(post.platforms),
      ...asArray(post.platformAnalytics),
      ...asArray(post.platform_analytics),
    ] as Record<string, unknown>[]
    return platforms.some((p) => String(p.platform ?? '').toLowerCase() === pl)
  })
}
