// All Zernio API calls go through this module.
// Never scatter Zernio calls across routes — import from here.
// Fail soft: every exported function returns null/false/[] on error, never throws.

import { recordZernioCall } from '@/lib/social/zernioUsage'

export type { ZernioUsageContext } from '@/lib/social/zernioUsage'
export { withZernioUsageContext } from '@/lib/social/zernioUsage'

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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function zCall<T = unknown>(path: string, init?: RequestInit, attempt = 0): Promise<T> {
  guardRate()
  const url = `${ZERNIO_BASE}${path}`
  const method = init?.method ?? 'GET'
  const requestBody = typeof init?.body === 'string' ? init.body : undefined
  console.log(`[publisher] ${method} ${url}${attempt > 0 ? ` (retry ${attempt})` : ''}`)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)

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
    if (attempt === 0) {
      recordZernioCall({ path, method, body: requestBody, statusCode: null })
    }
    throw new Error(`[publisher] fetch failed: ${msg}`)
  }
  clearTimeout(timer)

  const text = await res.text().catch(() => '')
  console.log(`[publisher] response ${res.status}: ${text.slice(0, 500)}`)

  if (res.status === 429 && attempt < 3) {
    const retryAfterSec = Number.parseInt(res.headers.get('retry-after') ?? '', 10)
    const delayMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
      ? retryAfterSec * 1000
      : 400 * (attempt + 1) ** 2
    console.warn(`[publisher] 429 on ${path} — backing off ${delayMs}ms`)
    await sleep(delayMs)
    return zCall<T>(path, init, attempt + 1)
  }

  if (attempt === 0) {
    recordZernioCall({ path, method, body: requestBody, statusCode: res.status })
  }

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
  opts?: { headless?: boolean },
): Promise<string> {
  const q = new URLSearchParams({ profileId, redirect_url: redirectUri })
  if (opts?.headless) q.set('headless', 'true')
  const data = await zCall<{ authUrl?: string; auth_url?: string }>(
    `/connect/${encodeURIComponent(platform)}?${q}`,
  )
  const url = data.authUrl ?? data.auth_url
  if (!url) throw new Error('[publisher] Zernio getConnectUrl returned no authUrl')
  return url
}

export type ZernioFacebookPage = {
  id: string
  name: string
  username?: string
  category?: string
}

/** Headless Facebook connect — list pages after Meta OAuth. */
export async function listFacebookPages(
  profileId: string,
  tempToken: string,
): Promise<ZernioFacebookPage[]> {
  const q = new URLSearchParams({ profileId, tempToken })
  const data = await zCall<{ pages?: Array<Record<string, unknown>> }>(
    `/connect/facebook/select-page?${q}`,
  )
  const pages = Array.isArray(data.pages) ? data.pages : []
  return pages
    .map((p) => ({
      id: String(p.id ?? p._id ?? ''),
      name: String(p.name ?? p.title ?? ''),
      username: p.username ? String(p.username) : undefined,
      category: p.category ? String(p.category) : undefined,
    }))
    .filter((p) => p.id)
}

/** Headless Facebook connect — bind a page and finish the connection. */
export async function selectFacebookPage(opts: {
  profileId: string
  pageId: string
  tempToken: string
  userProfile: Record<string, unknown>
  redirectUri: string
}): Promise<{ redirectUrl?: string; accountId?: string; username?: string }> {
  const data = await zCall<{
    redirect_url?: string
    redirectUrl?: string
    account?: { accountId?: string; username?: string; platformUsername?: string }
  }>('/connect/facebook/select-page', {
    method: 'POST',
    body: JSON.stringify({
      profileId: opts.profileId,
      pageId: opts.pageId,
      tempToken: opts.tempToken,
      userProfile: opts.userProfile,
      redirect_url: opts.redirectUri,
    }),
  })
  return {
    redirectUrl: data.redirect_url ?? data.redirectUrl,
    accountId: data.account?.accountId,
    username: data.account?.username ?? data.account?.platformUsername,
  }
}

/** Platforms that use Meta OAuth and should stay on our domain after auth (headless). */
export const ZERNIO_HEADLESS_PLATFORMS = new Set(['facebook', 'instagram', 'threads'])

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

