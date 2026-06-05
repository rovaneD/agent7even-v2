'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import {
  Globe, Info, Eye, MousePointerClick,
  X, CheckCircle, Clock, Wifi, RefreshCw, AlertCircle,
  DollarSign, Users, ExternalLink, ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Range = '7d' | '30d' | '90d'

interface Props {
  companyName: string
  plan: string
  gaMeasurementId: string | null
  gaOAuthConnected: boolean
  gaOAuthEmail: string | null
  metaConnected: boolean
  igHandle: string | null
  metaAdAccountId: string | null
}

interface MetaData {
  instagram?: {
    handle: string
    followers: number
    media_count: number
    insights: Array<{
      name: string
      values: Array<{ value: number; end_time: string }>
    }>
  }
  ads?: {
    daily: Array<{
      date: string
      spend: number
      clicks: number
      impressions: number
      reach: number
      conversions: number
    }>
    totals: {
      spend: number
      clicks: number
      impressions: number
      reach: number
      conversions: number
    }
  }
}

type GaStatus = 'loading' | 'connected' | 'pending' | 'error'

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

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Tiny shared components ─────────────────────────────────────────────────────

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
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors flex-shrink-0"
        aria-label="More info"
      >
        <Info size={11} />
      </button>
      {show && (
        <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-gray-900 text-white text-xs leading-relaxed rounded-xl px-3 py-2.5 shadow-xl pointer-events-none">
          <div className="absolute left-2 bottom-full w-2 h-2 bg-gray-900 rotate-45 mb-[-4px]" />
          {text}
        </div>
      )}
    </div>
  )
}

// ── Collapsible panel wrapper ──────────────────────────────────────────────────

function CollapsiblePanel({
  id,
  logoSrc,
  title,
  subtitle,
  badge,
  defaultOpen = true,
  children,
}: {
  id?: string
  logoSrc?: string
  title: string
  subtitle?: string
  badge?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div id={id} className="bg-white rounded-2xl border border-gray-100">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 rounded-t-2xl transition-colors"
      >
        <div className="flex items-center gap-3">
          {logoSrc && <BrandIcon src={logoSrc} alt={title} />}
          <div className="text-left">
            <p className="text-[13px] font-semibold text-text">{title}</p>
            {subtitle && <p className="text-[11px] text-text-soft mt-0.5">{subtitle}</p>}
          </div>
          {badge}
        </div>
        {open
          ? <ChevronUp size={15} className="text-gray-400 flex-shrink-0" />
          : <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />
        }
      </button>
      {open && <div className="border-t border-gray-100">{children}</div>}
    </div>
  )
}

// ── Metric card (unified bar) ─────────────────────────────────────────────────

