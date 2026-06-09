// All Zernio API calls go through this module.
// Never scatter Zernio calls across routes — import from here.
// Fail soft: every exported function returns null/false/[] on error, never throws.

const ZERNIO_BASE = 'https://zernio.com/api/v1'

function apiKey(): string {
  const key = process.env.ZERNIO_API_KEY
  if (!key) throw new Error('[publisher] ZERNIO_API_KEY is not set')
  return key
}

function buildHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey()}`,
    'Content-Type': 'application/json',
  }
}

// Per-process rate guard — Zernio rate limits are per API key, shared across all tenants.
// Window resets on cold start; prevents burst spikes within a single hot instance.
const _rate = { count: 0, since: Date.now() }
const MAX_PER_MINUTE = 120

function guardRate() {
  const now = Date.now()
  if (now - _rate.since > 60_000) {
    _rate.count = 0
    _rate.since = now
  }
  if (++_rate.count > MAX_PER_MINUTE) {
    throw new Error('[publisher] rate limit guard — too many Zernio calls this minute')
  }
}

async function zCall<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  guardRate()
  const url = `${ZERNIO_BASE}${path}`
  console.log(`[publisher] ${init?.method ?? 'GET'} ${url}`)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000) // 12 s hard timeout

  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        ...buildHeaders(),
        ...((init?.headers as Record<string, string>) ?? {}),
      },
    })
  } catch (fetchErr) {
    clearTimeout(timer)
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
    console.error(`[publisher] fetch failed for ${url}: ${msg}`)
    throw new Error(`[publisher] fetch failed: ${msg}`)
  }
  clearTimeout(timer)

  // Always read body as text first so we can log it regardless of status
  const text = await res.text().catch(() => '')
  console.log(`[publisher] response ${res.status}: ${text.slice(0, 500)}`)
  if (!res.ok) {
    throw new Error(`[publisher] Zernio ${res.status}: ${text}`)
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`[publisher] Zernio response not JSON: ${text.slice(0, 200)}`)
  }
}

function getDateWindow(dateRange: string): { fromDate: string; toDate: string } {
  const days =
    dateRange === '7d'  ? 7 :
    dateRange === '30d' ? 30 :
    dateRange === '90d' ? 90 :
    dateRange === '6m'  ? 180 :
    dateRange === '1y'  ? 365 :
    30

  const end = new Date()
  const to = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - (days - 1))

  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  }
}

// ── Profile management ────────────────────────────────────────────────────────

/**
 * Create a Zernio profile for a new tenant.
 * Throws on failure — caller must catch and handle.
 */
export async function createProfile(name: string): Promise<string> {
  const raw = await zCall('/profiles', {
    method: 'POST',
    body: JSON.stringify({ name, description: `Agent7even — ${name}` }),
  }) as Record<string, unknown>

  // Log the full response once so we can confirm the exact shape
  console.log('[publisher] createProfile response:', JSON.stringify(raw))

  // Try every common ID field / nesting pattern Zernio might use
  const nested = (raw.data ?? raw.profile ?? raw.result ?? {}) as Record<string, unknown>
  const id =
    (raw._id ?? raw.id ?? raw.profileId ?? raw.profile_id) as string | undefined
    ?? (nested._id ?? nested.id ?? nested.profileId) as string | undefined

  if (!id) {
    throw new Error(`[publisher] Zernio createProfile returned no ID. Response: ${JSON.stringify(raw)}`)
  }
  return id
}

/**
 * List all Zernio profiles for this API key.
 * Used to recover a profile ID when creation returns "already exists".
 * Returns [] on failure.
 */
export async function listProfiles(): Promise<Array<{ id: string; name: string }>> {
  try {
    const data = await zCall('/profiles')
    const arr: Array<Record<string, string>> = Array.isArray(data)
      ? (data as Array<Record<string, string>>)
      : ((data as Record<string, unknown>).data as Array<Record<string, string>>)
          ?? ((data as Record<string, unknown>).profiles as Array<Record<string, string>>)
          ?? []
    return arr
      .map((p) => ({ id: (p._id ?? p.id ?? '').toString(), name: p.name ?? '' }))
      .filter((p) => p.id)
  } catch (err) {
    console.error('[publisher] listProfiles failed:', err)
    return []
  }
}

// ── Connect / disconnect ───────────────────────────────────────────────────────

/**
 * Get the OAuth redirect URL for connecting a platform.
 * Throws on failure — caller must catch and handle.
 */
export async function getConnectUrl(
  profileId: string,
  platform: string,
  redirectUri: string,
): Promise<string> {
  const q = new URLSearchParams({ profileId, redirect_url: redirectUri })
  const data = await zCall<{ authUrl?: string; auth_url?: string }>(
    `/connect/${encodeURIComponent(platform)}?${q}`,
  )
  const url = data.authUrl ?? data.auth_url
  if (!url) throw new Error('[publisher] Zernio getConnectUrl returned no authUrl')
  return url
}

/** Disconnect a single platform from a Zernio profile. Returns false on failure. */
export async function disconnectAccount(profileId: string, platform: string): Promise<boolean> {
  try {
    await zCall(
      `/profiles/${encodeURIComponent(profileId)}/connected-accounts/${encodeURIComponent(platform)}`,
      { method: 'DELETE' },
    )
    return true
  } catch (err) {
    console.error('[publisher] disconnectAccount failed:', err)
    return false
  }
}

/** Delete the entire Zernio profile, disconnecting all accounts. Called on subscription cancellation. */
export async function disconnectAllAccounts(profileId: string): Promise<boolean> {
  try {
    await zCall(`/profiles/${encodeURIComponent(profileId)}`, { method: 'DELETE' })
    return true
  } catch (err) {
    console.error('[publisher] disconnectAllAccounts failed:', err)
    return false
  }
}

/** List connected platform identifiers for a profile. Returns [] on failure. */
export async function getConnectedPlatforms(profileId: string): Promise<string[]> {
  try {
    const data = await zCall<{
      accounts?: Array<{ platform?: string }>
      results?: Array<{ platform?: string }>
    }>(`/accounts?profileId=${encodeURIComponent(profileId)}`)
    const accounts = Array.isArray(data.accounts) ? data.accounts : Array.isArray(data.results) ? data.results : []
    const platforms = accounts
      .map((a) => a.platform?.trim())
      .filter((p): p is string => Boolean(p))
    if (platforms.length > 0) return Array.from(new Set(platforms))
    return []
  } catch (err) {
    console.error('[publisher] getConnectedPlatforms failed:', err)
    return []
  }
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface SocialAnalyticsParams {
  profileId: string
  platform?: string   // omit for all platforms
  fromDate: string
  toDate: string
}

/** Fetch organic social analytics from Zernio. Returns null on failure. */
export async function getSocialAnalytics(params: SocialAnalyticsParams): Promise<unknown> {
  try {
    const q = new URLSearchParams({
      profileId: params.profileId,
      fromDate: params.fromDate,
      toDate: params.toDate,
    })
    if (params.platform) q.set('platform', params.platform)
    return await zCall(`/analytics?${q}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[publisher] getSocialAnalytics failed:', msg)
    return { _zernioError: msg }
  }
}

