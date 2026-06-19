import { MOCK_ANALYTICS_INBOX, MOCK_GA_DATA, MOCK_POSTING_ANALYTICS } from '@/lib/analytics/mockData'
import type { AnalyticsInboxData } from '@/lib/social/zernioInboxParse'
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
  hostnames?: { hostname: string; sessions: number }[]
  sources?: { label: string; sessions: number }[]
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
  inboxData: AnalyticsInboxData
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

  if (ga.hostnames?.length) {
    const top = ga.hostnames.slice(0, 3)
    lines.push(`Hostnames (read-only on screen): ${top.map(h => `${h.hostname} (${h.sessions} sessions)`).join(', ')}`)
  }

  if (ga.sources?.length) {
    const top = ga.sources.slice(0, 4)
    lines.push(`Session source/medium (read-only on screen): ${top.map(s => `${s.label} ${s.sessions} sessions`).join(', ')}`)
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
    hostnames: MOCK_GA_DATA.hostnames,
    sources: MOCK_GA_DATA.sources.map(s => ({ label: s.label, sessions: s.sessions })),
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

function summarizeInbox(inbox: AnalyticsInboxData, dateRange: string): string[] {
  const lines = [
    `Inbox (${dateRange}): ${inbox.received} received, ${inbox.sent} sent, ${inbox.totalComments} comments, ${inbox.responseRate}% response rate`,
  ]
  if (inbox.conversations > 0) lines.push(`Conversations: ${inbox.conversations}`)
  if (inbox.medianResponseLabel) lines.push(`Median first response: ${inbox.medianResponseLabel}`)
  return lines
}

/** Inbox metrics are sample/demo until Zernio live fetch (dataState === 'live'). */
function isInboxMock(input: AnalyticsMayaInput): boolean {
  return input.dataState !== 'live'
}

/** Posting metrics are sample/demo until Zernio live fetch (dataState === 'live'). */
function isPostingMock(input: AnalyticsMayaInput): boolean {
  return input.dataState !== 'live'
}

/** GA demo numbers only when the whole page is in trial/no-plan mock mode. */
function isGaMock(input: AnalyticsMayaInput): boolean {
  return input.dataState === 'mock'
}

function gaStatusLine(input: AnalyticsMayaInput): string {
  const { gaId, oauthConnected, gaOAuthEmail, gaPending } = input
  if (isGaMock(input)) {
    return gaId
      ? `Google Analytics: SAMPLE / MOCK — demo property ${gaId}`
      : 'Google Analytics: SAMPLE / MOCK — demo sample data'
  }
  if (oauthConnected && gaId) {
    return `Google Analytics: connected, property ${gaId}${gaOAuthEmail ? ` (${gaOAuthEmail})` : ''}`
  }
  if (oauthConnected) {
    return 'Google Analytics: OAuth connected, property not selected'
  }
  if (gaPending) {
    return 'Google Analytics: sync pending'
  }
  return 'Google Analytics: not connected'
}

/** Thin posting reference for non-posting tabs (not full metrics). */
function postingThinLine(input: AnalyticsMayaInput): string {
  const { connectedPlatforms, dateRange, dataState } = input
  if (isPostingMock(input)) {
    if (dataState === 'mock') {
      return 'Social posting: SAMPLE / MOCK — demo mode (see Posting analytics tab for sample metrics)'
    }
    return 'Social posting: no accounts connected for posting yet'
  }
  return `Social posting: connected (${connectedPlatforms.join(', ')}) — see Posting analytics tab for ${dateRange} metrics`
}

function postingThinLineGaTab(input: AnalyticsMayaInput): string {
  const { connectedPlatforms } = input
  if (!connectedPlatforms.length) {
    return 'Social posting: no accounts connected for posting — unrelated to Google Analytics Traffic channels on this tab.'
  }
  return `Social accounts connected for posting (${connectedPlatforms.join(', ')}) — see Posting analytics tab. Unrelated to Google Analytics Traffic channels on this tab.`
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
    `${VOICE_RULE} User is on Inbox analytics. Only the date range filter is interactive. Charts and stat cards are read-only — interpret metrics in chat; do not tell the user to click charts. Reply management is not available in-app yet.`,
  ga:
    `${VOICE_RULE} User is on the Google analytics tab inside Agent7even — not analytics.google.com. UI RULES: (1) KPI cards, traffic charts, Traffic channels, Top pages, Countries, and Devices are read-only displays — nothing is clickable and there is no drill-down. (2) The ONLY interactive control on this tab is the date range dropdown (e.g. Last 30 days). (3) Answer by interpreting the ON-SCREEN SUMMARY below — quote numbers directly in your reply. (4) NEVER say click, tap, drill down, open, check the chart, look at the section, or filter. (5) METRIC RULE: Traffic channels are SESSION counts, not new-user counts. This dashboard does not show new users by channel. If asked where new users come from, give the new-users KPI total and describe session mix separately — never attribute channel session numbers to new users. (6) GA "Organic Social" = website sessions Google attributes to social referrals — NOT social post stats from the Posting analytics tab. If contrasting low Organic Social with Instagram, explain: connected for posting in Agent7even vs website click-through tracked in Google Analytics are separate — never name internal vendors. (7) Do not send them to analytics.google.com.`,
}

/** Tab-local headline for activeView.state (foreground); page metrics stay in background. */
function buildAnalyticsActiveViewState(input: AnalyticsMayaInput): string {
  const {
    activeTab,
    dateRange,
    gaData,
    oauthConnected,
    gaId,
    gaPending,
    postingData,
    connectedPlatforms,
    inboxData,
  } = input

  if (activeTab === 'posting') {
    if (isPostingMock(input)) {
      const s = MOCK_POSTING_ANALYTICS.stats
      return `SAMPLE / MOCK — engagement ${s.engagementRate}%, reach ${fmtNum(s.totalReach)} (${s.reachDelta}), followers ${fmtNum(s.totalFollowers)} (${s.followersDelta}); best post on ${s.bestPost.platform} (${s.bestPost.engagements} engagements)`
    }
    if (!connectedPlatforms.length) {
      return 'No social accounts connected for posting yet'
    }
    const s = postingData.stats
    return `Engagement ${s.engagementRate}%, reach ${fmtNum(s.totalReach)} (${s.reachDelta}), followers ${fmtNum(s.totalFollowers)} (${s.followersDelta}), ${s.postsThisPeriod} posts; best: "${truncate(s.bestPost.caption, 45)}" on ${s.bestPost.platform}`
  }

  if (activeTab === 'inbox') {
    if (isInboxMock(input)) {
      const inbox = MOCK_ANALYTICS_INBOX
      return `SAMPLE / MOCK — ${inbox.totalComments} comments, ${inbox.totalDMs} DMs, ${inbox.responseRate}% response rate (${dateRange})`
    }
    if (!connectedPlatforms.length) {
      return 'No social accounts connected for inbox analytics yet'
    }
    return `${inboxData.totalComments} comments, ${inboxData.totalDMs} DMs, ${inboxData.responseRate}% response rate (${dateRange})`
  }

  if (activeTab === 'ga') {
    if (isGaMock(input)) {
      const s = MOCK_GA_DATA.summary
      const top = MOCK_GA_DATA.trafficSources[0]
      return `SAMPLE / MOCK — ${s.sessions.toLocaleString()} sessions, ${s.users.toLocaleString()} users, bounce ${s.bounceRate}%; top channel ${top?.source ?? 'n/a'} (${dateRange})`
    }
    if (gaPending && !gaData) {
      return 'GA sync in progress'
    }
    if (!oauthConnected || !gaId) {
      return 'GA not connected — connect to read website analytics'
    }
    if (gaData) {
      const s = gaData.summary
      const top = gaData.channels?.[0]
      return `${s.sessions.toLocaleString()} sessions, ${s.users.toLocaleString()} users, bounce ${s.bounceRate}%; top channel ${top?.channel ?? 'n/a'} (${top?.sessions ?? 0} sessions) — ${dateRange}`
    }
    return 'GA not connected — connect to read website analytics'
  }

  return dateRange
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
    inboxData,
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

  if (activeTab === 'posting') {
    if (isPostingMock(input)) {
      metrics.push(
        'POSTING DATA: SAMPLE / MOCK — demo posting metrics until social accounts are connected.',
      )
      metrics.push(...summarizePosting(MOCK_POSTING_ANALYTICS, dateRange))
    } else if (connectedPlatforms.length) {
      metrics.push(...summarizePosting(postingData, dateRange))
    } else {
      metrics.push('Posting: no social accounts connected yet')
    }
    metrics.push(gaStatusLine(input))
  } else if (activeTab === 'inbox') {
    if (isInboxMock(input)) {
      metrics.push('INBOX DATA: SAMPLE / MOCK — demo inbox metrics until social accounts are connected.')
      metrics.push(...summarizeInbox(MOCK_ANALYTICS_INBOX, dateRange))
    } else if (connectedPlatforms.length) {
      metrics.push(...summarizeInbox(inboxData, dateRange))
    } else {
      metrics.push('Inbox: no social accounts connected yet')
    }
    metrics.push(postingThinLine(input))
    metrics.push(gaStatusLine(input))
  } else if (activeTab === 'ga') {
    metrics.push(
      `Active filter: date range ${dateRange} (only interactive control on this tab). All charts below are read-only.`,
    )
    if (isGaMock(input)) {
      metrics.push('GA DATA: SAMPLE / MOCK — demo website analytics until a property is connected.')
      metrics.push(...summarizeGaFromMock(dateRange))
    } else if (gaData) {
      metrics.push(...summarizeGa(gaData, dateRange))
    } else if (gaPending) {
      metrics.push('Google Analytics: data sync in progress')
    } else if (!oauthConnected || !gaId) {
      metrics.push('Google Analytics: connect a property to see website analytics')
    }
    metrics.push(postingThinLineGaTab(input))
    metrics.push(
      'Google Analytics "Organic Social" = website visits from social click-through — not post reach/engagement and not whether Instagram is connected for posting in Agent7even.',
    )
  }

  return {
    page: 'ANALYTICS PAGE',
    dataSource,
    company: companyName || undefined,
    activeView: {
      label: TAB_LABELS[activeTab],
      state: buildAnalyticsActiveViewState(input),
    },
    connections,
    metrics,
    affordance: TAB_AFFORDANCE[activeTab],
  }
}
