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

const EXPLICIT_POST_URL_KEYS = [
  'platformPostUrl',
  'platform_post_url',
  'permalink',
  'permalinkUrl',
  'permalink_url',
  'postUrl',
  'post_url',
] as const

const FALLBACK_POST_URL_KEYS = [
  'externalUrl',
  'external_url',
  'instagramUrl',
  'instagram_url',
  'linkUrl',
  'link_url',
  'url',
  'link',
] as const

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

function buildPostUrlFromShortcode(source: Record<string, unknown>, platform: string): string {
  const pl = platform.toLowerCase()
  const shortcode = readStringField(source, SHORTCODE_KEYS)
  if (!shortcode || !isLikelyInstagramShortcode(shortcode)) return ''

  if (pl === 'instagram') {
    const mediaType = String(source.mediaType ?? source.type ?? source.postType ?? '').toLowerCase()
    const path = mediaType.includes('reel') ? 'reel' : 'p'
    return `https://www.instagram.com/${path}/${shortcode}/`
  }
  return ''
}

function readUrlFromSource(source: Record<string, unknown>, platform?: string): string {
  const pl = platform ?? String(source.platform ?? '')

  const explicit = readStringField(source, EXPLICIT_POST_URL_KEYS)
  if (explicit && looksLikePostUrl(explicit, pl)) return explicit

  const built = buildPostUrlFromShortcode(source, pl)
  if (built) return built

  for (const key of FALLBACK_POST_URL_KEYS) {
    const value = source[key]
    if (typeof value === 'string' && value.trim() && looksLikePostUrl(value.trim(), pl)) {
      return value.trim()
    }
  }
  return ''
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
  const platformFilter = activePlatform && activePlatform !== 'all'
    ? activePlatform.toLowerCase()
    : ''

  const readPlatformPostUrl = (source: Record<string, unknown>, pl: string): string => {
    const url = readStringField(source, ['platformPostUrl', 'platform_post_url'])
    return url && looksLikePostUrl(url, pl || postPlatform) ? url : ''
  }

  // Zernio authoritative field — top-level on the post row.
  const topUrl = readPlatformPostUrl(obj, platformFilter || postPlatform)
    || readPlatformPostUrl(analytics, platformFilter || postPlatform)
  if (topUrl) return topUrl

  const platformEntries = [
    ...asArray(obj.platforms),
    ...asArray(obj.platformAnalytics),
    ...asArray(obj.platform_analytics),
    ...asArray(analytics.platforms),
    ...asArray(analytics.platformAnalytics),
    ...asArray(analytics.platform_analytics),
  ] as Record<string, unknown>[]

  const postPlatformPostId = readPlatformPostId(obj) || readPlatformPostId(analytics)
  const scopedEntries = platformFilter
    ? platformEntries.filter((p) => String(p.platform ?? '').toLowerCase() === platformFilter)
    : platformEntries

  const candidateEntries = sortPlatformEntriesForPost(
    scopedEntries.length ? scopedEntries : platformEntries,
    postPlatformPostId,
  )

  for (const entryRow of candidateEntries) {
    const pl = String(entryRow.platform ?? platformFilter ?? postPlatform ?? '')
    const url = readPlatformPostUrl(entryRow, pl)
    if (url) return url
  }

  // Legacy explicit permalink fields only — never build URLs from platformPostId
  // (Instagram platformPostId is numeric media ID, not a shortcode).
  const fallbacks = [analytics, obj]
    .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v))

  for (const source of fallbacks) {
    for (const key of ['permalink', 'permalinkUrl', 'permalink_url'] as const) {
      const value = source[key]
      if (typeof value === 'string' && value.trim() && looksLikePostUrl(value.trim(), platformFilter || postPlatform)) {
        return value.trim()
      }
    }
  }

  return ''
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