// ── Analytics helpers (documented endpoints) ──────────────────────────────────

/** Returns full account objects including _id (accountId needed for analytics calls). */
export async function getProfileAccounts(
  profileId: string,
): Promise<Array<{ id: string; platform: string; username: string }>> {
  try {
    const data = await zCall<{
      accounts?: Array<{ _id?: string; id?: string; platform?: string; platformUsername?: string; username?: string; health?: unknown }>
      results?: Array<{ _id?: string; id?: string; platform?: string; platformUsername?: string; username?: string; health?: unknown }>
    }>(`/accounts?profileId=${encodeURIComponent(profileId)}`)
    const arr = Array.isArray(data.accounts)
      ? data.accounts
      : Array.isArray(data.results)
        ? data.results
        : []
    return arr
      .map(a => ({
        id: String(a._id ?? a.id ?? ''),
        platform: String(a.platform ?? ''),
        username: String(a.platformUsername ?? a.username ?? ''),
      }))
      .filter(a => a.id)
  } catch (err) {
    console.error('[publisher] getProfileAccounts failed:', err)
    return []
  }
}

/** Daily time series — for Posts over time / Likes over time charts. */
export async function getDailyAnalytics(params: { profileId: string; platform?: string; fromDate: string; toDate: string }): Promise<unknown> {
  try {
    const q = new URLSearchParams({
      profileId: params.profileId,
      fromDate: params.fromDate,
      toDate: params.toDate,
    })
    if (params.platform) q.set('platform', params.platform)
    return await zCall(`/analytics/daily-metrics?${q}`)
  } catch (err) {
    console.error('[publisher] getDailyAnalytics failed:', err)
    return null
  }
}

