'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ZAxis,
} from 'recharts'
import {
  Globe, X, CheckCircle, ChevronDown, ChevronUp, Sparkles,
  Plus, ArrowUpRight, ArrowDownRight, Eye, Users, FileText,
  ExternalLink, Info,
} from 'lucide-react'
import type { AnalyticsDataState } from './page'
import {
  MOCK_ANALYTICS_INBOX, MOCK_POSTING_ANALYTICS,
} from '@/lib/analytics/mockData'

// ── Types ─────────────────────────────────────────────────────────────────────

type PostingTab = 'posting' | 'inbox'
type DateRange = '7d' | '30d' | '90d' | '6m' | '1y'

interface Props {
  companyName: string
  plan: string
  dataState: AnalyticsDataState
  gaMeasurementId: string | null
  gaOAuthConnected: boolean
  gaOAuthEmail: string | null
  zernioConnectedPlatforms: string[]
}

interface GaData {
  chartData: { day: string; sessions: number; users: number }[]
  summary: { sessions: number; users: number; pageviews: number; bounceRate: string }
}

interface GAProperty { id: string; name: string; account?: string }

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return `${n}`
}

// ── Platform metadata ──────────────────────────────────────────────────────────

const PLATFORM_META: Record<string, { label: string; color: string; bgColor: string }> = {
  instagram:       { label: 'Instagram',       color: '#E1306C', bgColor: '#FCE4EC' },
  facebook:        { label: 'Facebook',         color: '#1877F2', bgColor: '#E3F2FD' },
  tiktok:          { label: 'TikTok',           color: '#333',    bgColor: '#F5F5F5' },
  linkedin:        { label: 'LinkedIn',         color: '#0A66C2', bgColor: '#E8F4FD' },
  youtube:         { label: 'YouTube',          color: '#FF0000', bgColor: '#FFEBEE' },
  x:               { label: 'X / Twitter',      color: '#111',    bgColor: '#F5F5F5' },
  threads:         { label: 'Threads',          color: '#111',    bgColor: '#F5F5F5' },
  bluesky:         { label: 'Bluesky',          color: '#0085FF', bgColor: '#E3F2FD' },
  pinterest:       { label: 'Pinterest',        color: '#E60023', bgColor: '#FFEBEE' },
  reddit:          { label: 'Reddit',           color: '#FF4500', bgColor: '#FFF3E0' },
  google_business: { label: 'Google Business',  color: '#4285F4', bgColor: '#E8F0FE' },
}

const ALL_PLATFORMS = [
  'instagram', 'facebook', 'tiktok', 'linkedin', 'youtube',
  'x', 'threads', 'pinterest', 'reddit', 'bluesky', 'google_business',
]

// ── Engagement metrics config ──────────────────────────────────────────────────

const ENG_METRICS = [
  { key: 'likes',       label: 'Likes',       color: '#3B82F6', icon: '♥'   },
  { key: 'comments',    label: 'Comments',    color: '#10B981', icon: '💬'  },
  { key: 'shares',      label: 'Shares',      color: '#8B5CF6', icon: '↗'   },
  { key: 'saves',       label: 'Saves',       color: '#F59E0B', icon: '🔖'  },
  { key: 'views',       label: 'Views',       color: '#06B6D4', icon: '👁'  },
  { key: 'impressions', label: 'Impressions', color: '#64748B', icon: '↗'   },
  { key: 'reach',       label: 'Reach',       color: '#14B8A6', icon: '👥'  },
  { key: 'clicks',      label: 'Clicks',      color: '#F97316', icon: '🖱'  },
] as const

type MetricKey = typeof ENG_METRICS[number]['key']
const DEFAULT_ACTIVE_METRICS: Set<MetricKey> = new Set(['likes', 'comments', 'views', 'impressions', 'reach'])

// ── Heatmap color helper ───────────────────────────────────────────────────────

function heatmapColor(value: number, maxValue: number): string {
  if (value === 0) return '#F3F4F6'
  const t = value / maxValue
  const r = Math.round(0xE0 + (0x10 - 0xE0) * t)
  const g = Math.round(0xF7 + (0xB9 - 0xF7) * t)
  const b = Math.round(0xED + (0x81 - 0xED) * t)
  return `rgb(${r},${g},${b})`
}

// ── Shared UI atoms ────────────────────────────────────────────────────────────

function DemoDot() {
  return (
    <span
      className="absolute top-3 right-3 w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: '#F59E0B' }}
      title="Demo data"
    />
  )
}

function DemoChip() {
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded"
      style={{ background: '#FEF3C7', color: '#92400E' }}>
      Demo data
    </span>
  )
}

function AmberBanner() {
  return (
    <div className="flex items-center justify-between px-6 py-3 rounded-xl mb-4"
      style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
      <p className="text-[12px] font-medium" style={{ color: '#92400E' }}>
        <span className="font-semibold">Demo data only</span> — this is not your real
        performance. Connect your accounts on a paid plan to see live data.
      </p>
      <a href="/dashboard/billing" className="text-[12px] font-semibold text-[#3B82F6] hover:underline flex-shrink-0 ml-4">
        View plans →
      </a>
    </div>
  )
}

function UpgradeCard() {
  return (
    <div className="rounded-2xl border-[1.5px] border-[#BFDBFE] bg-white p-8 text-center mt-2">
      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
        <FileText size={20} className="text-[#3B82F6]" />
      </div>
      <h3 className="text-[16px] font-semibold text-text mb-2">See your real performance data</h3>
      <p className="text-sm text-text-sec leading-relaxed max-w-md mx-auto mb-4">
        Connect your social accounts to see actual followers, reach, engagement, and Maya's weekly briefing.
      </p>
      <div className="inline-flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-lg mb-5"
        style={{ background: '#FEF3C7', color: '#92400E' }}>
        <Info size={12} />
        Live data is available on paid plans only — not included in the free trial.
      </div>
      <div className="flex items-center justify-center gap-3">
        <a href="/dashboard/billing"
          className="bg-[#3B82F6] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#2563EB] transition-colors">
          Activate your plan →
        </a>
        <a href="/pricing"
          className="border border-gray-200 text-sm font-medium text-text-sec px-5 py-2.5 rounded-xl hover:border-gray-300 transition-colors">
          View plan options
        </a>
      </div>
    </div>
  )
}

