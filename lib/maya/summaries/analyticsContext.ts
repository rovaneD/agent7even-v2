import { MOCK_ANALYTICS_INBOX, MOCK_GA_DATA, MOCK_POSTING_ANALYTICS } from '@/lib/analytics/mockData'
import type { AnalyticsDataState } from '@/app/dashboard/analytics/page'
import type { MayaPageContext } from '@/lib/maya/contextTypes'

type PostingTab = 'posting' | 'inbox' | 'ga'

interface GaSnapshot {
  summary: {
    sessions: number
    users: number
    pageviews: number
    bounceRate: string
    newUsers?: number
  }
  deltas?: {
    sessions?: number | null
    users?: number | null
    pageviews?: number | null
  }
  topPages?: { path: string; views: number }[]
  channels?: { channel: string; sessions: number }[]
  countries?: { country: string; users: number }[]
  devices?: { device: string; users: number }[]
}

interface PostingSnapshot {
  stats: {
    engagementRate: number
    engRateDelta: string
    totalReach: number
    reachDelta: string
    totalFollowers: number
    followersDelta: string
    postsThisPeriod: number
    bestPost: { caption: string; platform: string; engagements: number }
  }
  heatmap?: { bestDay: string; bestTime: string }
}

export interface AnalyticsMayaInput {
  companyName: string
  dataState: AnalyticsDataState
  activeTab: PostingTab
  dateRange: string
  gaId: string | null
  oauthConnected: boolean
  gaOAuthEmail: string | null
  gaData: GaSnapshot | null
  gaPending: boolean
  connectedPlatforms: string[]
  postingData: PostingSnapshot
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return `${n}`
}

function fmtDelta(delta: number | null | undefined): string {
  if (delta == null) return ''
  const sign = delta >= 0 ? '+' : ''
  return ` (${sign}${delta.toFixed(1)}% vs prior period)`
}

