import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { refreshGoogleAccessToken } from '@/lib/googleOAuth'

// ── Auth helpers ──────────────────────────────────────────────────────────────

function getServiceAccountClient() {
  const email = process.env.GOOGLE_SA_CLIENT_EMAIL
  const key = process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!email || !key) throw new Error('Service account credentials not configured')
  return new BetaAnalyticsDataClient({
    credentials: { client_email: email, private_key: key },
  })
}

// ── Date ranges ───────────────────────────────────────────────────────────────

const RANGE_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '6m': 180,
  '1y': 365,
}

function dateRanges(range: string) {
  const n = RANGE_DAYS[range] ?? 7
  return {
    current: { startDate: `${n}daysAgo`, endDate: 'today' },
    previous: { startDate: `${2 * n}daysAgo`, endDate: `${n + 1}daysAgo` },
  }
}

// ── Report definitions (shared by OAuth REST and service-account paths) ──────

function buildReports(range: string) {
  const { current, previous } = dateRanges(range)
  return {
    chart: {
      dateRanges: [current],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    },
    // Rolling active users — GA's "User activity over time" card (28-day is GA's "30 days")
    activity: {
      dateRanges: [current],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'active1DayUsers' },
        { name: 'active7DayUsers' },
        { name: 'active28DayUsers' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    },
    // Two date ranges → each row carries a date_range_0 / date_range_1 dimension
    totals: {
      dateRanges: [current, previous],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'newUsers' },
        { name: 'averageSessionDuration' },
      ],
    },
    pages: {
      dateRanges: [current],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 5,
    },
    channels: {
      dateRanges: [current],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 7,
    },
    countries: {
      dateRanges: [current],
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 6,
    },
    devices: {
      dateRanges: [current],
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 3,
    },
    events: {
      dateRanges: [current],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 10,
    },
    hostnames: {
      dateRanges: [current],
      dimensions: [{ name: 'hostName' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 6,
    },
    sources: {
      dateRanges: [current],
      dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 8,
    },
  }
}

// ── Response parsing (REST and client-lib rows share the same shape) ─────────

type GaRow = {
  dimensionValues?: { value?: string | null }[] | null
  metricValues?: { value?: string | null }[] | null
}
type GaReport = { rows?: GaRow[] | null; error?: { message: string } }

const dim = (r: GaRow, i = 0) => r.dimensionValues?.[i]?.value ?? ''
const met = (r: GaRow, i = 0) => Number(r.metricValues?.[i]?.value ?? 0)

function pctDelta(curr: number, prev: number): number | null {
  if (!prev) return null
  return Math.round(((curr - prev) / prev) * 1000) / 10
}

function parseReports(r: Record<keyof ReturnType<typeof buildReports>, GaReport>) {
  const chartData = (r.chart.rows ?? []).map(row => ({
    day: dim(row),
    sessions: met(row, 0),
    users: met(row, 1),
  }))

  const activityData = (r.activity.rows ?? []).map(row => ({
    day: dim(row),
    dau: met(row, 0),
    wau: met(row, 1),
    mau: met(row, 2),
  }))

  // totals: rows tagged date_range_0 (current) / date_range_1 (previous)
  const totalsRows = r.totals.rows ?? []
  const currRow = totalsRows.find(row => dim(row) === 'date_range_0') ?? totalsRows[0]
  const prevRow = totalsRows.find(row => dim(row) === 'date_range_1')

  const summary = {
    sessions: met(currRow ?? {}, 0),
    users: met(currRow ?? {}, 1),
    pageviews: met(currRow ?? {}, 2),
    // GA4 returns bounceRate as a 0–1 fraction
    bounceRate: (met(currRow ?? {}, 3) * 100).toFixed(1),
    newUsers: met(currRow ?? {}, 4),
    avgSessionDuration: Math.round(met(currRow ?? {}, 5)),
  }

  const deltas = prevRow
    ? {
        sessions: pctDelta(summary.sessions, met(prevRow, 0)),
        users: pctDelta(summary.users, met(prevRow, 1)),
        pageviews: pctDelta(summary.pageviews, met(prevRow, 2)),
        newUsers: pctDelta(summary.newUsers, met(prevRow, 4)),
      }
    : undefined

  return {
    chartData,
    activityData,
    summary,
    deltas,
    topPages: (r.pages.rows ?? []).map(row => ({ path: dim(row), views: met(row) })),
    channels: (r.channels.rows ?? []).map(row => ({ channel: dim(row), sessions: met(row) })),
    countries: (r.countries.rows ?? []).map(row => ({ country: dim(row), users: met(row) })),
    devices: (r.devices.rows ?? []).map(row => ({ device: dim(row), users: met(row) })),
    events: (r.events.rows ?? []).map(row => ({ name: dim(row), count: met(row) })),
    hostnames: (r.hostnames.rows ?? []).map(row => ({ hostname: dim(row), sessions: met(row) })),
    sources: (r.sources.rows ?? []).map(row => {
      const source = dim(row, 0)
      const medium = dim(row, 1)
      return { source, medium, label: `${source} / ${medium}`, sessions: met(row, 0) }
    }),
  }
}

