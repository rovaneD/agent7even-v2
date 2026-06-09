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
