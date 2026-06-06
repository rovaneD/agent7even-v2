'use client'

import { useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Users, Eye, MessageCircle,
  DollarSign, MousePointerClick, ArrowUpRight, Sparkles,
  Globe, BarChart2, Inbox, LayoutGrid,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  MOCK_GA_DATA, MOCK_ANALYTICS_SOCIAL, MOCK_ANALYTICS_ADS, MOCK_ANALYTICS_INBOX,
} from '@/lib/analytics/mockData'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function fmtMoney(n: number) {
  return `$${n.toFixed(2)}`
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C',
  facebook:  '#1877F2',
  tiktok:    '#010101',
  meta_ads:  '#1877F2',
  google_ads:'#4285F4',
}

function PlatformDot({ id }: { id: string }) {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white uppercase flex-shrink-0"
      style={{ backgroundColor: PLATFORM_COLORS[id] ?? '#6B7280' }}
    >
      {id[0]}
    </span>
  )
}

function StatCard({
  label, value, change, changeLabel, icon: Icon, trend,
}: {
  label: string
  value: string
  change?: number
  changeLabel?: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
}) {
  const positive = trend === 'up'
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 text-xs font-medium ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
                {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                <span>{positive ? '+' : ''}{change}{changeLabel ?? '%'}</span>
              </div>
            )}
          </div>
          <div className="rounded-lg bg-muted p-2.5">
            <Icon size={16} className="text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Overview tab ───────────────────────────────────────────────────────────────

