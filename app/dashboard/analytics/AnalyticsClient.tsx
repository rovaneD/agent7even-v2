'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Globe, Info, Eye, X, CheckCircle, Clock, Wifi, RefreshCw, AlertCircle,
  DollarSign, Users, ExternalLink, ChevronDown, ChevronUp, Sparkles,
  LayoutGrid, TrendingUp, MessageCircle, Plus, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import type { AnalyticsDataState } from './page'
import {
  MOCK_GA_DATA, MOCK_ANALYTICS_SOCIAL, MOCK_ANALYTICS_ADS,
  MOCK_ANALYTICS_INBOX, MOCK_CONNECTED_PLATFORMS,
} from '@/lib/analytics/mockData'

// ── Types ─────────────────────────────────────────────────────────────────────

type Range = '7d' | '30d' | '90d'
type Tab   = 'overview' | 'social' | 'ads' | 'inbox'

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

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  instagram:    { label: 'Instagram',    color: '#E1306C' },
  facebook:     { label: 'Facebook',     color: '#1877F2' },
  tiktok:       { label: 'TikTok',       color: '#010101' },
  linkedin:     { label: 'LinkedIn',     color: '#0A66C2' },
  youtube:      { label: 'YouTube',      color: '#FF0000' },
  x:            { label: 'X',            color: '#000000' },
  threads:      { label: 'Threads',      color: '#000000' },
  bluesky:      { label: 'Bluesky',      color: '#0085FF' },
  pinterest:    { label: 'Pinterest',    color: '#E60023' },
  reddit:       { label: 'Reddit',       color: '#FF4500' },
  google_business: { label: 'Google Business', color: '#4285F4' },
  meta_ads:     { label: 'Meta Ads',     color: '#1877F2' },
  google_ads:   { label: 'Google Ads',   color: '#4285F4' },
  linkedin_ads: { label: 'LinkedIn Ads', color: '#0A66C2' },
  tiktok_ads:   { label: 'TikTok Ads',  color: '#010101' },
  pinterest_ads:{ label: 'Pinterest Ads',color: '#E60023' },
  x_ads:        { label: 'X Ads',       color: '#000000' },
}

const SOCIAL_PLATFORMS = [
  'instagram','facebook','tiktok','linkedin','youtube',
  'x','threads','bluesky','pinterest','reddit','google_business',
]
const AD_PLATFORMS = [
  'meta_ads','google_ads','linkedin_ads','tiktok_ads','pinterest_ads','x_ads',
]

// ── Small shared components ───────────────────────────────────────────────────

function BrandIcon({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-surface-2 flex-shrink-0">
      <img src={src} alt={alt} className="w-5 h-5 object-contain" />
    </div>
  )
}

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative inline-flex items-center">
      <button
        onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)} onBlur={() => setShow(false)}
        className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors"
        aria-label="Info"
      >
        <Info size={11} />
      </button>
      {show && (
        <div className="absolute left-0 top-full mt-2 z-50 w-64 bg-gray-900 text-white text-xs leading-relaxed rounded-xl px-3 py-2.5 shadow-xl pointer-events-none">
          <div className="absolute left-2 bottom-full w-2 h-2 bg-gray-900 rotate-45 mb-[-4px]" />
          {text}
        </div>
      )}
    </div>
  )
}

function PlatformAvatar({ id, size = 24 }: { id: string; size?: number }) {
  const meta = PLATFORM_META[id]
  const label = meta?.label ?? id
  const color = meta?.color ?? '#6B7280'
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.4 }}
      title={label}
    >
      {label[0].toUpperCase()}
    </div>
  )
}

// ── Demo / mock state visual components ───────────────────────────────────────