// ── Platform Avatar ────────────────────────────────────────────────────────────

function PlatformAvatar({ id, size = 22 }: { id: string; size?: number }) {
  const meta = PLATFORM_META[id]
  const label = meta?.label ?? id
  const color = meta?.color ?? '#6B7280'
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.42 }}
      title={label}
    >
      {label[0].toUpperCase()}
    </div>
  )
}

// ── Filter Dropdown ────────────────────────────────────────────────────────────

interface DropdownOption { value: string; label: string }

function FilterDropdown({
  value, options, onChange, isMock, mayaSourceTooltip,
}: {
  value: string
  options: DropdownOption[]
  onChange: (v: string) => void
  isMock?: boolean
  mayaSourceTooltip?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find(o => o.value === value) ?? options[0]

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[12.5px] font-medium text-text-sec bg-white border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-colors whitespace-nowrap"
      >
        {current.label}
        <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[180px]">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                if (isMock && opt.value === 'maya' && mayaSourceTooltip) return
                onChange(opt.value)
                setOpen(false)
              }}
              className={`w-full text-left px-3.5 py-2 text-[12.5px] flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors ${value === opt.value ? 'text-[#3B82F6] font-medium' : 'text-text-sec'}`}
            >
              {opt.label}
              {isMock && opt.value === 'maya' && (
                <span className="text-[10px] text-amber-600">Paid plan</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Filter Bar ─────────────────────────────────────────────────────────────────

function FilterBar({
  platform, profile, source, dateRange, isMock,
  onPlatformChange, onSourceChange, onDateRangeChange,
}: {
  platform: string; profile: string; source: string; dateRange: DateRange; isMock: boolean
  onPlatformChange: (v: string) => void
  onSourceChange:   (v: string) => void
  onDateRangeChange:(v: DateRange) => void
}) {
  const platformOptions: DropdownOption[] = [
    { value: 'all',             label: 'All platforms' },
    { value: 'instagram',       label: 'Instagram'     },
    { value: 'tiktok',          label: 'TikTok'        },
    { value: 'facebook',        label: 'Facebook'      },
    { value: 'youtube',         label: 'YouTube'       },
    { value: 'linkedin',        label: 'LinkedIn'      },
    { value: 'x',               label: 'X / Twitter'   },
    { value: 'threads',         label: 'Threads'       },
    { value: 'pinterest',       label: 'Pinterest'     },
    { value: 'reddit',          label: 'Reddit'        },
    { value: 'bluesky',         label: 'Bluesky'       },
    { value: 'google_business', label: 'GBP'           },
  ]

  const sourceOptions: DropdownOption[] = [
    { value: 'all',  label: 'All sources'     },
    { value: 'maya', label: 'Posted via Maya' },
  ]

  const dateOptions: DropdownOption[] = [
    { value: '7d',  label: 'Last 7 days'   },
    { value: '30d', label: 'Last 30 days'  },
    { value: '90d', label: 'Last 90 days'  },
    { value: '6m',  label: 'Last 6 months' },
    { value: '1y',  label: 'Last year'     },
  ]

  const currentPlatformLabel = platform === 'all'
    ? 'All platforms'
    : PLATFORM_META[platform]?.label ?? platform

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      {/* Platform */}
      <FilterDropdown
        value={platform}
        options={platformOptions}
        onChange={onPlatformChange}
        isMock={isMock}
      />

      {/* Profile (static in demo) */}
      <button className="flex items-center gap-1.5 text-[12.5px] font-medium text-text-sec bg-white border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-colors">
        {isMock ? 'Demo Profile' : 'Default'}
        <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />
      </button>

      {/* Source */}
      <FilterDropdown
        value={source}
        options={sourceOptions}
        onChange={onSourceChange}
        isMock={isMock}
        mayaSourceTooltip
      />

      {/* Date range */}
      <FilterDropdown
        value={dateRange}
        options={dateOptions}
        onChange={v => onDateRangeChange(v as DateRange)}
        isMock={isMock}
      />

      {/* Last sync */}
      <span className="ml-auto text-[11px] text-text-soft whitespace-nowrap">
        {isMock ? 'Demo mode' : `Last sync: just now`}
      </span>
    </div>
  )
}

// ── Maya Briefing Card ─────────────────────────────────────────────────────────

function MayaBriefingCard({ isMock }: { isMock: boolean }) {
  const [open, setOpen] = useState(true)
  const [generated, setGenerated] = useState(false)

  return (
    <div className="rounded-2xl bg-white border border-gray-100 mb-4 overflow-hidden"
      style={{ borderLeft: '3px solid #3B82F6' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[10px] font-bold">M</span>
          </div>
          <span className="text-[13px] font-semibold text-text">Maya's briefing</span>
          {isMock && (
            <span className="text-[10px] px-2 py-0.5 rounded font-medium"
              style={{ background: '#FEF3C7', color: '#92400E' }}>
              Demo
            </span>
          )}
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1">
          {!generated ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] text-text-sec">
                  Maya hasn&apos;t analyzed this period yet.
                </p>
                <p className="text-[11px] text-text-soft mt-1">~15 seconds · 2 credits</p>
              </div>
              <button
                onClick={() => !isMock && setGenerated(true)}
                disabled={isMock}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-[#3B82F6] px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 hover:bg-[#2563EB] transition-colors"
                title={isMock ? 'Available on paid plans' : undefined}
              >
                <Sparkles size={12} /> Generate briefing
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[13px] text-text-sec leading-relaxed">
                Your Instagram engagement rate is up 0.4pts this period, driven primarily by the
                &ldquo;Behind the scenes&rdquo; post. TikTok is your highest-ER platform at 5.1% despite
                lower follower count — it deserves more posting frequency.
              </p>
              <div className="space-y-2">
                {[
                  'Post on TikTok 2× this week to capitalize on its 5.1% engagement rate.',
                  'Tuesday and Friday 9pm are your peak engagement windows — schedule accordingly.',
                  'Facebook CTR is healthy at 2.1% — consider boosting this week\'s post.',
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-[12px] text-text-sec">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] flex-shrink-0 mt-1.5" />
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Chart card wrapper ─────────────────────────────────────────────────────────

function ChartCard({
  title, subtitle, right, children, isMock, fullWidth,
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
  children: React.ReactNode
  isMock?: boolean
  fullWidth?: boolean
}) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white overflow-hidden ${fullWidth ? 'col-span-2' : ''}`}>
      <div className="px-5 py-4 border-b border-gray-50 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-text">{title}</span>
            {isMock && <DemoChip />}
          </div>
          {subtitle && <p className="text-[11px] text-text-soft mt-0.5">{subtitle}</p>}
        </div>
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
      {children}
    </div>
  )
}

// ── Stat Cards (5) ─────────────────────────────────────────────────────────────

function StatCards({ isMock }: { isMock: boolean }) {
  const s = MOCK_POSTING_ANALYTICS.stats

  const cards = [
    {
      label: 'Engagement rate',
      value: `${s.engagementRate}%`,
      delta: s.engRateDelta,
      deltaPos: s.engRateDeltaPositive,
    },
    {
      label: 'Total reach',
      value: fmt(s.totalReach),
      icon: <Eye size={14} />,
      delta: s.reachDelta,
      deltaPos: s.reachDeltaPositive,
    },
    {
      label: 'Total followers',
      value: fmt(s.totalFollowers),
      icon: <Users size={14} />,
      delta: s.followersDelta,
      deltaPos: s.followersDeltaPositive,
    },
    {
      label: 'Posts this period',
      value: `${s.postsThisPeriod}`,
      icon: <FileText size={14} />,
    },
    {
      label: 'Best post',
      isBestPost: true,
    },
  ]

  return (
    <div className="grid grid-cols-5 gap-3 mb-5">
      {cards.map((c, i) => (
        <div key={i} className="relative bg-white rounded-2xl border border-gray-100 p-4">
          {isMock && <DemoDot />}
          <p className="text-[11px] font-medium text-text-soft uppercase tracking-wide mb-2">{c.label ?? 'Best post'}</p>

          {c.isBestPost ? (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <PlatformAvatar id={s.bestPost.platform} size={20} />
                </div>
                <span className="text-[24px] font-[500] text-text leading-none">{s.bestPost.engagements}</span>
              </div>
              <p className="text-[11px] text-text-soft truncate">{s.bestPost.caption}</p>
              <a href="#" className="text-[11px] text-[#3B82F6] font-medium mt-1 inline-flex items-center gap-0.5 hover:underline">
                View <ExternalLink size={10} />
              </a>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                {c.icon && <span className="text-text-soft">{c.icon}</span>}
                <span className="text-[26px] font-[500] text-text leading-none">{c.value}</span>
              </div>
              {c.delta && (
                <span className={`flex items-center gap-0.5 text-[11px] font-medium ${c.deltaPos ? 'text-emerald-600' : 'text-red-500'}`}>
                  {c.deltaPos ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {c.delta}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Posts Per Platform ─────────────────────────────────────────────────────────

function PostsPerPlatformChart({ isMock }: { isMock: boolean }) {
  const data = MOCK_POSTING_ANALYTICS.platformPosts
  const total = data.reduce((s, d) => s + d.posts, 0)

  return (
    <ChartCard
      title="Posts per platform"
      subtitle="Top 1 by post count in this window"
      right={<span className="text-[11px] text-text-soft font-medium">{total} posts total</span>}
      isMock={isMock}
    >
      <div className="px-4 pt-4 pb-3">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} barSize={36}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9BA1AE' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #f0f0f0' }} cursor={{ fill: '#f9fafb' }} />
            <Bar dataKey="posts" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

// ── Posts Over Time ────────────────────────────────────────────────────────────

function PostsOverTimeChart({ isMock }: { isMock: boolean }) {
  const data = MOCK_POSTING_ANALYTICS.monthly
  const total = data.reduce((s, d) => s + d.posts, 0)

  return (
    <ChartCard
      title="Posts over time"
      subtitle="Posts per month · last 365 days"
      right={<span className="text-[11px] text-text-soft font-medium">{total} posts total</span>}
      isMock={isMock}
    >
      <div className="px-4 pt-4 pb-3">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} interval={1} />
            <YAxis tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={22} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #f0f0f0' }} cursor={{ fill: '#f9fafb' }} />
            <Bar dataKey="posts" fill="#3B82F6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

// ── Likes Per Platform ─────────────────────────────────────────────────────────

function LikesPerPlatformChart({ isMock }: { isMock: boolean }) {
  const data = MOCK_POSTING_ANALYTICS.platformLikes
  const total = data.reduce((s, d) => s + d.likes, 0)

  return (
    <ChartCard
      title="Likes per platform"
      subtitle="Top 1 platforms by likes in this window"
      right={<span className="text-[11px] text-text-soft font-medium">{fmt(total)} likes total</span>}
      isMock={isMock}
    >
      <div className="px-4 pt-4 pb-3">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} barSize={36}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9BA1AE' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={36} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #f0f0f0' }} cursor={{ fill: '#f9fafb' }} />
            <Bar dataKey="likes" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

// ── Likes Over Time ────────────────────────────────────────────────────────────

function LikesOverTimeChart({ isMock }: { isMock: boolean }) {
  const data = MOCK_POSTING_ANALYTICS.monthly
  const total = data.reduce((s, d) => s + d.likes, 0)

  return (
    <ChartCard
      title="Likes over time"
      subtitle="Likes per month · last 365 days"
      right={<span className="text-[11px] text-text-soft font-medium">{fmt(total)} likes total</span>}
      isMock={isMock}
    >
      <div className="px-4 pt-4 pb-3">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} interval={1} />
            <YAxis tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={36} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #f0f0f0' }} cursor={{ fill: '#f9fafb' }} />
            <Bar dataKey="likes" fill="#3B82F6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

// ── Engagement Over Time (full width) ─────────────────────────────────────────

function EngagementOverTimeChart({ isMock }: { isMock: boolean }) {
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(
    new Set(DEFAULT_ACTIVE_METRICS)
  )
  const data = MOCK_POSTING_ANALYTICS.monthly

  const toggle = (key: MetricKey) => {
    setActiveMetrics(prev => {
      const next = new Set(prev)
      if (next.has(key)) { if (next.size > 1) next.delete(key) }
      else next.add(key)
      return next
    })
  }

  const totals = ENG_METRICS.reduce((acc, m) => {
    acc[m.key] = data.reduce((s, d) => s + (d[m.key as keyof typeof d] as number ?? 0), 0)
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden col-span-2">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
        <span className="text-[13px] font-semibold text-text">Engagement over time</span>
        {isMock && <DemoChip />}
        <span className="text-[11px] text-text-soft ml-1">Per month · last 365 days</span>
      </div>
      <div className="flex">
        {/* Chart */}
        <div className="flex-1 min-w-0 px-4 pt-4 pb-3">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} interval={1} />
              <YAxis tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={36} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f0f0f0' }} />
              {ENG_METRICS.filter(m => activeMetrics.has(m.key)).map(m => (
                <Line
                  key={m.key}
                  type="monotone"
                  dataKey={m.key}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={false}
                  name={m.label}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Legend panel */}
        <div className="w-52 flex-shrink-0 border-l border-gray-50 py-4 px-4 overflow-y-auto">
          <div className="space-y-3">
            {ENG_METRICS.map(m => {
              const active = activeMetrics.has(m.key)
              return (
                <button
                  key={m.key}
                  onClick={() => toggle(m.key)}
                  className="w-full flex items-center justify-between gap-2 group"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        borderColor: active ? m.color : '#D1D5DB',
                        background: active ? m.color : 'transparent',
                      }}
                    >
                      {active && <span className="text-white text-[8px] leading-none">✓</span>}
                    </div>
                    <span className={`text-[11px] ${active ? 'text-text font-medium' : 'text-text-soft'}`}>
                      {m.icon} {m.label}
                    </span>
                  </div>
                  <span className={`text-[12px] font-semibold ${active ? 'text-text' : 'text-text-soft'}`}>
                    {fmt(totals[m.key])}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Best Time to Post Heatmap ──────────────────────────────────────────────────

function BestTimeToPostHeatmap({ isMock }: { isMock: boolean }) {
  const { days, times, data, bestDay, bestTime } = MOCK_POSTING_ANALYTICS.heatmap
  const allValues = data.flat()
  const maxVal = Math.max(...allValues, 1)

  return (
    <ChartCard
      title="Best Time to Post"
      right={
        <div className="flex items-center gap-1.5 text-[10.5px] text-text-soft">
          <span>Less</span>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map(t => (
            <div
              key={t}
              className="w-3 h-3 rounded-sm"
              style={{ background: heatmapColor(t * maxVal, maxVal) }}
            />
          ))}
          <span>More</span>
        </div>
      }
      isMock={isMock}
    >
      <div className="px-4 pt-3 pb-4">
        {/* Grid */}
        <div className="flex gap-1">
          {/* Day labels */}
          <div className="flex flex-col gap-1 pr-1">
            <div className="h-5" />
            {days.map(d => (
              <div key={d} className="h-5 flex items-center text-[10px] text-text-soft w-7">{d}</div>
            ))}
          </div>
          {/* Cells */}
          <div className="flex-1 min-w-0">
            {/* Time labels */}
            <div className="grid mb-1" style={{ gridTemplateColumns: `repeat(${times.length}, 1fr)` }}>
              {times.map(t => (
                <div key={t} className="text-[9px] text-text-soft text-center leading-5">{t}</div>
              ))}
            </div>
            {/* Heatmap rows */}
            {data.map((row, di) => (
              <div key={di} className="grid gap-1 mb-1" style={{ gridTemplateColumns: `repeat(${times.length}, 1fr)` }}>
                {row.map((val, ti) => (
                  <div
                    key={ti}
                    className="h-5 rounded-sm"
                    style={{ background: heatmapColor(val, maxVal) }}
                    title={`${days[di]} ${times[ti]}: ${val}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        {/* Best times label */}
        <div className="flex items-center gap-1.5 mt-3 text-[11px] text-text-sec">
          <span className="font-medium">Best times:</span>
          <span
            className="flex items-center gap-1 font-semibold px-2 py-0.5 rounded text-[10px]"
            style={{ background: '#D1FAE5', color: '#065F46' }}
          >
            {bestDay} {bestTime}
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          </span>
        </div>
      </div>
    </ChartCard>
  )
}

// ── Follower Evolution ─────────────────────────────────────────────────────────

function FollowerEvolutionChart({ isMock }: { isMock: boolean }) {
  const data = MOCK_POSTING_ANALYTICS.followerEvolution
  const total = data[data.length - 1]?.followers ?? 0

  return (
    <ChartCard
      title="Follower evolution"
      subtitle="Followers per account · top 1"
      right={<span className="text-[11px] text-text-soft font-medium">{fmt(total)} followers total</span>}
      isMock={isMock}
    >
      <div className="px-4 pt-4 pb-3">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} interval={2} />
            <YAxis
              tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={40}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f0f0f0' }}
              formatter={(v: unknown) => [fmt(Number(v ?? 0)), 'Followers']}
            />
            <Line type="monotone" dataKey="followers" stroke="#3B82F6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

// ── Platform Breakdown Table ───────────────────────────────────────────────────

function PlatformBreakdownTable({ isMock }: { isMock: boolean }) {
  const data = MOCK_POSTING_ANALYTICS.platformBreakdown
  const cols = ['Platform', 'Posts', 'Likes', 'Comments', 'Shares', 'Saves', 'Clicks', 'Views', 'Impressions', 'Reach', 'ER%']

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden col-span-2">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
        <span className="text-[13px] font-semibold text-text">Platform Breakdown</span>
        {isMock && <DemoChip />}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-50">
              {cols.map(c => (
                <th key={c} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <PlatformAvatar id={row.platform} size={20} />
                    <span className="text-[12px] font-medium text-text">{row.label}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[12px] text-text">{row.posts}</td>
                <td className="px-4 py-3 text-[12px] text-text">{fmt(row.likes)}</td>
                <td className="px-4 py-3 text-[12px] text-text">{row.comments}</td>
                <td className="px-4 py-3 text-[12px] text-text">{row.shares}</td>
                <td className="px-4 py-3 text-[12px] text-text">{row.saves || '—'}</td>
                <td className="px-4 py-3 text-[12px] text-text">{row.clicks || '—'}</td>
                <td className="px-4 py-3 text-[12px] text-text">{fmt(row.views)}</td>
                <td className="px-4 py-3 text-[12px] text-text">{fmt(row.impressions)}</td>
                <td className="px-4 py-3 text-[12px] text-text">{fmt(row.reach)}</td>
                <td className="px-4 py-3">
                  <span className="text-[11px] font-semibold text-emerald-600">{row.erPct}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Top Performing Posts Table ─────────────────────────────────────────────────

function TopPerformingPostsTable({ isMock }: { isMock: boolean }) {
  const data = MOCK_POSTING_ANALYTICS.topPosts
  const metaCols = [
    { key: 'likes',       label: 'Likes',       color: '#3B82F6' },
    { key: 'comments',    label: 'Comments',    color: '#10B981' },
    { key: 'shares',      label: 'Shares',      color: '#8B5CF6' },
    { key: 'saves',       label: 'Saves',       color: '#F59E0B' },
    { key: 'clicks',      label: 'Clicks',      color: '#F97316' },
    { key: 'views',       label: 'Views',       color: '#06B6D4' },
    { key: 'impressions', label: 'Impressions', color: '#64748B' },
    { key: 'reach',       label: 'Reach',       color: '#14B8A6' },
    { key: 'erPct',       label: 'ER%',         color: '#10B981' },
  ]

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden col-span-2">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
        <span className="text-[13px] font-semibold text-text">Top Performing Posts</span>
        {isMock && <DemoChip />}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 min-w-[220px]">Post</th>
              {metaCols.map(c => (
                <th key={c.key} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap"
                  style={{ color: c.color }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((post, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {/* Placeholder thumbnail */}
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200">
                      <PlatformAvatar id={post.platform} size={18} />
                    </div>
                    <div>
                      <p className="text-[12px] text-text font-medium leading-tight max-w-[160px] truncate">{post.caption}</p>
                      <p className="text-[10px] text-text-soft mt-0.5">{post.date}</p>
                    </div>
                  </div>
                </td>
                {metaCols.map(c => {
                  const val = post[c.key as keyof typeof post]
                  return (
                    <td key={c.key} className="px-3 py-3">
                      {c.key === 'erPct' ? (
                        <span className="text-[11px] font-semibold text-emerald-600">{val}%</span>
                      ) : (
                        <span className="text-[12px] text-text">{val === 0 ? '—' : fmt(Number(val))}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Posting Frequency vs Engagement ───────────────────────────────────────────

function PostingFrequencyChart({ isMock }: { isMock: boolean }) {
  const data = MOCK_POSTING_ANALYTICS.postingFrequency
  const optimal = MOCK_POSTING_ANALYTICS.optimalCadence

  const igColor  = '#3B82F6'
  const fbColor  = '#60A5FA'

  const igData = data.filter(d => d.platform === 'instagram')
  const fbData = data.filter(d => d.platform === 'facebook')

  const tickFormatter = (v: number) => {
    const labels: Record<number, string> = { 1: '< 1/wk', 2: '1–2/wk', 3: '3–4/wk', 4: '5+/wk' }
    return labels[v] ?? ''
  }

  return (
    <ChartCard
      title="Posting Frequency vs Engagement"
      isMock={isMock}
    >
      <div className="px-4 pt-4 pb-2">
        <ResponsiveContainer width="100%" height={200}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="x" type="number" domain={[0.5, 4.5]}
              ticks={[1, 2, 3, 4]}
              tickFormatter={tickFormatter}
              tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false}
            />
            <YAxis
              dataKey="y" type="number"
              domain={[0, 5]}
              tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={32}
              tickFormatter={(v: number) => `${v}%`}
            />
            <ZAxis range={[40, 40]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f0f0f0' }}
              content={({ payload }) => {
                if (!payload?.length) return null
                const d = payload[0]?.payload
                return (
                  <div className="bg-white border border-gray-100 rounded-xl p-2.5 shadow text-[11px]">
                    <p className="font-medium text-text">{d.freqLabel}</p>
                    <p className="text-text-sec">{PLATFORM_META[d.platform]?.label}: {d.y}%</p>
                  </div>
                )
              }}
            />
            <Scatter data={igData} fill={igColor} name="Instagram" />
            <Scatter data={fbData} fill={fbColor} name="Facebook" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="px-4 pb-4 space-y-1.5">
        <p className="text-[10px] font-semibold text-text-soft uppercase tracking-wide">Optimal cadence per platform</p>
        {optimal.map(o => (
          <div key={o.platform} className="flex items-center gap-1.5 text-[11px] text-text-sec">
            <PlatformAvatar id={o.platform} size={14} />
            <span className="font-medium">{o.label}</span>
            <span className="text-text-soft">{o.cadence} · {o.engRate}%</span>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

// ── Engagement Accumulation ────────────────────────────────────────────────────

function EngagementAccumulationChart({ isMock }: { isMock: boolean }) {
  const data = MOCK_POSTING_ANALYTICS.engagementAccumulation

  return (
    <ChartCard
      title="Engagement Accumulation"
      subtitle="How engagement accumulates after publishing"
      isMock={isMock}
    >
      <div className="px-4 pt-4 pb-2">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="engAccumGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={32}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f0f0f0' }}
              formatter={(v: unknown) => [`${v}%`, 'Cumulative']}
            />
            <ReferenceLine y={50} stroke="#10B981" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: '50%', position: 'right', fontSize: 10, fill: '#10B981' }} />
            <ReferenceLine y={80} stroke="#F59E0B" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: '80%', position: 'right', fontSize: 10, fill: '#F59E0B' }} />
            <Area type="monotone" dataKey="pct" stroke="#3B82F6" strokeWidth={2} fill="url(#engAccumGrad)" dot={false} name="% of engagement" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="px-4 pb-4 flex items-center gap-1.5 text-[11px] text-text-sec">
        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] inline-block" />
        Half of engagement by <strong className="text-text mx-0.5">{MOCK_POSTING_ANALYTICS.halfEngagementTime}</strong>
        {' · '}
        80% within <strong className="text-text mx-0.5">{MOCK_POSTING_ANALYTICS.eightyPctTime}</strong>
      </div>
    </ChartCard>
  )
}

// ── Inbox Analytics Tab ────────────────────────────────────────────────────────

function InboxAnalyticsContent({ isMock }: { isMock: boolean }) {
  const inbox = MOCK_ANALYTICS_INBOX

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Comments', value: `${inbox.totalComments}` },
          { label: 'Total DMs',      value: `${inbox.totalDMs}` },
          { label: 'Response Rate',  value: `${inbox.responseRate}%` },
        ].map(({ label, value }) => (
          <div key={label} className="relative bg-white rounded-2xl border border-gray-100 p-5">
            {isMock && <DemoDot />}
            <p className="text-[11px] font-medium text-text-soft uppercase tracking-wide mb-2">{label}</p>
            <p className="text-[26px] font-[500] text-text">{value}</p>
          </div>
        ))}
      </div>

      {/* Platform breakdown */}
      <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <span className="text-[13px] font-semibold text-text">Platform breakdown</span>
          {isMock && <DemoChip />}
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50">
              {['Platform', 'Comments', 'DMs', 'Unread'].map(h => (
                <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inbox.platforms.map((p, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <PlatformAvatar id={p.platform} size={20} />
                    <span className="text-[12px] font-medium text-text">{PLATFORM_META[p.platform]?.label ?? p.platform}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-[12px] text-text">{p.comments}</td>
                <td className="px-5 py-3 text-[12px] text-text">{p.dms}</td>
                <td className="px-5 py-3">
                  {p.unread > 0
                    ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: '#FEF3C7', color: '#92400E' }}>{p.unread} unread</span>
                    : <span className="text-[11px] text-text-soft">—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Engagement trend */}
      <div className="rounded-2xl border border-gray-100 bg-white">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <span className="text-[13px] font-semibold text-text">Engagement trend</span>
          {isMock && <DemoChip />}
        </div>
        <div className="px-4 pt-4 pb-3">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={inbox.trend} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9BA1AE' }} tickLine={false} axisLine={false} width={26} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f0f0f0' }} />
              <Bar dataKey="comments" fill="#3B82F6" radius={[3, 3, 0, 0]} name="Comments" />
              <Bar dataKey="dms"      fill="#94A3B8" radius={[3, 3, 0, 0]} name="DMs" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-[12px] text-text-sec">
          Manage and reply to comments and DMs directly in Maya — coming soon.
        </p>
      </div>

      {isMock && <UpgradeCard />}
    </div>
  )
}

// ── Posting Analytics Tab ──────────────────────────────────────────────────────

function PostingAnalyticsContent({ isMock }: { isMock: boolean }) {
  return (
    <div className="space-y-4">
      <StatCards isMock={isMock} />

      {/* 2-col grid for paired charts */}
      <div className="grid grid-cols-2 gap-4">
        <PostsPerPlatformChart isMock={isMock} />
        <PostsOverTimeChart    isMock={isMock} />
        <LikesPerPlatformChart isMock={isMock} />
        <LikesOverTimeChart    isMock={isMock} />
        <EngagementOverTimeChart isMock={isMock} />
        <BestTimeToPostHeatmap   isMock={isMock} />
        <FollowerEvolutionChart  isMock={isMock} />
        <PlatformBreakdownTable  isMock={isMock} />
        <TopPerformingPostsTable isMock={isMock} />
        <PostingFrequencyChart        isMock={isMock} />
        <EngagementAccumulationChart  isMock={isMock} />
      </div>

      {isMock && <UpgradeCard />}
    </div>
  )
}

// ── Connect Panel ─────────────────────────────────────────────────────────────

function ConnectPanel({
  open, onClose, dataState, connectedPlatforms, onDisconnect,
}: {
  open: boolean
  onClose: () => void
  dataState: AnalyticsDataState
  connectedPlatforms: string[]
  onDisconnect: (platform: string) => void
}) {
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [xCostModal, setXCostModal] = useState(false)
  const [pendingXConnect, setPendingXConnect] = useState(false)

  const handleConnect = async (platform: string) => {
    if (platform === 'x' && !pendingXConnect) {
      setXCostModal(true)
      return
    }
    setPendingXConnect(false)
    setConnecting(platform)
    try {
      const res = await fetch('/api/integrations/zernio/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      const data = await res.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      }
    } catch {
      setConnecting(null)
    }
  }

  const handleDisconnect = async (platform: string) => {
    setDisconnecting(platform)
    try {
      await fetch('/api/integrations/zernio/disconnect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      onDisconnect(platform)
    } finally {
      setDisconnecting(null)
    }
  }

  if (!open) return null

  return (
    <>
      {/* X/Twitter cost disclosure modal */}
      {xCostModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <p className="text-[15px] font-semibold text-text mb-1">X / Twitter API costs</p>
            <p className="text-[13px] text-text-sec mb-4">X charges per API call. These pass through from Zernio:</p>
            <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1.5">
              <p className="text-[13px] text-text-sec flex justify-between"><span>Read posts & analytics</span><span className="font-medium text-text">$0.005 / call</span></p>
              <p className="text-[13px] text-text-sec flex justify-between"><span>Publish posts</span><span className="font-medium text-text">$0.015 / post</span></p>
              <p className="text-[13px] text-text-sec flex justify-between"><span>Posts with URLs</span><span className="font-medium text-text">$0.200 / post</span></p>
            </div>
            <p className="text-[12px] text-text-soft mb-4">Set a spending cap in your Zernio dashboard to control costs.</p>
            <div className="flex gap-3">
              <button onClick={() => setXCostModal(false)}
                className="flex-1 border border-gray-200 text-sm font-medium text-text-sec px-4 py-2 rounded-xl hover:border-gray-300 transition-colors">
                Cancel
              </button>
              <button onClick={() => { setXCostModal(false); setPendingXConnect(true); handleConnect('x') }}
                className="flex-1 bg-[#3B82F6] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#2563EB] transition-colors">
                Connect anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-sm z-50 bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <p className="text-[15px] font-semibold text-text">Connect your accounts</p>
            <p className="text-xs text-text-sec mt-0.5">Maya uses these to track performance and publish content.</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
            <X size={14} className="text-gray-500" />
          </button>
        </div>

        {dataState === 'mock' ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
              <span className="text-amber-500 text-xl">🔒</span>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-text mb-2">Activate your plan first</p>
              <p className="text-sm text-text-sec leading-relaxed">
                Connecting social accounts requires an active paid plan. Trial users see demo data only.
              </p>
            </div>
            <a href="/dashboard/billing"
              className="bg-[#3B82F6] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#2563EB] transition-colors w-full text-center">
              Activate your plan →
            </a>
            <a href="/pricing" className="text-sm text-[#3B82F6] hover:underline">View plan options</a>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-soft mb-3">Social accounts</p>
            <div className="space-y-0.5">
              {ALL_PLATFORMS.map(id => {
                const meta = PLATFORM_META[id]
                const isConnected = connectedPlatforms.includes(id)
                const isConnecting = connecting === id
                const isDisconnecting = disconnecting === id
                return (
                  <div key={id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <PlatformAvatar id={id} size={28} />
                      <div>
                        <span className="text-[13px] font-medium text-text">{meta?.label ?? id}</span>
                        {isConnected && (
                          <p className="text-[11px] text-[#10B981]">Connected</p>
                        )}
                      </div>
                    </div>
                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnect(id)}
                        disabled={isDisconnecting}
                        className="text-[12px] font-medium text-red-500 hover:text-red-600 disabled:opacity-50 transition-colors"
                      >
                        {isDisconnecting ? 'Removing…' : 'Disconnect'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(id)}
                        disabled={isConnecting}
                        className="text-[12px] font-semibold text-[#3B82F6] border border-[#BFDBFE] bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                      >
                        {isConnecting ? 'Opening…' : 'Connect'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── GA Connect Modal ──────────────────────────────────────────────────────────

function GAConnectModal({
  onClose, onAgencySuccess, currentPropertyId,
}: {
  onClose: () => void
  onAgencySuccess: (value: string) => void
  currentPropertyId: string
}) {
  const [showAgencyForm, setShowAgencyForm] = useState(false)
  const [value, setValue] = useState(currentPropertyId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submitAgency = async () => {
    if (!value.trim()) { setError('Please enter a Property ID.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/analytics/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'google_analytics', value: value.trim() }),
      })
      if (!res.ok) throw new Error('Failed')
      onAgencySuccess(value.trim())
    } catch { setError('Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
        <button onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
          <X size={14} className="text-gray-500" />
        </button>
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-gray-100 flex-shrink-0">
            <Globe size={16} className="text-gray-500" />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-widest uppercase text-text-soft">Connect</p>
            <h2 className="text-lg font-bold text-text leading-tight">Google Analytics</h2>
          </div>
        </div>
        {!showAgencyForm ? (
          <>
            <p className="text-sm text-text-sec mb-5">Sign in with Google to automatically connect your GA4 property.</p>
            <a href="/api/analytics/ga-connect"
              className="flex items-center justify-center gap-3 w-full py-3 bg-white border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all text-sm font-semibold text-gray-700 mb-4">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </a>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
              <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400">or</span></div>
            </div>
            <button onClick={() => setShowAgencyForm(true)}
              className="w-full py-2.5 text-sm font-medium text-text-sec hover:text-text transition-colors">
              Set up with Agent7even&apos;s help →
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-text-sec mb-5">Enter your GA4 Property ID and our team will complete the connection.</p>
            <label className="block text-xs font-semibold text-text mb-1.5">GA4 Property ID</label>
            <input type="text" value={value} onChange={e => { setValue(e.target.value); setError('') }}
              placeholder="123456789"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-text placeholder-gray-300 focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-colors" />
            <p className="text-xs text-gray-400 mt-2">Find in Google Analytics → Admin → Property Settings → Property ID.</p>
            {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAgencyForm(false)}
                className="flex-1 py-2.5 text-sm font-medium text-text-sec border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">Back</button>
              <button onClick={submitAgency} disabled={loading}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#3B82F6] rounded-xl hover:bg-[#2563EB] disabled:opacity-50 transition-colors">
                {loading ? 'Saving…' : 'Request connection'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PropertySelectorModal({
  oauthEmail, onClose, onSelect,
}: {
  oauthEmail: string | null
  onClose: () => void
  onSelect: (propertyId: string) => void
}) {
  const [properties, setProperties] = useState<GAProperty[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/analytics/ga-properties')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(`API error: ${d.error}`)
        else { setProperties(d.properties ?? []); if (d.properties?.length === 1) setSelected(d.properties[0].id) }
      })
      .catch(() => setError('Could not load properties.'))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    if (!selected) { setError('Please select a property.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/analytics/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'google_analytics', value: selected }),
      })
      if (!res.ok) throw new Error('Failed')
      onSelect(selected)
    } catch { setError('Something went wrong.') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
        <button onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
          <X size={14} className="text-gray-500" />
        </button>
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle size={18} className="text-emerald-500" />
          <p className="text-[10px] font-semibold tracking-widest uppercase text-emerald-600">Google Connected</p>
        </div>
        <h2 className="text-lg font-bold text-text mb-1">Select your property</h2>
        {oauthEmail && <p className="text-xs text-gray-400 mb-5">Signed in as <span className="font-medium text-text-sec">{oauthEmail}</span></p>}
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="w-6 h-6 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-text font-medium mb-2">No GA4 properties found</p>
            <a href="/api/analytics/ga-connect"
              className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-[#3B82F6] px-4 py-2.5 rounded-lg hover:bg-[#2563EB] transition-colors">
              Try a different Google account
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {properties.map(p => (
              <button key={p.id} onClick={() => setSelected(p.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${selected === p.id ? 'border-[#3B82F6] bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                <div>
                  <p className="text-sm font-semibold text-text">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.account ? `${p.account} · ` : ''}ID: {p.id}</p>
                </div>
                {selected === p.id && <CheckCircle size={16} className="text-[#3B82F6] flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        {properties.length > 0 && (
          <button onClick={save} disabled={saving || !selected}
            className="w-full mt-5 py-3 text-sm font-semibold text-white bg-[#3B82F6] rounded-xl hover:bg-[#2563EB] disabled:opacity-50 transition-colors">
            {saving ? 'Connecting…' : 'Connect property'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AnalyticsClient({
  companyName,
  dataState,
  gaMeasurementId,
  gaOAuthConnected,
  gaOAuthEmail,
  zernioConnectedPlatforms,
}: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [activeTab, setActiveTab]           = useState<PostingTab>('posting')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [sourceFilter, setSourceFilter]     = useState('all')
  const [dateRange, setDateRange]           = useState<DateRange>('1y')
  const [connectPanelOpen, setConnectPanelOpen] = useState(false)
  const [showGAModal, setShowGAModal]       = useState(false)
  const [showPropertySelector, setShowPropertySelector] = useState(false)
  const [oauthError, setOauthError]         = useState('')
  const [gaId, setGaId]                     = useState(gaMeasurementId)
  const [oauthConnected, setOauthConnected] = useState(gaOAuthConnected)
  const [gaData, setGaData]                 = useState<GaData | null>(null)
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>(zernioConnectedPlatforms)
  const [zernioToast, setZernioToast]       = useState('')

  const isMock = dataState === 'mock'

  // Maya canvas context
  useEffect(() => {
    const ctx = `ANALYTICS PAGE\nCompany: ${companyName}\nState: ${dataState}\nGA: ${gaId ? `Property ${gaId}` : 'Not connected'}\nZernio: ${connectedPlatforms.join(', ') || 'None'}`
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context: ctx } }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // GA OAuth redirects
  useEffect(() => {
    const oauthStatus = searchParams.get('ga_oauth')
    const gaError     = searchParams.get('ga_error')
    if (oauthStatus === 'success') {
      setOauthConnected(true); setShowPropertySelector(true)
      router.replace('/dashboard/analytics')
    } else if (gaError) {
      const msgs: Record<string, string> = {
        access_denied:    'Google sign-in was cancelled.',
        no_refresh_token: 'Could not get access token. Please try again.',
        save_failed:      'Failed to save connection. Please try again.',
      }
      setOauthError(msgs[gaError] ?? 'Something went wrong.')
      router.replace('/dashboard/analytics')
    }
  }, [searchParams, router])

  // Zernio OAuth redirects
  useEffect(() => {
    const connected = searchParams.get('zernio_connected')
    const zernioErr = searchParams.get('zernio_error')
    if (connected) {
      const label = connected.charAt(0).toUpperCase() + connected.slice(1)
      setZernioToast(`${label} connected`)
      setConnectedPlatforms(prev => prev.includes(connected) ? prev : [...prev, connected])
      router.replace('/dashboard/analytics')
    } else if (zernioErr) {
      const msgs: Record<string, string> = {
        access_denied:      'Account connection was cancelled.',
        invalid_state:      'Session expired — please try again.',
        save_failed:        'Failed to save connection. Please try again.',
        profile_not_found:  'Profile not found. Please try again.',
      }
      setOauthError(msgs[zernioErr] ?? 'Something went wrong connecting your account.')
      router.replace('/dashboard/analytics')
    }
  }, [searchParams, router])

  // Fetch GA data (live/empty state only)
  const fetchGaData = useCallback(async () => {
    if (dataState === 'mock' || !gaId) return
    try {
      const res  = await fetch(`/api/analytics/ga-data?range=${dateRange}`)
      const json = await res.json()
      if (json.connected) setGaData(json)
    } catch { /* fail soft */ }
  }, [dataState, gaId, dateRange])

  useEffect(() => { fetchGaData() }, [fetchGaData])

  const handleGAConnect = () => oauthConnected ? setShowPropertySelector(true) : setShowGAModal(true)

  const TABS: { id: PostingTab; label: string }[] = [
    { id: 'posting', label: 'Posting analytics' },
    { id: 'inbox',   label: 'Inbox analytics'   },
  ]

  return (
    <div className="mx-auto max-w-[1240px] px-8 py-6">

      {/* Modals */}
      {showGAModal && (
        <GAConnectModal
          currentPropertyId={gaId ?? ''}
          onClose={() => setShowGAModal(false)}
          onAgencySuccess={v => { setGaId(v); setShowGAModal(false) }}
        />
      )}
      {showPropertySelector && (
        <PropertySelectorModal
          oauthEmail={gaOAuthEmail}
          onClose={() => setShowPropertySelector(false)}
          onSelect={id => { setGaId(id); setShowPropertySelector(false) }}
        />
      )}

      <ConnectPanel
        open={connectPanelOpen}
        onClose={() => setConnectPanelOpen(false)}
        dataState={dataState}
        connectedPlatforms={connectedPlatforms}
        onDisconnect={(p) => setConnectedPlatforms(prev => prev.filter(x => x !== p))}
      />

      {/* Zernio connect toast */}
      {zernioToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#0F172A] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-xl"
          onAnimationEnd={() => setZernioToast('')}>
          <CheckCircle size={14} className="text-[#10B981]" />
          {zernioToast}
          <button onClick={() => setZernioToast('')} className="ml-2 opacity-60 hover:opacity-100">
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="mb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[22px] font-[500] text-text">Analytics</h1>
            <p className="text-[13px] text-text-sec mt-0.5">View post performance metrics</p>
          </div>
          <button
            onClick={() => setConnectPanelOpen(true)}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-[#3B82F6] bg-blue-50 border border-[#BFDBFE] px-3.5 py-2 rounded-xl hover:bg-blue-100 transition-colors"
          >
            <Plus size={13} /> Connect accounts
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-end gap-0 border-b border-gray-200 mt-4">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 text-[13px] font-medium border-b-2 transition-colors -mb-px ${
                activeTab === t.id
                  ? 'border-[#3B82F6] text-[#3B82F6] font-semibold'
                  : 'border-transparent text-text-sec hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter bar + demo banner ──────────────────────────────────────── */}
      <MayaBriefingCard isMock={isMock} />

      <FilterBar
        platform={platformFilter}
        profile="default"
        source={sourceFilter}
        dateRange={dateRange}
        isMock={isMock}
        onPlatformChange={setPlatformFilter}
        onSourceChange={setSourceFilter}
        onDateRangeChange={setDateRange}
      />

      {isMock && <AmberBanner />}

      {/* Error toast */}
      {oauthError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 mb-5">
          <p className="text-xs font-medium text-red-600">{oauthError}</p>
          <button onClick={() => setOauthError('')} className="text-red-400"><X size={14} /></button>
        </div>
      )}

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      {activeTab === 'posting' && <PostingAnalyticsContent isMock={isMock} />}
      {activeTab === 'inbox'   && <InboxAnalyticsContent   isMock={isMock} />}
    </div>
  )
}