/** Disconnect by Zernio account document id when platform slug disconnect is insufficient. */
export async function disconnectAccountById(accountId: string): Promise<boolean> {
  try {
    await zCall(`/accounts/${encodeURIComponent(accountId)}`, { method: 'DELETE' })
    return true
  } catch (err) {
    console.error('[publisher] disconnectAccountById failed:', err)
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
  accountId?: string
  postId?: string      // platformPostId — use GET /analytics?postId= per Zernio docs
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
    if (params.accountId) q.set('accountId', params.accountId)
    if (params.postId) q.set('postId', params.postId)
    return await zCall(`/analytics?${q}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[publisher] getSocialAnalytics failed:', msg)
    return { _zernioError: msg }
  }
}

// ── Analytics helpers (documented endpoints) ──────────────────────────────────

type ZernioAccountRow = {
  _id?: string
  id?: string
  platform?: string
  platformUsername?: string
  username?: string
  displayName?: string
  followersCount?: number
  profileId?: string
  metadata?: {
    connectedAt?: string
    profileData?: {
      username?: string
      displayName?: string
      followersCount?: number
    }
  }
}

export type ZernioConnectedAccountInfo = {
  id: string
  platform: string
  username: string
  displayName: string
  followersCount: number
  connectedAt: string | null
  profileId?: string
}

function parseConnectedAccountRow(row: ZernioAccountRow): ZernioConnectedAccountInfo | null {
  const id = String(row._id ?? row.id ?? '')
  if (!id) return null
  const platform = String(row.platform ?? '').toLowerCase()
  const profileData = row.metadata?.profileData
  const username = String(
    row.platformUsername ?? row.username ?? profileData?.username ?? '',
  ).replace(/^@/, '')
  const displayName = String(row.displayName ?? profileData?.displayName ?? '')
  const followersCount = Number(row.followersCount ?? profileData?.followersCount ?? 0) || 0
  const connectedAt = row.metadata?.connectedAt ?? null
  const profileIdRaw = row.profileId
  const profileId = typeof profileIdRaw === 'string'
    ? profileIdRaw
    : profileIdRaw && typeof profileIdRaw === 'object'
      ? String((profileIdRaw as { _id?: string; id?: string })._id ?? (profileIdRaw as { id?: string }).id ?? '')
      : undefined
  return { id, platform, username, displayName, followersCount, connectedAt, profileId: profileId || undefined }
}

function mapAccountRows(arr: ZernioAccountRow[]): Array<{ id: string; platform: string; username: string; profileId?: string }> {
  return arr
    .map(a => ({
      id: String(a._id ?? a.id ?? ''),
      platform: String(a.platform ?? ''),
      username: String(a.platformUsername ?? a.username ?? ''),
      profileId: a.profileId ? String(a.profileId) : undefined,
    }))
    .filter(a => a.id)
}

/** List all connected accounts on this API key (Zernio docs: GET /accounts). */
export async function listAllAccounts(): Promise<Array<{ id: string; platform: string; username: string; profileId?: string }>> {
  try {
    const data = await zCall<{ accounts?: ZernioAccountRow[]; results?: ZernioAccountRow[] }>('/accounts')
    const arr = Array.isArray(data.accounts) ? data.accounts : Array.isArray(data.results) ? data.results : []
    return mapAccountRows(arr)
  } catch (err) {
    console.error('[publisher] listAllAccounts failed:', err)
    return []
  }
}

/** Returns full account objects including _id (accountId needed for analytics calls). */
export async function getProfileAccounts(
  profileId: string,
): Promise<Array<{ id: string; platform: string; username: string }>> {
  try {
    const accounts = await getProfileConnectedAccounts(profileId)
    return accounts.map(({ id, platform, username }) => ({ id, platform, username }))
  } catch (err) {
    console.error('[publisher] getProfileAccounts failed:', err)
    return []
  }
}

/** Connected accounts with usernames and reconnect timestamps for UI labels. */
export async function getProfileConnectedAccounts(profileId: string): Promise<ZernioConnectedAccountInfo[]> {
  try {
    const data = await zCall<{ accounts?: ZernioAccountRow[]; results?: ZernioAccountRow[] }>(
      `/accounts?profileId=${encodeURIComponent(profileId)}`,
    )
    const arr = Array.isArray(data.accounts) ? data.accounts : Array.isArray(data.results) ? data.results : []
    return arr
      .map(parseConnectedAccountRow)
      .filter((a): a is ZernioConnectedAccountInfo => a !== null)
  } catch (err) {
    console.error('[publisher] getProfileConnectedAccounts failed:', err)
    return []
  }
}

/** Deduped connected accounts across all tenant Zernio profiles. */
export async function getTenantConnectedAccounts(profileIds: string[]): Promise<ZernioConnectedAccountInfo[]> {
  const seen = new Set<string>()
  const out: ZernioConnectedAccountInfo[] = []
  for (const profileId of profileIds) {
    for (const account of await getProfileConnectedAccounts(profileId)) {
      if (seen.has(account.id)) continue
      seen.add(account.id)
      out.push(account)
    }
  }
  return out
}

/** Daily time series — for Posts over time / Likes over time charts. */
export async function getDailyAnalytics(params: { profileId: string; platform?: string; accountId?: string; fromDate: string; toDate: string }): Promise<unknown> {
  try {
    const q = new URLSearchParams({
      profileId: params.profileId,
      fromDate: params.fromDate,
      toDate: params.toDate,
    })
    if (params.platform) q.set('platform', params.platform)
    if (params.accountId) q.set('accountId', params.accountId)
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

/** Posting frequency vs engagement — for the scatter plot and cadence summary. */
export async function getPostingFrequency(params: { profileId: string; platform?: string; accountId?: string; source?: 'all' | 'late' | 'external' }): Promise<unknown> {
  try {
    const q = new URLSearchParams({ profileId: params.profileId })
    if (params.platform) q.set('platform', params.platform)
    if (params.accountId) q.set('accountId', params.accountId)
    if (params.source) q.set('source', params.source)
    return await zCall(`/analytics/posting-frequency?${q}`)
  } catch (err) {
    console.error('[publisher] getPostingFrequency failed:', err)
    return null
  }
}

/** Content decay / engagement accumulation curve. */
export async function getContentDecay(params: { profileId: string; platform?: string; accountId?: string; source?: 'all' | 'late' | 'external' }): Promise<unknown> {
  try {
    const q = new URLSearchParams({ profileId: params.profileId })
    if (params.platform) q.set('platform', params.platform)
    if (params.accountId) q.set('accountId', params.accountId)
    if (params.source) q.set('source', params.source)
    return await zCall(`/analytics/content-decay?${q}`)
  } catch (err) {
    console.error('[publisher] getContentDecay failed:', err)
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

/** Fetch inbox volume analytics from Zernio. Returns null on failure. */
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

export interface InboxCommentsParams {
  profileId: string
  page?: number
  limit?: number
}

/** List post comments from Zernio inbox. Returns null on failure. */
export async function listInboxComments(params: InboxCommentsParams): Promise<unknown> {
  try {
    const q = new URLSearchParams({ profileId: params.profileId })
    if (params.page) q.set('page', String(params.page))
    if (params.limit) q.set('limit', String(params.limit))
    return await zCall(`/inbox/comments?${q}`)
  } catch (err) {
    console.error('[publisher] listInboxComments failed:', err)
    return null
  }
}

/** Per-conversation inbox analytics from Zernio. Returns null on failure. */
export async function getInboxConversationAnalytics(params: InboxSummaryParams): Promise<unknown> {
  try {
    const q = new URLSearchParams({
      profileId: params.profileId,
      fromDate: params.fromDate,
      toDate: params.toDate,
    })
    return await zCall(`/analytics/inbox/conversations?${q}`)
  } catch (err) {
    console.error('[publisher] getInboxConversationAnalytics failed:', err)
    return null
  }
}

export interface InboxConversationsParams {
  profileId: string
  limit?: number
  cursor?: string
}

/** List DM conversations from Zernio inbox. Returns null on failure. */
export async function listInboxConversations(params: InboxConversationsParams): Promise<unknown> {
  try {
    const q = new URLSearchParams({ profileId: params.profileId })
    if (params.limit) q.set('limit', String(params.limit))
    if (params.cursor) q.set('cursor', params.cursor)
    return await zCall(`/inbox/conversations?${q}`)
  } catch (err) {
    console.error('[publisher] listInboxConversations failed:', err)
    return null
  }
}

export interface InboxThreadParams {
  profileId: string
  conversationId: string
  accountId: string
}

/** Fetch messages in a DM thread. Returns null on failure. */
export async function getInboxThread(params: InboxThreadParams): Promise<unknown> {
  try {
    const q = new URLSearchParams({
      profileId: params.profileId,
      accountId: params.accountId,
    })
    return await zCall(`/inbox/conversations/${encodeURIComponent(params.conversationId)}/messages?${q}`)
  } catch (err) {
    console.error('[publisher] getInboxThread failed:', err)
    return null
  }
}

export interface SendInboxReplyParams {
  profileId: string
  conversationId: string
  accountId: string
  message: string
}

/** Send a DM reply in an existing conversation. Returns null on failure. */
export async function sendInboxReply(params: SendInboxReplyParams): Promise<unknown> {
  try {
    const q = new URLSearchParams({ profileId: params.profileId })
    return await zCall(
      `/inbox/conversations/${encodeURIComponent(params.conversationId)}/messages?${q}`,
      {
        method: 'POST',
        body: JSON.stringify({
          accountId: params.accountId,
          message: params.message,
        }),
      },
    )
  } catch (err) {
    console.error('[publisher] sendInboxReply failed:', err)
    return null
  }
}

export function dateRangeToWindow(dateRange: string): { fromDate: string; toDate: string } {
  return getDateWindow(dateRange)
}

// ── Posts (scheduling / publishing) ───────────────────────────────────────────

export type ZernioPostPlatformTarget = {
  platform: string
  accountId: string
  customContent?: string
  platformSpecificData?: Record<string, unknown>
}

export type CreatePostParams = {
  content?: string
  title?: string
  profileId: string
  platforms?: ZernioPostPlatformTarget[]
  scheduledFor?: string
  timezone?: string
  publishNow?: boolean
  isDraft?: boolean
  queuedFromProfile?: string
  queueId?: string
  mediaItems?: Array<{ type: string; url: string; title?: string }>
  requestId?: string
}

export type UpdatePostParams = Partial<Omit<CreatePostParams, 'profileId' | 'requestId'>>

export type ListPostsParams = {
  profileId?: string
  accountId?: string
  platform?: string
  status?: 'draft' | 'scheduled' | 'published' | 'failed'
  page?: number
  limit?: number
  sortBy?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}

function postsQuery(params: ListPostsParams): URLSearchParams {
  const q = new URLSearchParams()
  if (params.profileId) q.set('profileId', params.profileId)
  if (params.accountId) q.set('accountId', params.accountId)
  if (params.platform) q.set('platform', params.platform)
  if (params.status) q.set('status', params.status)
  if (params.page) q.set('page', String(params.page))
  if (params.limit) q.set('limit', String(params.limit))
  if (params.sortBy) q.set('sortBy', params.sortBy)
  if (params.search) q.set('search', params.search)
  if (params.dateFrom) q.set('dateFrom', params.dateFrom)
  if (params.dateTo) q.set('dateTo', params.dateTo)
  return q
}

/** List queue schedules for a profile. Returns [] on failure. */
export async function listQueueSlots(
  profileId: string,
  options?: { all?: boolean },
): Promise<unknown> {
  try {
    const q = new URLSearchParams({ profileId })
    if (options?.all !== false) q.set('all', 'true')
    return await zCall(`/queue/slots?${q}`)
  } catch (err) {
    console.error('[publisher] listQueueSlots failed:', err)
    return null
  }
}

/** List posts from Zernio. Returns null on failure. */
export async function listPosts(params: ListPostsParams): Promise<unknown> {
  try {
    const q = postsQuery(params)
    return await zCall(`/posts?${q}`)
  } catch (err) {
    console.error('[publisher] listPosts failed:', err)
    return null
  }
}

/** Fetch a single post by Zernio post ID. */
export async function getPost(postId: string): Promise<unknown> {
  try {
    return await zCall(`/posts/${encodeURIComponent(postId)}`)
  } catch (err) {
    console.error('[publisher] getPost failed:', err)
    return null
  }
}

/** Create, schedule, draft, or publish a post. Throws on hard failures. */
export async function createPost(params: CreatePostParams): Promise<unknown> {
  const body: Record<string, unknown> = {
    content: params.content,
    profileId: params.profileId,
  }
  if (params.title) body.title = params.title
  if (params.platforms?.length) body.platforms = params.platforms
  if (params.scheduledFor) body.scheduledFor = params.scheduledFor
  if (params.timezone) body.timezone = params.timezone
  if (params.publishNow) body.publishNow = true
  if (params.isDraft) body.isDraft = true
  if (params.queuedFromProfile) body.queuedFromProfile = params.queuedFromProfile
  if (params.queueId) body.queueId = params.queueId
  if (params.mediaItems?.length) body.mediaItems = params.mediaItems

  const headers: Record<string, string> = {}
  if (params.requestId) headers['x-request-id'] = params.requestId

  return await zCall('/posts', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  })
}

/** Update a draft or scheduled post. */
export async function updatePost(postId: string, params: UpdatePostParams): Promise<unknown> {
  const body: Record<string, unknown> = {}
  if (params.content !== undefined) body.content = params.content
  if (params.title !== undefined) body.title = params.title
  if (params.platforms) body.platforms = params.platforms
  if (params.scheduledFor) body.scheduledFor = params.scheduledFor
  if (params.timezone) body.timezone = params.timezone
  if (params.publishNow !== undefined) body.publishNow = params.publishNow
  if (params.isDraft !== undefined) body.isDraft = params.isDraft
  if (params.queuedFromProfile) body.queuedFromProfile = params.queuedFromProfile
  if (params.queueId) body.queueId = params.queueId
  if (params.mediaItems) body.mediaItems = params.mediaItems

  return await zCall(`/posts/${encodeURIComponent(postId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

/** Delete a draft or scheduled post. Returns false on failure. */
export async function deletePost(postId: string): Promise<boolean> {
  try {
    await zCall(`/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' })
    return true
  } catch (err) {
    console.error('[publisher] deletePost failed:', err)
    return false
  }
}

// ── Media (presigned upload) ──────────────────────────────────────────────────

export type PresignMediaResult = {
  uploadUrl: string
  publicUrl: string
  mediaType: 'image' | 'video'
}

/** Request a presigned URL from Zernio for direct cloud upload. */
export async function presignMedia(params: {
  filename: string
  contentType: string
  size?: number
}): Promise<PresignMediaResult | null> {
  try {
    const raw = await zCall<Record<string, unknown>>('/media/presign', {
      method: 'POST',
      body: JSON.stringify({
        filename: params.filename,
        contentType: params.contentType,
        ...(params.size != null ? { size: params.size } : {}),
      }),
    })
    const data = (raw.data ?? raw) as Record<string, unknown>
    const uploadUrl = String(data.uploadUrl ?? '')
    const publicUrl = String(data.publicUrl ?? '')
    if (!uploadUrl || !publicUrl) return null
    const hinted = String(data.type ?? '').toLowerCase()
    const mediaType: 'image' | 'video' =
      hinted === 'video' || params.contentType.startsWith('video/') ? 'video' : 'image'
    return { uploadUrl, publicUrl, mediaType }
  } catch (err) {
    console.error('[publisher] presignMedia failed:', err)
    return null
  }
}

/** PUT file bytes to Zernio's presigned upload URL (no auth header). */
export async function uploadToPresignedUrl(
  uploadUrl: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<boolean> {
  try {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body,
    })
    if (!res.ok) {
      console.error('[publisher] presigned PUT failed:', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.error('[publisher] presigned PUT error:', err)
    return false
  }
}
