import { AsyncLocalStorage } from 'async_hooks'
import { createServiceClient } from '@/lib/supabase/server'

export type ZernioOperation =
  | 'analytics_read'
  | 'ads_read'
  | 'inbox_read'
  | 'inbox_send'
  | 'publish'
  | 'posts_read'
  | 'connect'
  | 'profile'
  | 'accounts_read'
  | 'media'
  | 'queue'
  | 'other'

export type ZernioUsageContext = {
  userId: string
  zernioProfileId?: string
}

export type ZernioUsageLogInput = {
  userId: string
  zernioProfileId?: string
  platform?: string | null
  operation: ZernioOperation
  httpMethod: string
  path: string
  statusCode?: number | null
  metadata?: Record<string, unknown>
  requestBody?: string
}

const X_READ_COST_USD = 0.005
const X_PUBLISH_COST_USD = 0.015
const X_PUBLISH_URL_COST_USD = 0.2

const zernioUsageStore = new AsyncLocalStorage<ZernioUsageContext>()

export function getZernioUsageContext(): ZernioUsageContext | undefined {
  return zernioUsageStore.getStore()
}

/** Run Zernio publisher calls with tenant context for usage logging. */
export async function withZernioUsageContext<T>(
  ctx: ZernioUsageContext,
  fn: () => Promise<T>,
): Promise<T> {
  return zernioUsageStore.run(ctx, fn)
}

function normalizePlatform(value: string | null | undefined): string | null {
  if (!value) return null
  const p = value.trim().toLowerCase()
  if (p === 'twitter') return 'x'
  return p || null
}

export function inferZernioOperation(pathname: string, method: string): ZernioOperation {
  const m = method.toUpperCase()
  if (pathname.startsWith('/connect/')) return 'connect'
  if (pathname.startsWith('/profiles') && m === 'POST') return 'profile'
  if (pathname.startsWith('/profiles') && m === 'DELETE') return 'profile'
  if (pathname.startsWith('/analytics/inbox')) return 'inbox_read'
  if (pathname.startsWith('/analytics')) return 'analytics_read'
  if (pathname.startsWith('/ads')) return 'ads_read'
  if (pathname.startsWith('/inbox/conversations/') && pathname.endsWith('/messages') && m === 'POST') {
    return 'inbox_send'
  }
  if (/^\/inbox\/comments\/[^/]+$/.test(pathname) && m === 'POST') {
    return 'inbox_send'
  }
  if (pathname.startsWith('/inbox/')) return 'inbox_read'
  if (pathname === '/posts' && m === 'POST') return 'publish'
  if (pathname.startsWith('/posts/') && (m === 'PATCH' || m === 'PUT')) return 'publish'
  if (pathname.startsWith('/posts')) return 'posts_read'
  if (pathname.startsWith('/accounts/follower-stats')) return 'analytics_read'
  if (pathname.startsWith('/accounts') && m === 'DELETE') return 'profile'
  if (pathname.startsWith('/accounts')) return 'accounts_read'
  if (pathname.startsWith('/media/')) return 'media'
  if (pathname.startsWith('/queue/')) return 'queue'
  return 'other'
}

function extractPlatformsFromBody(body: string | undefined): string[] {
  if (!body) return []
  try {
    const parsed = JSON.parse(body) as {
      platforms?: Array<{ platform?: string }>
      platform?: string
    }
    if (Array.isArray(parsed.platforms)) {
      return parsed.platforms
        .map(p => normalizePlatform(p.platform))
        .filter((p): p is string => Boolean(p))
    }
    const single = normalizePlatform(parsed.platform)
    return single ? [single] : []
  } catch {
    return []
  }
}

function extractContentFromBody(body: string | undefined): string {
  if (!body) return ''
  try {
    const parsed = JSON.parse(body) as { content?: string; customContent?: string }
    return String(parsed.content ?? parsed.customContent ?? '')
  } catch {
    return ''
  }
}

function parsePathQuery(path: string): URLSearchParams {
  const qIndex = path.indexOf('?')
  if (qIndex === -1) return new URLSearchParams()
  return new URLSearchParams(path.slice(qIndex + 1))
}

