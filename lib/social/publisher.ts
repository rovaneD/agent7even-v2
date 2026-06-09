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
  const q = new URLSearchParams({ profileId, redirectUrl: redirectUri })
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
      accounts?: { platform: string }[]
      platforms?: string[]
    }>(`/profiles/${encodeURIComponent(profileId)}/connected-accounts`)
    if (Array.isArray(data.platforms)) return data.platforms
    if (Array.isArray(data.accounts)) return data.accounts.map((a) => a.platform)
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
  dateRange: string   // '7d' | '30d' | '90d'
}

/** Fetch organic social analytics from Zernio. Returns null on failure. */
export async function getSocialAnalytics(params: SocialAnalyticsParams): Promise<unknown> {
  try {
    const q = new URLSearchParams({ profileId: params.profileId, dateRange: params.dateRange })
    if (params.platform) q.set('platform', params.platform)
    return await zCall(`/analytics?${q}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[publisher] getSocialAnalytics failed:', msg)
    return { _zernioError: msg }
  }
}

/**
 * Documented endpoint for follower counts.
 * GET /accounts/follower-stats returns current follower counts for all connected accounts.
 * Per docs: "For follower stats, use /v1/accounts/follower-stats"
 */
export async function getFollowerStats(): Promise<unknown> {
  try {
    return await zCall('/accounts/follower-stats')
  } catch (err) {
    console.error('[publisher] getFollowerStats failed:', err)
    return null
  }
}

/**
 * List all connected accounts across all profiles (API-key scoped, not profile-scoped).
 * Used to find accountIds and get follower counts regardless of which profile they're in.
 */
export async function listAllAccounts(platform?: string): Promise<unknown> {
  try {
    const q = new URLSearchParams()
    if (platform) q.set('platform', platform)
    return await zCall(`/accounts${q.toString() ? `?${q}` : ''}`)
  } catch (err) {
    console.error('[publisher] listAllAccounts failed:', err)
    return null
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
    }>(`/profiles/${encodeURIComponent(profileId)}/connected-accounts`)
    const arr = Array.isArray(data.accounts) ? data.accounts : []
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
export async function getDailyAnalytics(params: { accountId: string; days: number }): Promise<unknown> {
  try {
    const q = new URLSearchParams({ accountId: params.accountId, days: String(params.days) })
    return await zCall(`/analytics/daily?${q}`)
  } catch (err) {
    console.error('[publisher] getDailyAnalytics failed:', err)
    return null
  }
}

/** Best time to post — for the heatmap. */
export async function getBestTimeToPost(params: { accountId: string; platform?: string }): Promise<unknown> {
  try {
    const q = new URLSearchParams({ accountId: params.accountId })
    if (params.platform) q.set('platform', params.platform)
    return await zCall(`/analytics/best-time?${q}`)
  } catch (err) {
    console.error('[publisher] getBestTimeToPost failed:', err)
    return null
  }
}

/** Account-level metrics including followers. */
export async function getAccountMetrics(accountId: string): Promise<unknown> {
  try {
    return await zCall(`/accounts/${encodeURIComponent(accountId)}`)
  } catch (err) {
    console.error('[publisher] getAccountMetrics failed:', err)
    return null
  }
}

export interface AdsAnalyticsParams {
  profileId: string
  platform?: string
  dateRange: string
}

/** Fetch paid ads analytics from Zernio. Returns null on failure. */
export async function getAdsAnalytics(params: AdsAnalyticsParams): Promise<unknown> {
  try {
    const q = new URLSearchParams({ profileId: params.profileId, dateRange: params.dateRange })
    if (params.platform) q.set('platform', params.platform)
    return await zCall(`/ads?${q}`)
  } catch (err) {
    console.error('[publisher] getAdsAnalytics failed:', err)
    return null
  }
}

export interface InboxSummaryParams {
  profileId: string
  dateRange: string
}

/** Fetch inbox summary (comments, DMs, response rate) from Zernio. Returns null on failure. */
export async function getInboxSummary(params: InboxSummaryParams): Promise<unknown> {
  try {
    const q = new URLSearchParams({ profileId: params.profileId, dateRange: params.dateRange })
    return await zCall(`/inbox/summary?${q}`)
  } catch (err) {
    console.error('[publisher] getInboxSummary failed:', err)
    return null
  }
}
