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
  const res = await fetch(url, {
    ...init,
    headers: {
      ...buildHeaders(),
      ...((init?.headers as Record<string, string>) ?? {}),
    },
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(`[publisher] Zernio ${res.status}: ${msg}`)
  }
  return res.json() as T
}

// ── Profile management ────────────────────────────────────────────────────────

/** Create a Zernio profile for a new tenant. Returns the profile ID or null on failure. */
export async function createProfile(name: string): Promise<string | null> {
  try {
    const data = await zCall<{ _id?: string; id?: string }>('/profiles', {
      method: 'POST',
      body: JSON.stringify({ name, description: `Agent7even — ${name}` }),
    })
    return data._id ?? data.id ?? null
  } catch (err) {
    console.error('[publisher] createProfile failed:', err)
    return null
  }
}

// ── Connect / disconnect ───────────────────────────────────────────────────────

/** Get the OAuth redirect URL for connecting a platform. Returns null on failure. */
export async function getConnectUrl(
  profileId: string,
  platform: string,
  redirectUri: string,
): Promise<string | null> {
  try {
    const q = new URLSearchParams({ profileId, redirectUrl: redirectUri })
    const data = await zCall<{ authUrl?: string; auth_url?: string }>(
      `/connect/${encodeURIComponent(platform)}?${q}`,
    )
    return data.authUrl ?? data.auth_url ?? null
  } catch (err) {
    console.error('[publisher] getConnectUrl failed:', err)
    return null
  }
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
    return await zCall(`/analytics/get-analytics?${q}`)
  } catch (err) {
    console.error('[publisher] getSocialAnalytics failed:', err)
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
    return await zCall(`/ads/get-analytics?${q}`)
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