export function resolveUsageFromCall(opts: {
  path: string
  method: string
  body?: string
  ctx?: ZernioUsageContext
}): Pick<ZernioUsageLogInput, 'platform' | 'operation' | 'zernioProfileId' | 'metadata'> {
  const [pathname] = opts.path.split('?')
  const query = parsePathQuery(opts.path)
  const operation = inferZernioOperation(pathname, opts.method)

  const connectMatch = pathname.match(/^\/connect\/([^/?]+)/)
  const connectPlatform = normalizePlatform(connectMatch?.[1])

  let platform =
    normalizePlatform(query.get('platform')) ??
    connectPlatform ??
    null

  const bodyPlatforms = extractPlatformsFromBody(opts.body)
  if (!platform && bodyPlatforms.length === 1) {
    platform = bodyPlatforms[0]
  }

  const zernioProfileId =
    query.get('profileId') ??
    opts.ctx?.zernioProfileId ??
    undefined

  const metadata: Record<string, unknown> = {}
  if (bodyPlatforms.length > 1) metadata.platforms = bodyPlatforms
  if (operation === 'publish') {
    const content = extractContentFromBody(opts.body)
    if (content) metadata.hasUrl = /https?:\/\//i.test(content)
  }

  return { platform, operation, zernioProfileId, metadata }
}

export function estimateZernioCostUsd(input: {
  platform?: string | null
  operation: ZernioOperation
  metadata?: Record<string, unknown>
  bodyPlatforms?: string[]
}): number {
  const platforms = new Set<string>()
  if (input.platform) platforms.add(input.platform)
  for (const p of input.bodyPlatforms ?? []) platforms.add(p)

  if (!platforms.has('x')) return 0

  if (input.operation === 'publish') {
    if (input.metadata?.hasUrl === true) return X_PUBLISH_URL_COST_USD
    return X_PUBLISH_COST_USD
  }

  if (
    input.operation === 'analytics_read' ||
    input.operation === 'inbox_read' ||
    input.operation === 'inbox_send' ||
    input.operation === 'posts_read' ||
    input.operation === 'accounts_read' ||
    input.operation === 'ads_read' ||
    input.operation === 'connect' ||
    input.operation === 'other'
  ) {
    return X_READ_COST_USD
  }

  return 0
}

export async function logZernioUsage(input: ZernioUsageLogInput): Promise<void> {
  if (!input.userId) return

  const bodyPlatforms = extractPlatformsFromBody(input.requestBody)
  const cost = estimateZernioCostUsd({
    platform: input.platform,
    operation: input.operation,
    metadata: input.metadata,
    bodyPlatforms,
  })

  const supabase = createServiceClient()
  const { error } = await supabase.from('zernio_api_usage').insert({
    user_id: input.userId,
    zernio_profile_id: input.zernioProfileId ?? null,
    platform: input.platform ?? null,
    operation: input.operation,
    http_method: input.httpMethod.toUpperCase(),
    path: input.path.split('?')[0],
    status_code: input.statusCode ?? null,
    estimated_cost_usd: cost,
    metadata: Object.keys(input.metadata ?? {}).length ? input.metadata : null,
  })

  if (error) {
    console.error('[zernioUsage] insert failed:', error.message)
  }
}

/** Called from publisher.zCall after each Zernio HTTP request. */
export function recordZernioCall(opts: {
  path: string
  method: string
  body?: string
  statusCode?: number | null
}): void {
  const ctx = getZernioUsageContext()
  if (!ctx?.userId) return

  const resolved = resolveUsageFromCall({
    path: opts.path,
    method: opts.method,
    body: opts.body,
    ctx,
  })

  void logZernioUsage({
    userId: ctx.userId,
    zernioProfileId: resolved.zernioProfileId,
    platform: resolved.platform,
    operation: resolved.operation,
    httpMethod: opts.method,
    path: opts.path,
    statusCode: opts.statusCode,
    metadata: resolved.metadata,
    requestBody: opts.body,
  }).catch(err => {
    console.error('[zernioUsage] record failed:', err)
  })
}