function DemoPill() {
  return (
    <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border"
      style={{ background: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A' }}>
      Demo
    </span>
  )
}

function DemoBadge() {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
      style={{ background: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A' }}>
      Demo data
    </span>
  )
}

function AmberBanner() {
  return (
    <div className="flex items-center justify-between px-6 py-3 border-b"
      style={{ background: '#FFF7ED', borderColor: '#FDE68A' }}>
      <div className="flex items-center gap-2.5">
        <i className="ti ti-eye-off text-amber-600" style={{ fontSize: 15 }} />
        <p className="text-[12px] font-medium text-amber-800">
          <span className="font-semibold">Demo data only</span> — this is not your real performance.
          Connect your accounts on a paid plan to see live data.
        </p>
      </div>
      <a href="/dashboard/billing" className="text-[12px] font-semibold text-[#3B82F6] hover:underline flex-shrink-0 ml-4">
        View plans →
      </a>
    </div>
  )
}

function UpgradeCard() {
  return (
    <div className="rounded-2xl border-[1.5px] border-[#BFDBFE] bg-white p-8 text-center mt-4">
      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
        <i className="ti ti-chart-bar text-brand-primary" style={{ fontSize: 22 }} />
      </div>
      <h3 className="text-[16px] font-semibold text-text mb-2">See your real performance data</h3>
      <p className="text-sm text-text-sec leading-relaxed max-w-md mx-auto mb-4">
        Connect your social accounts, ad platforms, and Google Analytics to see your actual
        followers, reach, engagement, ad spend, and Maya's weekly briefing.
      </p>
      <div className="inline-flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-lg mb-5"
        style={{ background: '#FEF3C7', color: '#92400E' }}>
        <i className="ti ti-info-circle" style={{ fontSize: 13 }} />
        Live data is available on paid plans only. Not included in the 3-day free trial.
      </div>
      <div className="flex items-center justify-center gap-3">
        <a href="/dashboard/billing"
          className="bg-brand-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#2563EB] transition-colors">
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

function MockSidebar() {
  const checklist = [
    'Instagram, Facebook, TikTok',
    'LinkedIn, YouTube, X',
    'Meta Ads, Google Ads',
    'Maya weekly briefing',
    'Best time to post',
    'Content decay curves',
    'Top performing posts',
    'GA website traffic',
  ]
  return (
    <div className="flex flex-col gap-3 w-64 flex-shrink-0">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-[12px] font-semibold text-text mb-3">What you'll see when connected</p>
        <ul className="space-y-2">
          {checklist.map(item => (
            <li key={item} className="flex items-center gap-2 text-xs text-text-sec">
              <CheckCircle size={12} className="text-emerald-500 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-[12px] font-semibold text-text mb-2">Demo data shown above</p>
        <p className="text-xs text-text-sec leading-relaxed mb-3">
          Numbers shown are illustrative — typical for an SMB after 6 months of consistent posting.
        </p>
        <div className="space-y-1.5">
          {[65, 45, 80, 35, 55].map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-3 rounded-full bg-gray-200 opacity-50" style={{ width: `${w}%` }} />
              {i === 2 && <span className="text-[9px] text-gray-300">← your data goes here</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({
  label, value, delta, logoSrc, icon: Icon, notConnected, linkLabel, onLink, isMock,
}: {
  label: string
  value: string
  delta?: number
  logoSrc?: string
  icon?: React.ElementType
  notConnected?: boolean
  linkLabel?: string
  onLink?: () => void
  isMock?: boolean
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-soft">{label}</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isMock && <DemoPill />}
          {!isMock && logoSrc && <BrandIcon src={logoSrc} alt={label} />}
          {!isMock && !logoSrc && Icon && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50">
              <Icon size={14} className="text-text-soft" />
            </div>
          )}
        </div>
      </div>
      {notConnected && !isMock ? (
        <div>
          <p className="text-[22px] font-semibold text-text-soft">—</p>
          {linkLabel && (
            <button onClick={onLink} className="text-[11px] text-brand-primary hover:underline mt-1">
              {linkLabel}
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-end justify-between">
          <p className="text-[22px] font-semibold text-text">{value}</p>
          {delta !== undefined && (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {delta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {Math.abs(delta)}%
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Maya's briefing card ──────────────────────────────────────────────────────

function MayaBriefingCard({ hasSource }: { hasSource: boolean }) {
  const avatar = (
    <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
      <span className="text-white text-[11px] font-bold">M</span>
    </div>
  )
  if (!hasSource) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="flex items-center gap-2.5 mb-2">{avatar}
          <span className="text-[13px] font-semibold text-text">Maya's briefing</span>
        </div>
        <p className="text-sm text-text-sec">Connect at least one data source to get Maya's performance read.</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6" style={{ borderLeft: '4px solid #3B82F6' }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">{avatar}
          <span className="text-[13px] font-semibold text-text">Maya's briefing</span>
        </div>
        <button disabled title="Coming in Phase 6"
          className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-brand-primary px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
          <Sparkles size={12} /> Generate briefing
        </button>
      </div>
      <p className="text-sm text-text-sec mt-3">Maya hasn't analyzed this period yet.</p>
      <p className="text-[11px] text-text-soft mt-1">Takes ~15 seconds · Uses 2 credits</p>
    </div>
  )
}

// ── Connect panel (slide-out) ─────────────────────────────────────────────────

function ConnectPanel({
  open, onClose, dataState,
}: {
  open: boolean
  onClose: () => void
  dataState: AnalyticsDataState
}) {
  if (!open) return null
  return (
    <>
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
              <i className="ti ti-lock text-amber-500" style={{ fontSize: 20 }} />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-text mb-2">Activate your plan first</p>
              <p className="text-sm text-text-sec leading-relaxed">
                Connecting social and ad accounts requires an active paid plan.
                Trial users see demo data only.
              </p>
            </div>
            <a href="/dashboard/billing"
              className="bg-brand-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#2563EB] transition-colors w-full">
              Activate your plan →
            </a>
            <a href="/pricing" className="text-sm text-brand-primary hover:underline">View plan options</a>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-soft mb-3">Social accounts</p>
              <div className="space-y-2">
                {SOCIAL_PLATFORMS.map(id => {
                  const meta = PLATFORM_META[id]
                  return (
                    <div key={id} className="flex items-center justify-between py-2.5 border-b border-gray-50">
                      <div className="flex items-center gap-2.5">
                        <PlatformAvatar id={id} size={28} />
                        <span className="text-[13px] font-medium text-text">{meta?.label ?? id}</span>
                      </div>
                      <button
                        disabled
                        className="text-[12px] font-semibold text-brand-primary border border-[#BFDBFE] bg-blue-50 px-3 py-1.5 rounded-lg opacity-60 cursor-not-allowed"
                        title="Coming in Phase 2"
                      >
                        Connect
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-soft mb-3">Ad accounts</p>
              <div className="space-y-2">
                {AD_PLATFORMS.map(id => {
                  const meta = PLATFORM_META[id]
                  const isX = id === 'x_ads'
                  return (
                    <div key={id} className="flex items-center justify-between py-2.5 border-b border-gray-50">
                      <div className="flex items-center gap-2.5">
                        <PlatformAvatar id={id} size={28} />
                        <div>
                          <span className="text-[13px] font-medium text-text">{meta?.label ?? id}</span>
                          {isX && <p className="text-[10px] text-amber-600">Per-call costs apply</p>}
                        </div>
                      </div>
                      <button
                        disabled
                        className="text-[12px] font-semibold text-brand-primary border border-[#BFDBFE] bg-blue-50 px-3 py-1.5 rounded-lg opacity-60 cursor-not-allowed"
                        title="Coming in Phase 2"
                      >
                        Connect
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
            <p className="text-[11px] text-text-soft text-center pt-2">
              Account connections coming in the next update.
            </p>
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
          <BrandIcon src="/google_analytics_icon.png" alt="GA" />
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
              Set up with Agent7even's help →
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-text-sec mb-5">Enter your GA4 Property ID and our team will complete the connection.</p>
            <label className="block text-xs font-semibold text-text mb-1.5">GA4 Property ID</label>
            <input type="text" value={value} onChange={e => { setValue(e.target.value); setError('') }}
              placeholder="123456789"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-text placeholder-gray-300 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors" />
            <p className="text-xs text-gray-400 mt-2">Find in Google Analytics → Admin → Property Settings → Property ID.</p>
            {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAgencyForm(false)}
                className="flex-1 py-2.5 text-sm font-medium text-text-sec border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">Back</button>
              <button onClick={submitAgency} disabled={loading}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand-primary rounded-xl hover:bg-[#2563EB] disabled:opacity-50 transition-colors">
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
            <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-text font-medium mb-2">No GA4 properties found</p>
            <a href="/api/analytics/ga-connect"
              className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-brand-primary px-4 py-2.5 rounded-lg hover:bg-[#2563EB] transition-colors">
              Try a different Google account
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {properties.map(p => (
              <button key={p.id} onClick={() => setSelected(p.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${selected === p.id ? 'border-brand-primary bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                <div>
                  <p className="text-sm font-semibold text-text">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.account ? `${p.account} · ` : ''}ID: {p.id}</p>
                </div>
                {selected === p.id && <CheckCircle size={16} className="text-brand-primary flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        {properties.length > 0 && (
          <button onClick={save} disabled={saving || !selected}
            className="w-full mt-5 py-3 text-sm font-semibold text-white bg-brand-primary rounded-xl hover:bg-[#2563EB] disabled:opacity-50 transition-colors">
            {saving ? 'Connecting…' : 'Connect property'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  dataState, gaId, gaData, gaLoading, onConnectGA, openConnectPanel,
}: {
  dataState: AnalyticsDataState
  gaId: string | null
  gaData: GaData | null
  gaLoading: boolean
  onConnectGA: () => void
  openConnectPanel: () => void
}) {
  const isMock = dataState === 'mock'
  const social  = MOCK_ANALYTICS_SOCIAL.overview
  const ads     = MOCK_ANALYTICS_ADS.overview

  // Derive metric values
  const sessions  = isMock ? MOCK_GA_DATA.summary.sessions
    : gaData ? gaData.summary.sessions : null
  const reach      = isMock ? social.totalReach : null
  const followers  = isMock ? social.totalFollowers : null
  const adSpend    = isMock ? ads.totalSpend : null

  const hasSource = isMock || !!gaId

  return (
    <div className="space-y-4">
      <MayaBriefingCard hasSource={hasSource} />

      {/* Metrics bar */}
      <div className="space-y-3">
        <div className={`relative grid grid-cols-2 lg:grid-cols-4 gap-3 ${isMock ? 'pointer-events-none' : ''}`}>
          <MetricCard label="GA Sessions"
            value={sessions !== null ? fmt(sessions) : '—'}
            logoSrc="/google_analytics_icon.png"
            notConnected={sessions === null && !isMock}
            linkLabel={!gaId && !isMock ? 'Connect GA →' : undefined}
            onLink={onConnectGA}
            isMock={isMock}
          />
          <MetricCard label="Total Reach"
            value={reach !== null ? fmt(reach) : '—'}
            icon={Eye}
            notConnected={!isMock}
            linkLabel={!isMock ? 'Connect accounts →' : undefined}
            onLink={openConnectPanel}
            isMock={isMock}
          />
          <MetricCard label="Total Followers"
            value={followers !== null ? fmt(followers) : '—'}
            icon={Users}
            notConnected={!isMock}
            linkLabel={!isMock ? 'Connect accounts →' : undefined}
            onLink={openConnectPanel}
            isMock={isMock}
            delta={isMock ? MOCK_ANALYTICS_SOCIAL.overview.followerGrowthPct : undefined}
          />
          <MetricCard label="Ad Spend"
            value={adSpend !== null ? `$${adSpend.toFixed(2)}` : '—'}
            icon={DollarSign}
            notConnected={!isMock}
            linkLabel={!isMock ? 'Connect ad accounts →' : undefined}
            onLink={openConnectPanel}
            isMock={isMock}
          />
          {isMock && (
            <div className="absolute inset-0 rounded-xl pointer-events-none"
              style={{ backgroundColor: 'rgba(255,255,255,0.55)' }} />
          )}
        </div>

        {/* Cross-channel insight */}
        {(isMock || (gaId && dataState === 'live')) && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
            <Sparkles size={13} className="text-[#3B82F6] flex-shrink-0" />
            <p className="text-xs text-[#3B82F6]">
              {isMock
                ? 'Instagram drove 28% of your website sessions · Meta is your top ad platform this week · Tuesday is your highest-reach posting day'
                : 'Generate a briefing to see cross-channel insights across your connected sources.'
              }
            </p>
          </div>
        )}
      </div>

      {/* GA chart (live/empty state) */}
      {!isMock && (
        <div className="rounded-2xl border border-gray-100 bg-white">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3">
            <BrandIcon src="/google_analytics_icon.png" alt="GA" />
            <div className="flex items-center gap-2 flex-1">
              <p className="text-[13px] font-semibold text-text">Google Analytics</p>
              {gaId && <span className="text-[11px] text-text-soft">GA4 · Property {gaId}</span>}
            </div>
            {gaId && (
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                <Wifi size={10} /> Connected
              </span>
            )}
          </div>
          {!gaId ? (
            <div className="px-8 py-10 flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
                <Globe size={20} className="text-gray-300" />
              </div>
              <div className="max-w-sm">
                <p className="text-[14px] font-semibold text-text mb-2">See what's driving traffic to your website</p>
                <p className="text-sm text-text-sec leading-relaxed">
                  Connect Google Analytics to track sessions, top pages, and where visitors come from.
                </p>
              </div>
              <button onClick={onConnectGA}
                className="flex items-center gap-2 bg-brand-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#2563EB] transition-colors">
                Connect Google Analytics <ExternalLink size={13} />
              </button>
            </div>
          ) : gaLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : gaData ? (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100 border-b border-gray-100">
                {[
                  { label: 'Sessions',    value: fmt(gaData.summary.sessions) },
                  { label: 'Users',       value: fmt(gaData.summary.users) },
                  { label: 'Pageviews',   value: fmt(gaData.summary.pageviews) },
                  { label: 'Bounce rate', value: `${gaData.summary.bounceRate}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white px-5 py-3">
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                    <p className="text-[17px] font-semibold text-text mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              <div className="px-5 pt-5 pb-4">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={gaData.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={32} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #f0f0f0' }} />
                    <Line type="monotone" dataKey="sessions" stroke="#3B82F6" strokeWidth={2} dot={false} name="Sessions" />
                    <Line type="monotone" dataKey="users"    stroke="#94A3B8" strokeWidth={2} dot={false} name="Users" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-text-sec">Could not load GA data. <button onClick={() => {}} className="text-brand-primary underline">Retry</button></p>
            </div>
          )}
        </div>
      )}

      {/* Mock state: show social chart with overlay */}
      {isMock && (
        <div className="rounded-2xl border border-gray-100 bg-white">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold text-text">Follower growth</p>
              <DemoBadge />
            </div>
          </div>
          <div className="relative px-5 pt-5 pb-4">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={MOCK_ANALYTICS_SOCIAL.followerHistory.filter((_, i) => i % 3 === 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={2} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f0f0f0' }} />
                <Line type="monotone" dataKey="followers" stroke="#3B82F6" strokeWidth={2} dot={false} name="Followers" />
              </LineChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 pointer-events-none rounded-b-2xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.55)' }} />
          </div>
        </div>
      )}

      {/* Actionable signals (empty state / mock placeholder) */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <p className="text-[13px] font-semibold text-text mb-3">Maya's suggestions</p>
        {isMock ? (
          <div className="space-y-2.5 relative">
            {[
              'Meta ad CTR down 6% this week — creative may need refreshing',
              'Tuesday posts get 2× reach — your next post is scheduled for Monday',
              'Instagram followers grew 4.6% — capitalize with a campaign this week',
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary flex-shrink-0 mt-1.5" />
                <p className="text-[12px] text-text-sec leading-relaxed">{text}</p>
              </div>
            ))}
            <div className="absolute inset-0 pointer-events-none rounded-xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.55)' }} />
          </div>
        ) : (
          <p className="text-sm text-text-sec">
            Generate a briefing after connecting your accounts to see data-driven suggestions here.
          </p>
        )}
      </div>

      {isMock && <UpgradeCard />}
    </div>
  )
}

// ── Social tab ────────────────────────────────────────────────────────────────

function SocialTab({ dataState, openConnectPanel }: { dataState: AnalyticsDataState; openConnectPanel: () => void }) {
  const isMock = dataState === 'mock'
  const [activePlatform, setActivePlatform] = useState<string>('all')
  const platforms = isMock ? Object.keys(MOCK_ANALYTICS_SOCIAL.platforms) : []
  const overview  = MOCK_ANALYTICS_SOCIAL.overview

  if (!isMock && dataState !== 'live') {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-8 py-12 flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
          <TrendingUp size={20} className="text-gray-300" />
        </div>
        <div className="max-w-sm">
          <p className="text-[15px] font-semibold text-text mb-2">Connect your social accounts</p>
          <p className="text-sm text-text-sec leading-relaxed">
            See organic performance across Instagram, Facebook, TikTok, LinkedIn, and more — all in one view.
          </p>
        </div>
        <button onClick={openConnectPanel}
          className="flex items-center gap-2 bg-brand-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#2563EB] transition-colors">
          <Plus size={14} /> Connect accounts
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Platform selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all', ...platforms].map(p => (
          <button key={p} onClick={() => setActivePlatform(p)}
            className={`flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              activePlatform === p
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-white text-text-sec border-gray-200 hover:border-gray-300'
            }`}>
            {p !== 'all' && <PlatformAvatar id={p} size={16} />}
            {p === 'all' ? 'All platforms' : PLATFORM_META[p]?.label ?? p}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className={`relative grid grid-cols-2 lg:grid-cols-5 gap-3 ${isMock ? 'pointer-events-none' : ''}`}>
        {[
          { label: 'Followers',      value: fmt(overview.totalFollowers),                  delta: overview.followerGrowthPct },
          { label: 'Total Reach',    value: fmt(overview.totalReach) },
          { label: 'Engagement Rate',value: `${overview.engagementRate}%` },
          { label: 'Posts This Period',value: `${overview.postsThisPeriod}` },
          { label: 'Best Day',       value: MOCK_ANALYTICS_SOCIAL.bestTimeToPost.day },
        ].map(({ label, value, delta }) => (
          <div key={label} className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-soft">{label}</span>
              {isMock && <DemoPill />}
            </div>
            <div className="flex items-end gap-2">
              <p className="text-[20px] font-semibold text-text">{value}</p>
              {delta !== undefined && (
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-0.5 mb-0.5">
                  <ArrowUpRight size={12} />{delta}%
                </span>
              )}
            </div>
          </div>
        ))}
        {isMock && (
          <div className="absolute inset-0 rounded-xl pointer-events-none"
            style={{ backgroundColor: 'rgba(255,255,255,0.55)' }} />
        )}
      </div>

      {/* Charts */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${isMock ? '' : ''}`}>
        {[
          { title: 'Posts over time', dataKey: 'posts', color: '#3B82F6' },
          { title: 'Likes over time', dataKey: 'likes', color: '#10B981' },
        ].map(({ title, dataKey, color }) => (
          <div key={title} className="rounded-2xl border border-gray-100 bg-white">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-text">{title}</p>
              {isMock && <DemoBadge />}
            </div>
            <div className="relative px-4 pt-4 pb-3">
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={MOCK_ANALYTICS_SOCIAL.dailyMetrics.filter((_, i) => i % 3 === 0)} barSize={10}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f0f0f0' }} />
                  <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {isMock && (
                <div className="absolute inset-0 pointer-events-none rounded-b-2xl"
                  style={{ backgroundColor: 'rgba(255,255,255,0.55)' }} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Top posts */}
      <div className="rounded-2xl border border-gray-100 bg-white">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-text">Top performing posts</p>
          {isMock && <DemoBadge />}
        </div>
        <div className={`relative divide-y divide-gray-50`}>
          {MOCK_ANALYTICS_SOCIAL.topPosts.map((post, i) => (
            <div key={i} className="flex items-center gap-3 px-6 py-3.5">
              <PlatformAvatar id={post.platform} size={24} />
              <p className="text-[12px] text-text flex-1 truncate">{post.content}</p>
              <div className="flex items-center gap-4 text-[11px] text-text-soft flex-shrink-0">
                <span title="Reach">{fmt(post.reach)} reach</span>
                <span title="Engagement rate" className="text-emerald-600 font-medium">{post.engagementRate}%</span>
              </div>
            </div>
          ))}
          {isMock && (
            <div className="absolute inset-0 pointer-events-none"
              style={{ backgroundColor: 'rgba(255,255,255,0.55)' }} />
          )}
        </div>
      </div>

      {/* Best time to post */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 flex items-center justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-text-soft mb-1">Best time to post</p>
          <p className="text-[15px] font-semibold text-text">
            {MOCK_ANALYTICS_SOCIAL.bestTimeToPost.day} at {MOCK_ANALYTICS_SOCIAL.bestTimeToPost.hour}
          </p>
          <p className="text-[11px] text-text-sec mt-0.5">Avg {fmt(MOCK_ANALYTICS_SOCIAL.bestTimeToPost.avgEngagement)} engagements per post</p>
        </div>
        {isMock && <DemoPill />}
      </div>

      {isMock && <UpgradeCard />}
    </div>
  )
}

// ── Ads tab ───────────────────────────────────────────────────────────────────

function AdsTab({ dataState, openConnectPanel }: { dataState: AnalyticsDataState; openConnectPanel: () => void }) {
  const isMock = dataState === 'mock'
  const [activePlatform, setActivePlatform] = useState<string>('all')
  const adPlatforms  = isMock ? Object.keys(MOCK_ANALYTICS_ADS.platforms) : []
  const adsOverview  = MOCK_ANALYTICS_ADS.overview

  if (!isMock && dataState !== 'live') {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-8 py-12 flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
          <DollarSign size={20} className="text-gray-300" />
        </div>
        <div className="max-w-sm">
          <p className="text-[15px] font-semibold text-text mb-2">Connect your ad accounts</p>
          <p className="text-sm text-text-sec leading-relaxed">
            Track spend, reach, and CTR across Meta Ads, Google Ads, TikTok Ads, and more — and let Maya flag when creative needs refreshing.
          </p>
        </div>
        <button onClick={openConnectPanel}
          className="flex items-center gap-2 bg-brand-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#2563EB] transition-colors">
          <Plus size={14} /> Connect ad accounts
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Platform pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all', ...adPlatforms].map(p => (
          <button key={p} onClick={() => setActivePlatform(p)}
            className={`flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              activePlatform === p
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-white text-text-sec border-gray-200 hover:border-gray-300'
            }`}>
            {p !== 'all' && <PlatformAvatar id={p} size={16} />}
            {p === 'all' ? 'All platforms' : PLATFORM_META[p]?.label ?? p}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className={`relative grid grid-cols-2 lg:grid-cols-4 gap-3 ${isMock ? 'pointer-events-none' : ''}`}>
        {[
          { label: 'Total Spend',  value: `$${adsOverview.totalSpend.toFixed(2)}` },
          { label: 'Total Reach',  value: fmt(adsOverview.totalReach) },
          { label: 'Total Clicks', value: fmt(adsOverview.totalClicks) },
          { label: 'Avg CTR',      value: `${adsOverview.avgCTR}%` },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-soft">{label}</span>
              {isMock && <DemoPill />}
            </div>
            <p className="text-[20px] font-semibold text-text">{value}</p>
          </div>
        ))}
        {isMock && (
          <div className="absolute inset-0 rounded-xl pointer-events-none"
            style={{ backgroundColor: 'rgba(255,255,255,0.55)' }} />
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {([
          { title: 'Spend over time', data: MOCK_ANALYTICS_ADS.spendOverTime as Record<string, unknown>[], dataKey: 'spend', color: '#3B82F6' },
          { title: 'CTR trend', data: MOCK_ANALYTICS_ADS.ctrTrend as Record<string, unknown>[], dataKey: 'ctr', color: '#10B981' },
        ] as const).map(({ title, data, dataKey, color }) => (
          <div key={title} className="rounded-2xl border border-gray-100 bg-white">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-text">{title}</p>
              {isMock && <DemoBadge />}
            </div>
            <div className="relative px-4 pt-4 pb-3">
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={32} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f0f0f0' }} />
                  <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              {isMock && (
                <div className="absolute inset-0 pointer-events-none rounded-b-2xl"
                  style={{ backgroundColor: 'rgba(255,255,255,0.55)' }} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Campaigns table */}
      <div className="rounded-2xl border border-gray-100 bg-white">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-text">Active campaigns</p>
          {isMock && <DemoBadge />}
        </div>
        <div className="relative">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-px bg-gray-100 border-b border-gray-100">
            {['Campaign', 'Spend', 'Reach', 'Clicks', 'CTR', 'Status'].map(h => (
              <div key={h} className="bg-white px-4 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{h}</p>
              </div>
            ))}
          </div>
          {MOCK_ANALYTICS_ADS.campaigns.map((c, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] border-b border-gray-50 last:border-0">
              <div className="px-4 py-3 flex items-center gap-2">
                <PlatformAvatar id={c.platform} size={18} />
                <p className="text-[12px] text-text truncate">{c.name}</p>
              </div>
              <div className="px-4 py-3"><p className="text-[12px] text-text">${c.spend.toFixed(2)}</p></div>
              <div className="px-4 py-3"><p className="text-[12px] text-text">{fmt(c.reach)}</p></div>
              <div className="px-4 py-3"><p className="text-[12px] text-text">{fmt(c.clicks)}</p></div>
              <div className="px-4 py-3"><p className="text-[12px] text-text">{c.ctr}%</p></div>
              <div className="px-4 py-3">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 capitalize">{c.status}</span>
              </div>
            </div>
          ))}
          {isMock && (
            <div className="absolute inset-0 pointer-events-none"
              style={{ backgroundColor: 'rgba(255,255,255,0.55)' }} />
          )}
        </div>
      </div>

      {isMock && <UpgradeCard />}
    </div>
  )
}

// ── Inbox tab ─────────────────────────────────────────────────────────────────

function InboxTab({ dataState, openConnectPanel }: { dataState: AnalyticsDataState; openConnectPanel: () => void }) {
  const isMock = dataState === 'mock'
  const inbox  = MOCK_ANALYTICS_INBOX

  if (!isMock && dataState !== 'live') {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-8 py-12 flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
          <MessageCircle size={20} className="text-gray-300" />
        </div>
        <div className="max-w-sm">
          <p className="text-[15px] font-semibold text-text mb-2">Connect social accounts to track comments and messages</p>
          <p className="text-sm text-text-sec leading-relaxed">
            See total comments, DMs, and response rate across all your connected platforms.
          </p>
        </div>
        <button onClick={openConnectPanel}
          className="flex items-center gap-2 bg-brand-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#2563EB] transition-colors">
          <Plus size={14} /> Connect accounts
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className={`relative grid grid-cols-3 gap-3 ${isMock ? 'pointer-events-none' : ''}`}>
        {[
          { label: 'Total Comments', value: `${inbox.totalComments}` },
          { label: 'Total DMs',      value: `${inbox.totalDMs}` },
          { label: 'Response Rate',  value: `${inbox.responseRate}%` },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white p-5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-soft">{label}</span>
              {isMock && <DemoPill />}
            </div>
            <p className="text-[22px] font-semibold text-text">{value}</p>
          </div>
        ))}
        {isMock && (
          <div className="absolute inset-0 rounded-xl pointer-events-none"
            style={{ backgroundColor: 'rgba(255,255,255,0.55)' }} />
        )}
      </div>

      {/* Platform breakdown */}
      <div className="rounded-2xl border border-gray-100 bg-white">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-text">Platform breakdown</p>
          {isMock && <DemoBadge />}
        </div>
        <div className="relative">
          <div className="grid grid-cols-4 gap-px bg-gray-100 border-b border-gray-100">
            {['Platform', 'Comments', 'DMs', 'Unread'].map(h => (
              <div key={h} className="bg-white px-5 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{h}</p>
              </div>
            ))}
          </div>
          {inbox.platforms.map((p, i) => (
            <div key={i} className="grid grid-cols-4 border-b border-gray-50 last:border-0">
              <div className="px-5 py-3 flex items-center gap-2">
                <PlatformAvatar id={p.platform} size={20} />
                <span className="text-[12px] font-medium text-text">{PLATFORM_META[p.platform]?.label ?? p.platform}</span>
              </div>
              <div className="px-5 py-3"><p className="text-[12px] text-text">{p.comments}</p></div>
              <div className="px-5 py-3"><p className="text-[12px] text-text">{p.dms}</p></div>
              <div className="px-5 py-3">
                {p.unread > 0
                  ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{p.unread} unread</span>
                  : <span className="text-[11px] text-text-soft">—</span>
                }
              </div>
            </div>
          ))}
          {isMock && (
            <div className="absolute inset-0 pointer-events-none"
              style={{ backgroundColor: 'rgba(255,255,255,0.55)' }} />
          )}
        </div>
      </div>

      {/* Engagement trend */}
      <div className="rounded-2xl border border-gray-100 bg-white">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-text">Engagement trend</p>
          {isMock && <DemoBadge />}
        </div>
        <div className="relative px-4 pt-4 pb-3">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={inbox.trend} barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f0f0f0' }} />
              <Bar dataKey="comments" fill="#3B82F6"  radius={[3, 3, 0, 0]} name="Comments" />
              <Bar dataKey="dms"      fill="#94A3B8" radius={[3, 3, 0, 0]} name="DMs" />
            </BarChart>
          </ResponsiveContainer>
          {isMock && (
            <div className="absolute inset-0 pointer-events-none rounded-b-2xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.55)' }} />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-[12px] text-text-sec leading-relaxed">
          Manage and reply to comments and DMs directly in Maya — coming soon.
        </p>
      </div>

      {isMock && <UpgradeCard />}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

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

  const [activeTab, setActiveTab]         = useState<Tab>('overview')
  const [range, setRange]                 = useState<Range>('7d')
  const [connectPanelOpen, setConnectPanelOpen] = useState(false)
  const [showGAModal, setShowGAModal]     = useState(false)
  const [showPropertySelector, setShowPropertySelector] = useState(false)
  const [oauthError, setOauthError]       = useState('')
  const [gaId, setGaId]                   = useState(gaMeasurementId)
  const [oauthConnected, setOauthConnected] = useState(gaOAuthConnected)
  const [gaData, setGaData]               = useState<GaData | null>(null)
  const [gaLoading, setGaLoading]         = useState(false)

  // Determine which platforms to show in the status strip
  const stripPlatforms = dataState === 'mock'
    ? MOCK_CONNECTED_PLATFORMS
    : zernioConnectedPlatforms

  // Maya canvas context
  useEffect(() => {
    const ctx = `ANALYTICS PAGE\nCompany: ${companyName}\nState: ${dataState}\nGA: ${gaId ? `Property ${gaId}` : 'Not connected'}\nZernio: ${zernioConnectedPlatforms.join(', ') || 'None'}`
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
        access_denied: 'Google sign-in was cancelled.',
        no_refresh_token: 'Could not get access token. Please try again.',
        save_failed: 'Failed to save connection. Please try again.',
      }
      setOauthError(msgs[gaError] ?? 'Something went wrong.')
      router.replace('/dashboard/analytics')
    }
  }, [searchParams, router])

  // Fetch GA data (only in live/empty state)
  const fetchGaData = useCallback(async () => {
    if (dataState === 'mock' || !gaId) return
    setGaLoading(true)
    try {
      const res  = await fetch(`/api/analytics/ga-data?range=${range}`)
      const json = await res.json()
      if (json.connected) setGaData(json)
    } catch { /* fail soft */ }
    finally { setGaLoading(false) }
  }, [dataState, gaId, range])

  useEffect(() => { fetchGaData() }, [fetchGaData])

  const handleGAConnect = () => oauthConnected ? setShowPropertySelector(true) : setShowGAModal(true)

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'social',   label: 'Social',   icon: TrendingUp },
    { id: 'ads',      label: 'Ads',      icon: DollarSign },
    { id: 'inbox',    label: 'Inbox',    icon: MessageCircle },
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

      {/* Connect panel */}
      <ConnectPanel
        open={connectPanelOpen}
        onClose={() => setConnectPanelOpen(false)}
        dataState={dataState}
      />

      {/* ── Header card ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 mb-5">
        <div className="px-8 pt-6 pb-5 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-soft mb-1.5">Analytics</p>
              <h1 className="text-[22px] font-[500] text-text leading-tight">Performance overview</h1>
              <p className="text-sm text-text-sec mt-1">
                {companyName ? `${companyName} · ` : ''}Website, social, and paid media
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 pt-1">
              <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-2 p-1">
                {(['7d', '30d', '90d'] as Range[]).map(r => (
                  <button key={r} onClick={() => setRange(r)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${range === r ? 'bg-brand-primary text-white shadow-sm' : 'text-text-sec hover:text-text'}`}>
                    {r === '7d' ? '7D' : r === '30d' ? '30D' : '90D'}
                  </button>
                ))}
              </div>
              <button disabled title="Coming in Phase 6"
                className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-brand-primary px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed">
                <Sparkles size={12} /> Generate briefing
              </button>
            </div>
          </div>

          {/* Connection status strip */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {/* GA pill */}
            <a href="#" onClick={e => { e.preventDefault(); if (!gaId) handleGAConnect() }}
              className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors no-underline ${gaId ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${gaId ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              GA4 · {gaId ? 'Connected' : 'Not connected'}
            </a>

            {/* Zernio / mock platform pills */}
            {stripPlatforms.map(p => (
              <span key={p}
                className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                <PlatformAvatar id={p} size={14} />
                {PLATFORM_META[p]?.label ?? p}
                {dataState === 'mock' && <DemoPill />}
              </span>
            ))}

            <button
              onClick={() => setConnectPanelOpen(true)}
              className="flex items-center gap-1 text-[11px] font-semibold text-brand-primary bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors">
              <Plus size={11} /> Connect more
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-gray-100 px-8">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 text-[13px] font-medium px-4 py-3.5 border-b-2 transition-colors -mb-px ${
                activeTab === id
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-text-sec hover:text-text'
              }`}>
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Non-dismissible amber banner (mock state only) */}
        {dataState === 'mock' && <AmberBanner />}
      </div>

      {/* Error toast */}
      {oauthError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-status-danger/20 bg-status-danger/10 px-4 py-3 mb-5">
          <p className="text-xs font-medium text-status-danger">{oauthError}</p>
          <button onClick={() => setOauthError('')} className="text-status-danger"><X size={14} /></button>
        </div>
      )}

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      <div className={`${dataState === 'mock' ? 'flex gap-5' : ''}`}>
        <div className="flex-1 min-w-0">
          {activeTab === 'overview' && (
            <OverviewTab
              dataState={dataState}
              gaId={gaId}
              gaData={gaData}
              gaLoading={gaLoading}
              onConnectGA={handleGAConnect}
              openConnectPanel={() => setConnectPanelOpen(true)}
            />
          )}
          {activeTab === 'social' && (
            <SocialTab dataState={dataState} openConnectPanel={() => setConnectPanelOpen(true)} />
          )}
          {activeTab === 'ads' && (
            <AdsTab dataState={dataState} openConnectPanel={() => setConnectPanelOpen(true)} />
          )}
          {activeTab === 'inbox' && (
            <InboxTab dataState={dataState} openConnectPanel={() => setConnectPanelOpen(true)} />
          )}
        </div>

        {/* Right sidebar (mock state only) */}
        {dataState === 'mock' && <MockSidebar />}
      </div>
    </div>
  )
}