/** Best time to post — for the heatmap. */
export async function getBestTimeToPost(params: { profileId?: string; accountId?: string; platform?: string; source?: 'all' | 'late' | 'external' }): Promise<unknown> {
  try {
    const q = new URLSearchParams()
    if (params.profileId) q.set('profileId', params.profileId)
    if (params.accountId) q.set('accountId', params.accountId)
    if (params.platform) q.set('platform', params.platform)
    if (params.source) q.set('source', params.source)
    return await zCall(`/analytics/best-time?${q}`)
  } catch (err) {
    console.error('[publisher] getBestTimeToPost failed:', err)
    return null
  }
}

/** Account follower stats for connected accounts. */
export async function getFollowerStats(params: {
  profileId: string
  accountIds?: string[]
  fromDate: string
  toDate: string
  granularity?: 'daily' | 'weekly' | 'monthly'
}): Promise<unknown> {
  try {
    const q = new URLSearchParams({
      profileId: params.profileId,
      fromDate: params.fromDate,
      toDate: params.toDate,
    })
    if (params.accountIds?.length) q.set('accountIds', params.accountIds.join(','))
    if (params.granularity) q.set('granularity', params.granularity)
    return await zCall(`/accounts/follower-stats?${q}`)
  } catch (err) {
    console.error('[publisher] getFollowerStats failed:', err)
    return null
  }
}

export interface AdsAnalyticsParams {
  profileId: string
  platform?: string
  fromDate: string
  toDate: string
}

/** Fetch paid ads analytics from Zernio. Returns null on failure. */
export async function getAdsAnalytics(params: AdsAnalyticsParams): Promise<unknown> {
  try {
    const q = new URLSearchParams({
      profileId: params.profileId,
      fromDate: params.fromDate,
      toDate: params.toDate,
    })
    if (params.platform) q.set('platform', params.platform)
    return await zCall(`/ads?${q}`)
  } catch (err) {
    console.error('[publisher] getAdsAnalytics failed:', err)
    return null
  }
}

export interface InboxSummaryParams {
  profileId: string
  fromDate: string
  toDate: string
}

/** Fetch inbox summary (comments, DMs, response rate) from Zernio. Returns null on failure. */
export async function getInboxSummary(params: InboxSummaryParams): Promise<unknown> {
  try {
    const q = new URLSearchParams({
      profileId: params.profileId,
      fromDate: params.fromDate,
      toDate: params.toDate,
    })
    return await zCall(`/analytics/inbox/volume?${q}`)
  } catch (err) {
    console.error('[publisher] getInboxSummary failed:', err)
    return null
  }
}

export function dateRangeToWindow(dateRange: string): { fromDate: string; toDate: string } {
  return getDateWindow(dateRange)
}