function OverviewTab() {
  const ga = MOCK_GA_DATA
  const social = MOCK_ANALYTICS_SOCIAL

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sessions"       value={fmt(ga.summary.sessions)}       change={8.4}   icon={Globe}           trend="up" />
        <StatCard label="Followers"      value={fmt(social.overview.totalFollowers)} change={social.overview.followerGrowthPct} icon={Users} trend="up" />
        <StatCard label="Reach"          value={fmt(social.overview.totalReach)} change={12.1}  icon={Eye}             trend="up" />
        <StatCard label="Engagement"     value={`${social.overview.engagementRate}%`} change={0.4} icon={MessageCircle} trend="up" />
      </div>

      {/* Session chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Website sessions</CardTitle>
              <CardDescription className="text-xs">Last 7 days — from Google Analytics</CardDescription>
            </div>
            <Badge variant="secondary" className="text-[10px]">Demo</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={ga.chartData}>
              <defs>
                <linearGradient id="sessGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={36} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Area type="monotone" dataKey="sessions" stroke="#3B82F6" strokeWidth={2} fill="url(#sessGrad)" />
              <Area type="monotone" dataKey="users" stroke="#10B981" strokeWidth={2} fill="none" strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded bg-blue-500 opacity-60" /> Sessions</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-px w-4 border-t-2 border-dashed border-emerald-500" /> Users</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top pages */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top pages</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs pl-6">Page</TableHead>
                  <TableHead className="text-xs text-right pr-6">Sessions</TableHead>
                  <TableHead className="text-xs text-right pr-6">Bounce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ga.topPages.map(p => (
                  <TableRow key={p.path}>
                    <TableCell className="pl-6 font-mono text-xs">{p.path}</TableCell>
                    <TableCell className="text-right pr-6 text-sm font-medium">{p.sessions}</TableCell>
                    <TableCell className="text-right pr-6 text-xs text-muted-foreground">{p.bounceRate}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Traffic sources */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Traffic sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            {ga.trafficSources.map(s => (
              <div key={s.source} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{s.source}</span>
                  <span className="font-medium">{s.pct}%</span>
                </div>
                <Progress value={s.pct} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Maya briefing placeholder */}
      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 py-4">
          <div className="rounded-lg bg-blue-50 p-2.5">
            <Sparkles size={16} className="text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Maya Performance Briefing</p>
            <p className="text-xs text-muted-foreground">AI summary of this period's highlights and recommended next steps.</p>
          </div>
          <Badge variant="outline" className="text-xs">Coming Phase 2</Badge>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Social tab ─────────────────────────────────────────────────────────────────

function SocialTab() {
  const s = MOCK_ANALYTICS_SOCIAL

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total followers"  value={fmt(s.overview.totalFollowers)}  change={s.overview.followerGrowthPct}  icon={Users}         trend="up" />
        <StatCard label="Net new"          value={`+${s.overview.followerGrowth}`} change={undefined}                     icon={ArrowUpRight}  />
        <StatCard label="Total reach"      value={fmt(s.overview.totalReach)}      change={12.1}                          icon={Eye}           trend="up" />
        <StatCard label="Engagement rate"  value={`${s.overview.engagementRate}%`} change={0.4}                           icon={MessageCircle} trend="up" />
      </div>

      {/* Platform breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Object.entries(s.platforms).map(([id, data]) => (
          <Card key={id}>
            <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
              <PlatformDot id={id} />
              <CardTitle className="text-sm capitalize">{id}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Followers</span>
                <span className="font-semibold">{fmt(data.followers)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Reach</span>
                <span className="font-semibold">{fmt(data.reach)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Eng. rate</span>
                <span className="font-semibold">{data.engagementRate}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Posts</span>
                <span className="font-semibold">{data.posts}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Follower growth chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Follower growth</CardTitle>
            <Badge variant="secondary" className="text-[10px]">Demo</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={s.followerHistory}>
              <defs>
                <linearGradient id="follGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8B5CF6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Area type="monotone" dataKey="followers" stroke="#8B5CF6" strokeWidth={2} fill="url(#follGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top posts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top posts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs pl-6">Platform</TableHead>
                <TableHead className="text-xs">Content</TableHead>
                <TableHead className="text-xs text-right">Reach</TableHead>
                <TableHead className="text-xs text-right pr-6">Eng.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.topPosts.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-6"><PlatformDot id={p.platform} /></TableCell>
                  <TableCell className="text-xs max-w-[220px] truncate">{p.content}</TableCell>
                  <TableCell className="text-right text-xs font-medium">{fmt(p.reach)}</TableCell>
                  <TableCell className="text-right pr-6 text-xs text-emerald-600 font-medium">{p.engagementRate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Best time */}
      <Card className="border-blue-100 bg-blue-50/50">
        <CardContent className="py-4 flex items-center gap-4">
          <div className="rounded-full bg-blue-100 p-2.5">
            <Sparkles size={15} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900">Best time to post</p>
            <p className="text-xs text-blue-700">{s.bestTimeToPost.day} at {s.bestTimeToPost.hour} — avg {fmt(s.bestTimeToPost.avgEngagement)} engagements</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Ads tab ────────────────────────────────────────────────────────────────────

function AdsTab() {
  const a = MOCK_ANALYTICS_ADS

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total spend"  value={fmtMoney(a.overview.totalSpend)}  icon={DollarSign}        />
        <StatCard label="Total reach"  value={fmt(a.overview.totalReach)}        change={9.2}   icon={Eye}             trend="up" />
        <StatCard label="Total clicks" value={fmt(a.overview.totalClicks)}       change={5.8}   icon={MousePointerClick} trend="up" />
        <StatCard label="Avg CTR"      value={`${a.overview.avgCTR}%`}           change={-0.08} icon={TrendingDown}    trend="down" changeLabel="pp" />
      </div>

      {/* Platform breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Object.entries(a.platforms).map(([id, data]) => (
          <Card key={id}>
            <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
              <PlatformDot id={id} />
              <CardTitle className="text-sm">{id === 'meta_ads' ? 'Meta Ads' : 'Google Ads'}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 pt-0">
              {[
                { label: 'Spend',  value: fmtMoney(data.spend) },
                { label: 'Reach',  value: fmt(data.reach) },
                { label: 'Clicks', value: fmt(data.clicks) },
                { label: 'CTR',    value: `${data.ctr}%` },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                  <p className="text-sm font-semibold">{item.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Spend over time</CardTitle>
              <Badge variant="secondary" className="text-[10px]">Demo</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={a.spendOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Spend']} />
                <Bar dataKey="spend" fill="#3B82F6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">CTR trend</CardTitle>
              <Badge variant="secondary" className="text-[10px]">Demo</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={a.ctrTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={36} domain={[1.4, 2.0]} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${v}%`, 'CTR']} />
                <Line type="monotone" dataKey="ctr" stroke="#10B981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Active campaigns</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs pl-6">Campaign</TableHead>
                <TableHead className="text-xs text-right">Spend</TableHead>
                <TableHead className="text-xs text-right">Reach</TableHead>
                <TableHead className="text-xs text-right">Clicks</TableHead>
                <TableHead className="text-xs text-right pr-6">CTR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.campaigns.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-2">
                      <PlatformDot id={c.platform} />
                      <span className="text-xs">{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium">{fmtMoney(c.spend)}</TableCell>
                  <TableCell className="text-right text-xs">{fmt(c.reach)}</TableCell>
                  <TableCell className="text-right text-xs">{c.clicks}</TableCell>
                  <TableCell className="text-right pr-6 text-xs font-medium">{c.ctr}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Inbox tab ──────────────────────────────────────────────────────────────────

function InboxTab() {
  const inbox = MOCK_ANALYTICS_INBOX

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Comments"      value={String(inbox.totalComments)} change={14}  icon={MessageCircle} trend="up" />
        <StatCard label="DMs"           value={String(inbox.totalDMs)}      change={8.7} icon={Inbox}         trend="up" />
        <StatCard label="Response rate" value={`${inbox.responseRate}%`}    change={3.1} icon={TrendingUp}    trend="up" />
        <StatCard label="Total messages" value={String(inbox.totalComments + inbox.totalDMs)} icon={LayoutGrid} />
      </div>

      {/* Per-platform breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {inbox.platforms.map(p => (
          <Card key={p.platform}>
            <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
              <PlatformDot id={p.platform} />
              <CardTitle className="text-sm capitalize">{p.platform}</CardTitle>
              {p.unread > 0 && (
                <Badge className="ml-auto text-[10px] bg-red-500 hover:bg-red-500">{p.unread} unread</Badge>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 pt-0">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Comments</p>
                <p className="text-lg font-bold">{p.comments}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">DMs</p>
                <p className="text-lg font-bold">{p.dms}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Message volume — last 7 days</CardTitle>
            <Badge variant="secondary" className="text-[10px]">Demo</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={inbox.trend} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="comments" name="Comments" fill="#3B82F6" radius={[3, 3, 0, 0]} stackId="a" />
              <Bar dataKey="dms"      name="DMs"      fill="#8B5CF6" radius={[3, 3, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" /> Comments</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-500" /> DMs</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function LabAnalyticsPage() {
  const [range, setRange] = useState<'7d' | '30d'>('30d')

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold">Analytics</h1>
            <p className="text-xs text-muted-foreground">Acme Co — shadcn/ui lab</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[11px] text-amber-600 border-amber-200 bg-amber-50">
              Demo data
            </Badge>
            <div className="flex rounded-md border text-xs overflow-hidden">
              {(['7d', '30d'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    range === r ? 'bg-foreground text-background' : 'hover:bg-muted'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-6">
        <Tabs defaultValue="overview">
          <TabsList className="mb-6 h-9">
            <TabsTrigger value="overview" className="gap-1.5 text-xs">
              <LayoutGrid size={13} /> Overview
            </TabsTrigger>
            <TabsTrigger value="social" className="gap-1.5 text-xs">
              <Users size={13} /> Social
            </TabsTrigger>
            <TabsTrigger value="ads" className="gap-1.5 text-xs">
              <BarChart2 size={13} /> Ads
            </TabsTrigger>
            <TabsTrigger value="inbox" className="gap-1.5 text-xs">
              <Inbox size={13} /> Inbox
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="social"><SocialTab /></TabsContent>
          <TabsContent value="ads"><AdsTab /></TabsContent>
          <TabsContent value="inbox"><InboxTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