function MetricCard({
  label, value, logoSrc, icon: Icon, notConnected, pending, linkLabel, onLink,
}: {
  label: string
  value: string
  logoSrc?: string
  icon?: React.ElementType
  notConnected?: boolean
  pending?: boolean
  linkLabel?: string
  onLink?: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-soft">{label}</span>
        {logoSrc
          ? <BrandIcon src={logoSrc} alt={label} />
          : Icon
            ? <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50"><Icon size={15} className="text-text-soft" /></div>
            : null
        }
      </div>
      {pending ? (
        <div>
          <p className="text-[22px] font-semibold text-text-soft">—</p>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3B82F6] mt-1">
            <Clock size={10} /> Review pending
          </span>
        </div>
      ) : notConnected ? (
        <div>
          <p className="text-[22px] font-semibold text-text-soft">—</p>
          {linkLabel && (
            <button onClick={onLink} className="text-[11px] text-brand-primary hover:underline mt-1 text-left">
              {linkLabel}
            </button>
          )}
        </div>
      ) : (
        <p className="text-[22px] font-semibold text-text">{value}</p>
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
        <div className="flex items-center gap-2.5 mb-3">
          {avatar}
          <span className="text-[13px] font-semibold text-text">Maya's briefing</span>
        </div>
        <p className="text-sm text-text-sec leading-relaxed">
          Connect at least one data source below to get Maya's performance read.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6" style={{ borderLeft: '4px solid #3B82F6' }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          {avatar}
          <span className="text-[13px] font-semibold text-text">Maya's briefing</span>
        </div>
        <button
          disabled
          className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-brand-primary px-4 py-2 rounded-xl hover:bg-[#2563EB] transition-colors flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
          title="Coming in Phase 2"
        >
          <Sparkles size={12} />
          Generate briefing
        </button>
      </div>
      <p className="text-sm text-text-sec leading-relaxed mt-3">Maya hasn't analyzed this week yet.</p>
      <p className="text-[11px] text-text-soft mt-1">Takes ~15 seconds · Uses 2 credits</p>
    </div>
  )
}

// ── GA Connect Modal ──────────────────────────────────────────────────────────

function GAConnectModal({
  onClose,
  onAgencySuccess,
  currentPropertyId,
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
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/analytics/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'google_analytics', value: value.trim() }),
      })
      if (!res.ok) throw new Error('Failed')
      onAgencySuccess(value.trim())
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <X size={14} className="text-gray-500" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <BrandIcon src="/google_analytics_icon.png" alt="Google Analytics" />
          <div>
            <p className="text-[11px] font-semibold tracking-widest uppercase text-text-soft">Connect</p>
            <h2 className="text-lg font-bold text-text leading-tight">Google Analytics</h2>
          </div>
        </div>

        {!showAgencyForm ? (
          <>
            <p className="text-sm text-text-sec mb-5 leading-relaxed">
              Sign in with Google to automatically connect your GA4 property and see live data.
            </p>
            <a
              href="/api/analytics/ga-connect"
              className="flex items-center justify-center gap-3 w-full py-3 bg-white border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all text-sm font-semibold text-gray-700 mb-4"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </a>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-gray-400">or</span>
              </div>
            </div>
            <button
              onClick={() => setShowAgencyForm(true)}
              className="w-full py-2.5 text-sm font-medium text-text-sec hover:text-text transition-colors"
            >
              Set up with Agent7even's help →
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-text-sec mb-5 leading-relaxed">
              Enter your GA4 Property ID and our team will complete the connection for you.
            </p>
            <label className="block text-xs font-semibold text-text mb-1.5">GA4 Property ID</label>
            <input
              type="text"
              value={value}
              onChange={e => { setValue(e.target.value); setError('') }}
              placeholder="123456789"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-text placeholder-gray-300 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors"
            />
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              Find this in Google Analytics → Admin → Property Settings → Property ID.
            </p>
            {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowAgencyForm(false)}
                className="flex-1 py-2.5 text-sm font-medium text-text-sec border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
              >
                Back
              </button>
              <button
                onClick={submitAgency}
                disabled={loading}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand-primary rounded-xl hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
              >
                {loading ? 'Saving…' : 'Request connection'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Property Selector Modal ───────────────────────────────────────────────────

function PropertySelectorModal({
  oauthEmail,
  onClose,
  onSelect,
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
        if (d.error) {
          setError(`API error (${d.errorCode ?? '?'}): ${d.error}`)
        } else {
          setProperties(d.properties ?? [])
          if (d.properties?.length === 1) setSelected(d.properties[0].id)
        }
      })
      .catch(() => setError('Could not load properties. Try refreshing.'))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    if (!selected) { setError('Please select a property.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/analytics/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'google_analytics', value: selected }),
      })
      if (!res.ok) throw new Error('Failed')
      onSelect(selected)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <X size={14} className="text-gray-500" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <CheckCircle size={18} className="text-emerald-500" />
          <p className="text-[10px] font-semibold tracking-widest uppercase text-emerald-600">Google Connected</p>
        </div>
        <h2 className="text-lg font-bold text-text mb-1">Select your property</h2>
        {oauthEmail && (
          <p className="text-xs text-gray-400 mb-5">Signed in as <span className="font-medium text-text-sec">{oauthEmail}</span></p>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-text font-medium mb-2">No GA4 properties found</p>
            <p className="text-xs text-text-sec leading-relaxed mb-4">
              The Google account you signed in with doesn't have access to any GA4 properties.
            </p>
            <a
              href="/api/analytics/ga-connect"
              className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-brand-primary px-4 py-2.5 rounded-lg hover:bg-[#2563EB] transition-colors"
            >
              Try a different Google account
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {properties.map(p => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${
                  selected === p.id
                    ? 'border-brand-primary bg-blue-50'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
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
          <button
            onClick={save}
            disabled={saving || !selected}
            className="w-full mt-5 py-3 text-sm font-semibold text-white bg-brand-primary rounded-xl hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Connecting…' : 'Connect property'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── GA panel content ──────────────────────────────────────────────────────────

function GAContent({
  propertyId,
  oauthConnected,
  range,
  onConnect,
  onSessionsLoaded,
  onDisconnect,
}: {
  propertyId: string | null
  oauthConnected: boolean
  range: Range
  onConnect: () => void
  onSessionsLoaded: (n: number | null) => void
  onDisconnect: () => void
}) {
  const [status, setStatus] = useState<GaStatus>('loading')
  const [data, setData] = useState<GaData | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  const disconnect = async () => {
    if (!confirm('Disconnect Google Analytics? This will clear your property ID and OAuth connection.')) return
    setDisconnecting(true)
    await fetch('/api/analytics/disconnect', { method: 'POST' })
    setDisconnecting(false)
    onDisconnect()
  }

  const fetchData = useCallback(async () => {
    if (!propertyId) { setStatus('pending'); onSessionsLoaded(null); return }
    setStatus('loading')
    try {
      const res = await fetch(`/api/analytics/ga-data?range=${range}`)
      const json = await res.json()
      if (json.connected) {
        setData(json); setStatus('connected'); onSessionsLoaded(json.summary.sessions)
      } else {
        setStatus('pending'); onSessionsLoaded(null)
      }
    } catch {
      setStatus('error'); onSessionsLoaded(null)
    }
  }, [propertyId, range, onSessionsLoaded])

  useEffect(() => { fetchData() }, [fetchData])

  // Not connected — clean empty state, no blurred chart
  if (!propertyId) {
    return (
      <div className="px-8 py-10 flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
          <Globe size={20} className="text-gray-300" />
        </div>
        <div className="max-w-sm">
          <p className="text-[14px] font-semibold text-text mb-2">See what's driving traffic to your website</p>
          <p className="text-sm text-text-sec leading-relaxed">
            Connect Google Analytics to track sessions, top pages, and where your visitors come from — so Maya knows which content is working.
          </p>
        </div>
        <button
          onClick={onConnect}
          className="flex items-center gap-2 bg-brand-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#2563EB] transition-colors"
        >
          {oauthConnected ? 'Select property' : 'Connect Google Analytics'}
          <ExternalLink size={13} />
        </button>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Connected — chart + stats
  if (status === 'connected' && data) {
    const chartData = data.chartData.map(d => ({
      ...d,
      day: d.day.length === 8 ? `${d.day.slice(4, 6)}/${d.day.slice(6, 8)}` : d.day,
    }))
    return (
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100 border-b border-gray-100">
          {[
            { label: 'Sessions',     value: fmt(data.summary.sessions) },
            { label: 'Users',        value: fmt(data.summary.users) },
            { label: 'Pageviews',    value: fmt(data.summary.pageviews) },
            { label: 'Bounce rate',  value: `${data.summary.bounceRate}%` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white px-5 py-3">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
              <p className="text-[17px] font-semibold text-text mt-0.5">{value}</p>
            </div>
          ))}
        </div>
        <div className="px-5 pt-5 pb-4">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={32} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #f0f0f0' }} />
              <Line type="monotone" dataKey="sessions" stroke="#3B82F6" strokeWidth={2} dot={false} name="Sessions" />
              <Line type="monotone" dataKey="users" stroke="#94A3B8" strokeWidth={2} dot={false} name="Users" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-between mt-1 px-1">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400"><span className="w-3 h-0.5 bg-brand-primary inline-block rounded" />Sessions</span>
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400"><span className="w-3 h-0.5 bg-[#94A3B8] inline-block rounded" />Users</span>
            </div>
            <button
              onClick={disconnect}
              disabled={disconnecting}
              className="text-[10px] text-gray-300 hover:text-gray-500 underline underline-offset-2 transition-colors disabled:opacity-50"
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Pending — property ID set but awaiting team connection. No blurred chart.
  return (
    <div className="px-8 py-10 flex flex-col items-center gap-4 text-center">
      <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
        <Clock size={20} className="text-amber-500" />
      </div>
      <div className="max-w-sm">
        <p className="text-[14px] font-semibold text-text mb-2">Connection requested</p>
        <p className="text-sm text-text-sec leading-relaxed">
          Your Agent7even team has your Property ID and will complete the connection soon. You'll see live data here once it's active.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={onConnect} className="text-sm font-medium text-brand-primary hover:underline">
          Connect instantly with Google →
        </button>
        <button
          onClick={disconnect}
          disabled={disconnecting}
          className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors disabled:opacity-50"
        >
          {disconnecting ? 'Disconnecting…' : 'Reset'}
        </button>
      </div>
    </div>
  )
}

// ── Instagram panel content ───────────────────────────────────────────────────

function InstagramContent({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="px-6 py-6">
      {/* Honest pending state */}
      <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-4 mb-6">
        <div className="w-6 h-6 rounded-full bg-[#3B82F6] flex items-center justify-center flex-shrink-0 mt-0.5">
          <Clock size={11} className="text-white" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[#1D4ED8] mb-1">
            Meta is reviewing our access to Instagram insights
          </p>
          <p className="text-xs text-[#3B82F6]/80 leading-relaxed">
            This usually takes a few days to weeks. We'll notify you when follower data, reach, and impressions become available. No action needed on your end.
          </p>
        </div>
      </div>

      {/* Preview of what will show when live */}
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-soft mb-3">When live, you'll see:</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Follower growth', icon: Users },
          { label: 'Reach & impressions', icon: Eye },
          { label: 'Top posts', icon: Sparkles },
          { label: 'Best day to post', icon: Globe },
        ].map(({ label, icon: Icon }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
            <Icon size={16} className="text-gray-300 mx-auto mb-1.5" />
            <p className="text-[11px] text-text-soft">{label}</p>
          </div>
        ))}
      </div>

      {/* Connect CTA (if not already) */}
      <div className="flex items-center gap-3">
        <button
          onClick={onConnect}
          className="text-sm font-medium text-brand-primary hover:underline"
        >
          Connect Instagram & Meta →
        </button>
      </div>
    </div>
  )
}

// ── Meta Ads panel content ────────────────────────────────────────────────────

function MetaAdsContent({
  connected,
  accountId,
  loading,
  metaData,
  onConnect,
  onDisconnect,
}: {
  connected: boolean
  accountId: string | null
  loading: boolean
  metaData: MetaData | null
  onConnect: () => void
  onDisconnect: () => void
}) {
  if (!connected) {
    return (
      <div className="px-8 py-10 flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
          <MousePointerClick size={20} className="text-gray-300" />
        </div>
        <div className="max-w-sm">
          <p className="text-[14px] font-semibold text-text mb-2">Track your ad spend and results</p>
          <p className="text-sm text-text-sec leading-relaxed">
            Connect Meta Ads to see spend, reach, and CTR — and let Maya flag when your creative needs refreshing.
          </p>
        </div>
        <button
          onClick={onConnect}
          className="flex items-center gap-2 bg-brand-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#2563EB] transition-colors"
        >
          Connect Instagram & Meta
          <ExternalLink size={13} />
        </button>
      </div>
    )
  }

  const adTotals = metaData?.ads?.totals
  const adsChartData = metaData?.ads?.daily.map(d => ({
    day: fmtDate(d.date),
    spend: d.spend,
    clicks: d.clicks,
  })) ?? []

  return (
    <div>
      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : adsChartData.length > 0 && adTotals ? (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100 border-b border-gray-100">
            {[
              { label: 'Spend',        value: `$${adTotals.spend.toFixed(2)}` },
              { label: 'Reach',        value: fmt(adTotals.reach) },
              { label: 'Clicks',       value: fmt(adTotals.clicks) },
              { label: 'CTR',          value: `${((adTotals.clicks / Math.max(adTotals.impressions, 1)) * 100).toFixed(2)}%` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white px-5 py-3">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                <p className="text-[17px] font-semibold text-text mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          <div className="px-5 pt-5 pb-4">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-3">Daily spend & clicks</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={adsChartData} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="spend" fill="#3B82F6" radius={[3, 3, 0, 0]} name="Spend ($)" />
                <Bar yAxisId="right" dataKey="clicks" fill="#94A3B8" radius={[3, 3, 0, 0]} name="Clicks" />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-end mt-3">
              <button
                onClick={onDisconnect}
                className="text-[10px] text-gray-300 hover:text-gray-500 underline underline-offset-2 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-6 py-10 flex flex-col items-center text-center gap-2">
          <p className="text-sm font-medium text-text">No ad data found</p>
          <p className="text-xs text-text-sec max-w-sm">Make sure you have active campaigns in Meta Ads Manager. Data may take 24 hours to appear.</p>
          <button onClick={onDisconnect} className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({
  connected, pendingLabel, label, href,
}: {
  connected?: boolean
  pendingLabel?: string
  label: string
  href?: string
}) {
  const base = 'flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors no-underline'
  if (pendingLabel) {
    return (
      <a href={href} className={`${base} bg-blue-50 text-[#3B82F6]`}>
        <Clock size={10} /> {label} · {pendingLabel}
      </a>
    )
  }
  return (
    <a href={href} className={`${base} ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-gray-300'}`} />
      {label} · {connected ? 'Connected' : 'Not connected'}
    </a>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AnalyticsClient({
  companyName,
  gaMeasurementId,
  gaOAuthConnected,
  gaOAuthEmail,
  metaConnected: initialMetaConnected,
  igHandle: initialIgHandle,
  metaAdAccountId,
}: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [range, setRange] = useState<Range>('7d')
  const [showGAModal, setShowGAModal] = useState(false)
  const [showPropertySelector, setShowPropertySelector] = useState(false)
  const [oauthError, setOauthError] = useState('')
  const [liveSessions, setLiveSessions] = useState<number | null>(null)

  const [gaId, setGaId] = useState(gaMeasurementId)
  const [oauthConnected, setOauthConnected] = useState(gaOAuthConnected)

  const [metaConnected, setMetaConnected] = useState(initialMetaConnected)
  const [igHandle] = useState(initialIgHandle)
  const [metaData, setMetaData] = useState<MetaData | null>(null)
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)

  const anySourceConnected = !!gaId || metaConnected

  // Maya canvas context
  useEffect(() => {
    const context = `ANALYTICS PAGE
Company: ${companyName}
Google Analytics: ${gaOAuthConnected ? `Connected (OAuth) — property ID: ${gaMeasurementId ?? 'not selected'}` : gaMeasurementId ? `Property ID set (${gaMeasurementId}), awaiting team connection` : 'Not connected'}
Instagram/Meta: ${initialMetaConnected ? `Connected${initialIgHandle ? ` — @${initialIgHandle}` : ''}` : 'Not connected'}
Instagram insights: Pending Meta app review`
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context } }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // GA OAuth redirect
  useEffect(() => {
    const oauthStatus = searchParams.get('ga_oauth')
    const gaError = searchParams.get('ga_error')
    if (oauthStatus === 'success') {
      setOauthConnected(true)
      setShowPropertySelector(true)
      router.replace('/dashboard/analytics')
    } else if (gaError) {
      const msgs: Record<string, string> = {
        access_denied: 'Google sign-in was cancelled.',
        no_refresh_token: 'Could not get access token. Please try again.',
        save_failed: 'Failed to save connection. Please try again.',
      }
      setOauthError(msgs[gaError] ?? 'Something went wrong. Please try again.')
      router.replace('/dashboard/analytics')
    }
  }, [searchParams, router])

  // Meta OAuth redirect
  useEffect(() => {
    if (searchParams.get('meta_connected') === 'true') {
      setMetaConnected(true)
      window.history.replaceState({}, '', '/dashboard/analytics')
    }
    if (searchParams.get('meta_error')) {
      setMetaError('Failed to connect Meta. Please try again.')
      window.history.replaceState({}, '', '/dashboard/analytics')
    }
  }, [searchParams])

  const fetchMetaData = useCallback(async () => {
    if (!metaConnected) return
    setMetaLoading(true)
    setMetaError(null)
    try {
      const res = await fetch(`/api/analytics/meta-data?range=${range}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setMetaData(data)
    } catch {
      setMetaError('Failed to load Meta data. Please try again.')
    } finally {
      setMetaLoading(false)
    }
  }, [metaConnected, range])

  useEffect(() => { fetchMetaData() }, [fetchMetaData])

  async function handleMetaDisconnect() {
    await fetch('/api/analytics/meta-disconnect', { method: 'POST' })
    setMetaConnected(false)
    setMetaData(null)
  }

  const handleGAConnect = () => {
    if (oauthConnected) {
      setShowPropertySelector(true)
    } else {
      setShowGAModal(true)
    }
  }

  const adTotals = metaData?.ads?.totals
  const igFollowers = metaData?.instagram?.followers

  return (
    <div className="mx-auto max-w-[1240px] px-8 py-6 space-y-5">

      {/* Modals */}
      {showGAModal && (
        <GAConnectModal
          currentPropertyId={gaId ?? ''}
          onClose={() => setShowGAModal(false)}
          onAgencySuccess={(value) => { setGaId(value); setShowGAModal(false) }}
        />
      )}
      {showPropertySelector && (
        <PropertySelectorModal
          oauthEmail={gaOAuthEmail}
          onClose={() => setShowPropertySelector(false)}
          onSelect={(propertyId) => { setGaId(propertyId); setShowPropertySelector(false) }}
        />
      )}

      {/* Error toasts */}
      {oauthError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-status-danger/20 bg-status-danger/10 px-4 py-3">
          <p className="text-xs font-medium text-status-danger">{oauthError}</p>
          <button onClick={() => setOauthError('')} className="text-status-danger">
            <X size={14} />
          </button>
        </div>
      )}
      {metaError && (
        <div className="flex items-center gap-3 rounded-xl border border-status-danger/20 bg-status-danger/10 px-4 py-3">
          <AlertCircle size={15} className="flex-shrink-0 text-status-danger" />
          <p className="text-sm text-status-danger">{metaError}</p>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="px-8 pt-6 pb-5">
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
                {(['7d', '30d', '90d'] as Range[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      range === r ? 'bg-brand-primary text-white shadow-sm' : 'text-text-sec hover:text-text'
                    }`}
                  >
                    {r === '7d' ? '7D' : r === '30d' ? '30D' : '90D'}
                  </button>
                ))}
              </div>
              <button
                disabled
                title="Generate briefing — available after connecting a data source"
                className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-brand-primary px-4 py-2 rounded-xl hover:bg-[#2563EB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles size={12} />
                Generate briefing
              </button>
            </div>
          </div>

          {/* Connection status pills */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <StatusPill
              connected={!!gaId}
              label="GA4"
              href="#ga-panel"
            />
            <StatusPill
              pendingLabel="Review pending"
              label="Instagram"
              href="#ig-panel"
            />
            <StatusPill
              connected={metaConnected}
              label="Meta Ads"
              href="#meta-panel"
            />
          </div>
        </div>
      </div>

      {/* ── Maya's briefing card ────────────────────────────────────────────── */}
      <MayaBriefingCard hasSource={anySourceConnected} />

      {/* ── Unified metrics bar ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="GA Sessions"
          value={liveSessions !== null ? fmt(liveSessions) : '—'}
          logoSrc="/google_analytics_icon.png"
          notConnected={liveSessions === null}
          linkLabel={!gaId ? 'Connect GA →' : undefined}
          onLink={handleGAConnect}
        />
        <MetricCard
          label="Instagram Followers"
          value={igFollowers ? fmt(igFollowers) : '—'}
          logoSrc="/instagram-logo.png"
          pending
        />
        <MetricCard
          label="Total Reach"
          value={adTotals?.reach ? fmt(adTotals.reach) : '—'}
          icon={Eye}
          notConnected={!metaConnected}
        />
        <MetricCard
          label="Ad Spend"
          value={adTotals?.spend ? `$${adTotals.spend.toFixed(2)}` : '—'}
          logoSrc="/MetaLogo.png"
          notConnected={!metaConnected}
          linkLabel={!metaConnected ? 'Connect Meta →' : undefined}
          onLink={() => { window.location.href = '/api/analytics/meta-connect' }}
        />
      </div>

      {/* Cross-channel insight line — shows when 2+ sources connected */}
      {gaId && metaConnected && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
          <Sparkles size={13} className="text-[#3B82F6] flex-shrink-0" />
          <p className="text-xs text-[#3B82F6]">
            Cross-channel insight: generate a briefing to see how Instagram and paid traffic compare this {range === '7d' ? 'week' : range === '30d' ? 'month' : 'quarter'}.
          </p>
        </div>
      )}

      {/* ── Google Analytics panel ──────────────────────────────────────────── */}
      <CollapsiblePanel
        id="ga-panel"
        logoSrc="/google_analytics_icon.png"
        title="Google Analytics"
        subtitle={gaId ? `GA4 · Property ${gaId}` : undefined}
        badge={
          gaId ? (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full ml-2">
              <Wifi size={10} /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full ml-2">
              Not connected
            </span>
          )
        }
        defaultOpen
      >
        <GAContent
          propertyId={gaId}
          oauthConnected={oauthConnected}
          range={range}
          onConnect={handleGAConnect}
          onSessionsLoaded={setLiveSessions}
          onDisconnect={() => { setGaId(null); setOauthConnected(false); setLiveSessions(null) }}
        />
      </CollapsiblePanel>

      {/* ── Instagram panel ─────────────────────────────────────────────────── */}
      <CollapsiblePanel
        id="ig-panel"
        logoSrc="/instagram-logo.png"
        title="Instagram"
        subtitle={igHandle ? `@${igHandle}` : undefined}
        badge={
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#3B82F6] bg-blue-50 px-2.5 py-1 rounded-full ml-2">
            <Clock size={10} /> Review pending
          </span>
        }
        defaultOpen
      >
        <InstagramContent
          onConnect={() => { window.location.href = '/api/analytics/meta-connect' }}
        />
      </CollapsiblePanel>

      {/* ── Meta Ads panel ──────────────────────────────────────────────────── */}
      <CollapsiblePanel
        id="meta-panel"
        logoSrc="/MetaLogo.png"
        title="Meta Ads"
        subtitle={metaAdAccountId ? `Account ${metaAdAccountId}` : undefined}
        badge={
          metaConnected ? (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full ml-2">
              <Wifi size={10} /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full ml-2">
              Not connected
            </span>
          )
        }
        defaultOpen={metaConnected}
      >
        <MetaAdsContent
          connected={metaConnected}
          accountId={metaAdAccountId}
          loading={metaLoading}
          metaData={metaData}
          onConnect={() => { window.location.href = '/api/analytics/meta-connect' }}
          onDisconnect={handleMetaDisconnect}
        />
      </CollapsiblePanel>

    </div>
  )
}