function truncate(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function summarizeGa(ga: GaSnapshot, dateRange: string): string[] {
  const s = ga.summary
  const newUsersPart = s.newUsers !== undefined ? `, ${s.newUsers.toLocaleString()} new users (total KPI — not broken down by channel)` : ''
  const lines: string[] = [
    `GA (${dateRange}): ${s.sessions.toLocaleString()} sessions${fmtDelta(ga.deltas?.sessions)}, ${s.users.toLocaleString()} active users${newUsersPart}${fmtDelta(ga.deltas?.users)}, ${s.pageviews.toLocaleString()} pageviews${fmtDelta(ga.deltas?.pageviews)}, bounce ${s.bounceRate}%`,
  ]

  if (ga.channels?.length) {
    lines.push(
      `Traffic channels = SESSION counts only (not new users per channel): ${ga.channels.map(c => `${c.channel} ${c.sessions} sessions`).join(', ')}`,
    )
    lines.push(
      'If asked where new users come from: quote the new-users KPI total above and the session-by-channel list separately — do not map channel sessions onto new users or claim a channel breakdown for new users.',
    )
  }

  if (ga.topPages?.length) {
    const top = ga.topPages.slice(0, 3)
    lines.push(`Top pages (read-only on screen): ${top.map(p => `${p.path} (${p.views} views)`).join(', ')}`)
  }

  if (ga.countries?.length) {
    const top = ga.countries.slice(0, 3)
    lines.push(`Countries (read-only on screen): ${top.map(c => `${c.country} ${c.users} users`).join(', ')}`)
  }

  if (ga.devices?.length) {
    lines.push(
      `Devices (read-only on screen): ${ga.devices.map(d => `${d.device} ${d.users} users`).join(', ')}`,
    )
  }

  return lines
}

function summarizeGaFromMock(dateRange: string): string[] {
  const ga: GaSnapshot = {
    summary: MOCK_GA_DATA.summary,
    deltas: MOCK_GA_DATA.deltas,
    topPages: MOCK_GA_DATA.topPages.map(p => ({ path: p.path, views: p.sessions })),
    channels: MOCK_GA_DATA.trafficSources.map(s => ({ channel: s.source, sessions: s.pct })),
    countries: MOCK_GA_DATA.countries,
    devices: MOCK_GA_DATA.devices,
  }
  return summarizeGa(ga, dateRange)
}

function summarizePosting(data: PostingSnapshot, dateRange: string): string[] {
  const s = data.stats
  const lines: string[] = [
    `Posting (${dateRange}): engagement ${s.engagementRate}%, reach ${fmtNum(s.totalReach)} (${s.reachDelta}), followers ${fmtNum(s.totalFollowers)} (${s.followersDelta}), ${s.postsThisPeriod} posts`,
  ]

  if (s.bestPost?.caption) {
    lines.push(
      `Best post: "${truncate(s.bestPost.caption, 55)}" on ${s.bestPost.platform} (${s.bestPost.engagements} engagements)`,
    )
  }

  if (data.heatmap?.bestDay && data.heatmap?.bestTime) {
    lines.push(`Best time to post: ${data.heatmap.bestDay} ${data.heatmap.bestTime}`)
  }

  return lines
}

function summarizeInbox(): string[] {
  const inbox = MOCK_ANALYTICS_INBOX
  return [
    `Inbox: ${inbox.totalComments} comments, ${inbox.totalDMs} DMs, ${inbox.responseRate}% response rate`,
  ]
}

const TAB_LABELS: Record<PostingTab, string> = {
  posting: 'Posting analytics',
  inbox:   'Inbox analytics',
  ga:      'Google analytics',
}

const VOICE_RULE =
  'VOICE: Never mention Zernio or other internal vendor/integration names to the user. Use product language only: Posting analytics, connected social accounts, Google Analytics, Agent7even.'

const TAB_AFFORDANCE: Record<PostingTab, string> = {
  posting:
    `${VOICE_RULE} User is on Posting analytics (connected social accounts). Platform, source, and date filters are the interactive controls. Charts and stat cards are read-only — interpret metrics in chat; do not tell the user to click charts.`,
  inbox:
    `${VOICE_RULE} User is on Inbox analytics. Only the date range filter is interactive. Inbox numbers are sample/demo until live inbox data is available. Do not tell the user to click anything.`,
  ga:
    `${VOICE_RULE} User is on the Google analytics tab inside Agent7even — not analytics.google.com. UI RULES: (1) KPI cards, traffic charts, Traffic channels, Top pages, Countries, and Devices are read-only displays — nothing is clickable and there is no drill-down. (2) The ONLY interactive control on this tab is the date range dropdown (e.g. Last 30 days). (3) Answer by interpreting the ON-SCREEN SUMMARY below — quote numbers directly in your reply. (4) NEVER say click, tap, drill down, open, check the chart, look at the section, or filter. (5) METRIC RULE: Traffic channels are SESSION counts, not new-user counts. This dashboard does not show new users by channel. If asked where new users come from, give the new-users KPI total and describe session mix separately — never attribute channel session numbers to new users. (6) GA "Organic Social" = website sessions Google attributes to social referrals — NOT social post stats from the Posting analytics tab. If contrasting low Organic Social with Instagram, explain: connected for posting in Agent7even vs website click-through tracked in Google Analytics are separate — never name internal vendors. (7) Do not send them to analytics.google.com.`,
}

export function buildAnalyticsMayaContext(input: AnalyticsMayaInput): MayaPageContext {
  const {
    companyName,
    dataState,
    activeTab,
    dateRange,
    gaId,
    oauthConnected,
    gaOAuthEmail,
    gaData,
    gaPending,
    connectedPlatforms,
    postingData,
  } = input

  const dataSource =
    dataState === 'mock' ? 'sample'
    : dataState === 'empty' ? 'none'
    : 'live'

  const connections: string[] = []

  if (dataState === 'mock') {
    connections.push('Social posting: demo mode (sample platforms shown)')
    connections.push(gaId ? `Google Analytics: demo property ${gaId}` : 'Google Analytics: demo sample data')
  } else {
    connections.push(
      connectedPlatforms.length
        ? `Social accounts connected for posting: ${connectedPlatforms.join(', ')}`
        : 'Social accounts: none connected for posting',
    )
    if (oauthConnected && gaId) {
      connections.push(
        `Google Analytics: connected, property ${gaId}${gaOAuthEmail ? ` (${gaOAuthEmail})` : ''}`,
      )
    } else if (oauthConnected) {
      connections.push('Google Analytics: OAuth connected, property not selected')
    } else {
      connections.push('Google Analytics: not connected')
    }
    if (gaPending) connections.push('Google Analytics: sync pending')
  }

  const metrics: string[] = []

  // Posting — omit on GA tab so Maya stays focused on website analytics
  if (activeTab !== 'ga') {
    if (dataState === 'mock') {
      metrics.push(...summarizePosting(MOCK_POSTING_ANALYTICS, dateRange))
    } else if (dataState === 'live' && connectedPlatforms.length) {
      metrics.push(...summarizePosting(postingData, dateRange))
    } else if (dataState === 'empty') {
      metrics.push('Posting: no social accounts connected yet')
    }
  }

  // GA — mock demo, live fetched data, or explicit not-connected / pending states
  if (dataState === 'mock') {
    metrics.push(...summarizeGaFromMock(dateRange))
  } else if (gaData) {
    metrics.push(...summarizeGa(gaData, dateRange))
  } else if (gaPending) {
    metrics.push('Google Analytics: data sync in progress')
  } else if (!oauthConnected || !gaId) {
    metrics.push('Google Analytics: connect a property to see website analytics')
  }

  // Inbox tab always reads MOCK_ANALYTICS_INBOX in the UI today
  if (activeTab === 'inbox') {
    metrics.push('INBOX DATA: SAMPLE / MOCK — inbox tab uses demo data until live inbox is available.')
    metrics.push(...summarizeInbox())
  }

  if (activeTab === 'ga') {
    metrics.unshift(
      `Active filter: date range ${dateRange} (only interactive control on this tab). All charts below are read-only.`,
    )
    if (connectedPlatforms.length > 0) {
      metrics.push(
        `Social accounts connected for posting (${connectedPlatforms.join(', ')}) — see Posting analytics tab. Unrelated to Google Analytics Traffic channels on this tab.`,
      )
    }
    metrics.push(
      'Google Analytics "Organic Social" = website visits from social click-through — not post reach/engagement and not whether Instagram is connected for posting in Agent7even.',
    )
  }

  return {
    page: 'ANALYTICS PAGE',
    dataSource,
    company: companyName || undefined,
    activeView: `${TAB_LABELS[activeTab]} (${dateRange})`,
    connections,
    metrics,
    affordance: TAB_AFFORDANCE[activeTab],
  }
}