// ── Runners ───────────────────────────────────────────────────────────────────

async function queryViaOAuth(propertyId: string, accessToken: string, range: string) {
  const reports = buildReports(range)
  const names = Object.keys(reports) as (keyof typeof reports)[]

  const responses = await Promise.all(
    names.map(name =>
      fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(reports[name]),
      }).then(res => res.json() as Promise<GaReport>)
    )
  )

  const firstError = responses.find(res => res.error)
  if (firstError?.error) throw new Error(firstError.error.message)

  const byName = Object.fromEntries(names.map((name, i) => [name, responses[i]]))
  return parseReports(byName as Parameters<typeof parseReports>[0])
}

async function queryViaServiceAccount(propertyId: string, range: string) {
  const client = getServiceAccountClient()
  const reports = buildReports(range)
  const names = Object.keys(reports) as (keyof typeof reports)[]

  const responses = await Promise.all(
    names.map(name =>
      client
        .runReport({ property: `properties/${propertyId}`, ...reports[name] })
        .then(([resp]) => resp as GaReport)
    )
  )

  const byName = Object.fromEntries(names.map((name, i) => [name, responses[i]]))
  return parseReports(byName as Parameters<typeof parseReports>[0])
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const range = req.nextUrl.searchParams.get('range') ?? '7d'

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('ga_measurement_id, ga_refresh_token')
    .eq('clerk_user_id', userId)
    .single()

  const propertyId = profile?.ga_measurement_id
  if (!propertyId) {
    return NextResponse.json({ error: 'No GA property configured' }, { status: 404 })
  }

  const hasOAuth = Boolean(profile?.ga_refresh_token)

  function isPermissionError(message: string) {
    return (
      message.includes('does not have access') ||
      message.includes('PERMISSION_DENIED') ||
      message.includes('403')
    )
  }

  try {
    // OAuth-connected tenants: never fall back to the service account — a stale refresh
    // token was previously misclassified as "access pending" when SA also lacked access.
    if (hasOAuth) {
      const accessToken = await refreshGoogleAccessToken(profile!.ga_refresh_token!)
      if (!accessToken) {
        return NextResponse.json({ connected: false, needsReconnect: true })
      }

      try {
        const result = await queryViaOAuth(propertyId, accessToken, range)
        return NextResponse.json({ connected: true, via: 'oauth', ...result })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        if (isPermissionError(message)) {
          return NextResponse.json({ connected: false, needsReconnect: true })
        }
        throw err
      }
    }

    // Agency / manual property ID — service account must already have Viewer on the property.
    const result = await queryViaServiceAccount(propertyId, range)
    return NextResponse.json({ connected: true, via: 'service_account', ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (isPermissionError(message)) {
      return NextResponse.json({ connected: false, pending: true })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
