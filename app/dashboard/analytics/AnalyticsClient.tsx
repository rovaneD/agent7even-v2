'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import {
  Globe, Hash, Info, Eye, MousePointerClick,
  Lock, Calendar, ArrowUpRight, ArrowDownRight,
  X, CheckCircle, Clock, Wifi, RefreshCw, AlertCircle, DollarSign, Users, ExternalLink,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Dummy chart data ──────────────────────────────────────────────────────────

const websiteData7d = [
  { day: 'Mon', sessions: 142, users: 118 },
  { day: 'Tue', sessions: 189, users: 154 },
  { day: 'Wed', sessions: 201, users: 167 },
  { day: 'Thu', sessions: 176, users: 143 },
  { day: 'Fri', sessions: 224, users: 191 },
  { day: 'Sat', sessions: 98, users: 82 },
  { day: 'Sun', sessions: 87, users: 71 },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n}`
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function BrandIcon({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
      <img src={src} alt={alt} className="w-5 h-5 object-contain" />
    </div>
  )
}

function StatCard({
  label, value, delta, icon: Icon, logoSrc, locked, prefix = '',
}: {
  label: string
  value: string
  delta?: number
  icon: React.ElementType
  logoSrc?: string
  locked?: boolean
  prefix?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
        {logoSrc ? (
          <BrandIcon src={logoSrc} alt={label} />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
            <Icon size={15} className="text-gray-400" />
          </div>
        )}
      </div>
      {locked ? (
        <div className="flex items-center gap-2">
          <Lock size={14} className="text-gray-300" />
          <span className="text-sm text-gray-300">Not connected</span>
        </div>
      ) : (
        <div className="flex items-end justify-between">
          <span className="text-2xl font-semibold text-gray-900">{prefix}{value}</span>
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

function ConnectedBadge({ label, onDisconnect }: { label: string; onDisconnect?: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
        <CheckCircle size={11} />
        {label}
      </span>
      {onDisconnect && (
        <button onClick={onDisconnect} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          Disconnect
        </button>
      )}
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
            <p className="text-[10px] font-semibold tracking-widest uppercase text-[#64748B]">Connect</p>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">Google Analytics</h2>
          </div>
        </div>

        {!showAgencyForm ? (
          <>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
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
              className="w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Set up with Agent7even's help →
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              Enter your GA4 Property ID and our team will complete the connection for you.
            </p>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">GA4 Property ID</label>
            <input
              type="text"
              value={value}
              onChange={e => { setValue(e.target.value); setError('') }}
              placeholder="123456789"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-colors"
            />
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              Find this in Google Analytics → Admin → Property Settings → Property ID (the numeric ID, not the G-... code).
            </p>
            {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowAgencyForm(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
              >
                Back
              </button>
              <button
                onClick={submitAgency}
                disabled={loading}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#2D3748] rounded-xl hover:bg-[#1a2535] disabled:opacity-50 transition-colors"
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

interface GAProperty { id: string; name: string; account?: string }

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
        <h2 className="text-lg font-bold text-gray-900 mb-1">Select your property</h2>
        {oauthEmail && (
          <p className="text-xs text-gray-400 mb-5">Signed in as <span className="font-medium text-gray-600">{oauthEmail}</span></p>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="w-6 h-6 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-600 font-medium mb-2">No GA4 properties found</p>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              The Google account you signed in with doesn't have access to any GA4 properties.
            </p>
            <a
              href="/api/analytics/ga-connect"
              className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-[#2D3748] px-4 py-2.5 rounded-lg hover:bg-[#1a2535] transition-colors"
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
                    ? 'border-[#3B82F6] bg-orange-50'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.account ? `${p.account} · ` : ''}ID: {p.id}</p>
                </div>
                {selected === p.id && <CheckCircle size={16} className="text-[#64748B] flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

        {properties.length > 0 && (
          <button
            onClick={save}
            disabled={saving || !selected}
            className="w-full mt-5 py-3 text-sm font-semibold text-white bg-[#2D3748] rounded-xl hover:bg-[#1a2535] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Connecting…' : 'Connect property'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Locked section with blurred chart preview ─────────────────────────────────

function LockedPreviewSection({
  title, description, logoSrc, icon: Icon, tooltip, connectHref, connectLabel,
}: {
  title: string
  description: string
  logoSrc?: string
  icon: React.ElementType
  tooltip: string
  connectHref: string
  connectLabel: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100">
      <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between rounded-t-2xl overflow-visible">
        <div className="flex items-center gap-3">
          {logoSrc ? <BrandIcon src={logoSrc} alt={title} /> : (
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
              <Icon size={16} className="text-gray-400" />
            </div>
          )}
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          <InfoTooltip text={tooltip} />
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">
          <Lock size={11} /> Not connected
        </span>
      </div>
      <div className="relative px-6 pt-6 pb-2 select-none pointer-events-none" aria-hidden="true">
        <div className="blur-sm opacity-20">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={[
              { d: 'M', v: 142 }, { d: 'T', v: 189 }, { d: 'W', v: 201 },
              { d: 'T', v: 176 }, { d: 'F', v: 224 }, { d: 'S', v: 98 }, { d: 'S', v: 87 },
            ]} barSize={14}>
              <Bar dataKey="v" fill="#3B82F6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/70">
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800 mb-1">{description}</p>
            <p className="text-xs text-gray-400">Connect your account to see live data here.</p>
          </div>
          <a
            href={connectHref}
            className="inline-flex items-center gap-2 bg-[#2D3748] text-white text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-[#1a2535] transition-colors pointer-events-auto"
          >
            {connectLabel}
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
      <div className="h-16" />
    </div>
  )
}

// ── Live GA section ───────────────────────────────────────────────────────────

type GaStatus = 'loading' | 'connected' | 'pending' | 'error'

interface GaData {
  chartData: { day: string; sessions: number; users: number }[]
  summary: { sessions: number; users: number; pageviews: number; bounceRate: string }
}

function WebsiteAnalyticsSection({
  propertyId, oauthConnected, range, tooltip, onConnect, onSessionsLoaded, onDisconnect,
}: {
  propertyId: string | null
  oauthConnected: boolean
  range: Range
  tooltip: string
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

  const header = (badge: React.ReactNode) => (
    <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between rounded-t-2xl overflow-visible">
      <div className="flex items-center gap-3">
        <BrandIcon src="/google_analytics_icon.png" alt="Google Analytics" />
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Google Analytics</h3>
          {propertyId && (
            <p className="text-xs text-gray-400">GA4 · Property {propertyId}</p>
          )}
        </div>
        <InfoTooltip text={tooltip} />
      </div>
      {badge}
    </div>
  )

  if (!propertyId) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100">
        {header(
          <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">
            <Lock size={11} /> Not connected
          </span>
        )}
        <div className="relative px-6 pt-6 pb-2 select-none pointer-events-none" aria-hidden="true">
          <div className="blur-sm opacity-30">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={websiteData7d} barSize={14}>
                <Bar dataKey="sessions" fill="#3B82F6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/60">
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-800 mb-1">Connect Google Analytics to track sessions, users, and pageviews.</p>
              {oauthConnected
                ? <p className="text-xs text-gray-400">Google is connected — select your property to start seeing data.</p>
                : <p className="text-xs text-gray-400">Connect your account to see live data here.</p>
              }
            </div>
            <button
              onClick={onConnect}
              className="inline-flex items-center gap-2 bg-[#2D3748] text-white text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-[#1a2535] transition-colors pointer-events-auto"
            >
              {oauthConnected ? 'Select property' : 'Connect Google Analytics'}
            </button>
          </div>
        </div>
        <div className="h-16 rounded-b-2xl overflow-hidden" />
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100">
        {header(
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
            <RefreshCw size={11} className="animate-spin" /> Loading…
          </span>
        )}
        <div className="h-48 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (status === 'connected' && data) {
    const chartData = data.chartData.map(d => ({
      ...d,
      day: d.day.length === 8 ? `${d.day.slice(4, 6)}/${d.day.slice(6, 8)}` : d.day,
    }))
    return (
      <div className="bg-white rounded-2xl border border-gray-100">
        {header(
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            <Wifi size={11} /> Connected
          </span>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100 border-b border-gray-100">
          {[
            { label: 'Sessions', value: fmt(data.summary.sessions) },
            { label: 'Users', value: fmt(data.summary.users) },
            { label: 'Pageviews', value: fmt(data.summary.pageviews) },
            { label: 'Bounce rate', value: `${data.summary.bounceRate}%` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white px-5 py-3">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
              <p className="text-lg font-semibold text-gray-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
        <div className="px-4 pt-5 pb-3">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={32} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #f0f0f0' }} />
              <Line type="monotone" dataKey="sessions" stroke="#3B82F6" strokeWidth={2} dot={false} name="Sessions" />
              <Line type="monotone" dataKey="users" stroke="#e8a87c" strokeWidth={2} dot={false} name="Users" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-between mt-1 px-1">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400"><span className="w-3 h-0.5 bg-[#2D3748] inline-block rounded" />Sessions</span>
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400"><span className="w-3 h-0.5 bg-[#e8a87c] inline-block rounded" />Users</span>
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

  // Pending state
  return (
    <div className="bg-white rounded-2xl border border-gray-100">
      {header(
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors" title="Retry">
            <RefreshCw size={11} className="text-gray-400" />
          </button>
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
            <Clock size={11} /> Pending
          </span>
        </div>
      )}
      <div className="relative px-6 pt-6 pb-2 select-none pointer-events-none" aria-hidden="true">
        <div className="blur-sm opacity-20">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={websiteData7d} barSize={14}>
              <Bar dataKey="sessions" fill="#3B82F6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70 px-6">
          <CheckCircle size={20} className="text-amber-500" />
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800 mb-1">Connection requested</p>
            <p className="text-xs text-gray-500 leading-relaxed max-w-sm">
              Your Agent7even team has your Property ID and will complete the connection for you. You'll see live data here once it's active.
            </p>
            <p className="text-xs text-gray-400 mt-3">
              Want to connect instantly?{' '}
              <button onClick={onConnect} className="font-semibold text-[#64748B] underline underline-offset-2 pointer-events-auto hover:text-[#b8471f]">
                Use Google sign-in instead →
              </button>
            </p>
            <button
              onClick={disconnect}
              disabled={disconnecting}
              className="mt-3 text-xs text-gray-300 hover:text-gray-500 underline underline-offset-2 pointer-events-auto transition-colors disabled:opacity-50"
            >
              {disconnecting ? 'Disconnecting…' : 'Reset connection'}
            </button>
          </div>
        </div>
      </div>
      <div className="h-16 rounded-b-2xl overflow-hidden" />
    </div>
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
  const [igHandle, setIgHandle] = useState(initialIgHandle)
  const [metaData, setMetaData] = useState<MetaData | null>(null)
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)

  useEffect(() => {
    const context = `ANALYTICS PAGE
Company: ${companyName}
Google Analytics: ${gaOAuthConnected ? `Connected (OAuth) — property ID: ${gaMeasurementId ?? 'not selected'}` : gaMeasurementId ? `Property ID set (${gaMeasurementId}), awaiting team connection` : 'Not connected'}
Instagram/Meta: ${initialMetaConnected ? `Connected${initialIgHandle ? ` — @${initialIgHandle}` : ''}` : 'Not connected'}
The user can connect Google Analytics and Meta/Instagram to view live performance data.`
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context } }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle GA OAuth redirect params
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

  // Handle Meta OAuth redirect params
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
      if (data.instagram?.handle) setIgHandle(data.instagram.handle)
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
    setIgHandle(null)
  }

  const handleGAConnect = () => {
    if (oauthConnected) {
      setShowPropertySelector(true)
    } else {
      setShowGAModal(true)
    }
  }

  const adTotals = metaData?.ads?.totals
  const igChartData = metaData?.instagram?.insights
    ?.find(m => m.name === 'reach')
    ?.values.map(v => ({ day: fmtDate(v.end_time), reach: v.value })) ?? []
  const adsChartData = metaData?.ads?.daily.map(d => ({
    day: fmtDate(d.date),
    spend: d.spend,
    clicks: d.clicks,
  })) ?? []

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">

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
        <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <p className="text-xs text-red-600 font-medium">{oauthError}</p>
          <button onClick={() => setOauthError('')} className="text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}
      {metaError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{metaError}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {companyName ? `${companyName} — ` : ''}Performance overview
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {(['7d', '30d', '90d'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                range === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {r === '7d' ? '7D' : r === '30d' ? '30D' : '90D'}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="GA sessions"
          value={liveSessions !== null ? fmt(liveSessions) : '—'}
          icon={Globe}
          logoSrc="/google_analytics_icon.png"
          locked={liveSessions === null}
        />
        <StatCard
          label="Instagram followers"
          value={metaData?.instagram?.followers ? fmt(metaData.instagram.followers) : '—'}
          icon={Users}
          logoSrc="/instagram-logo.png"
          locked={!metaConnected}
        />
        <StatCard
          label="Total reach"
          value={adTotals?.reach ? fmt(adTotals.reach) : '—'}
          icon={Eye}
          locked={!metaConnected}
        />
        <StatCard
          label="Ad spend"
          value={adTotals?.spend ? adTotals.spend.toFixed(2) : '—'}
          icon={DollarSign}
          logoSrc="/MetaLogo.png"
          locked={!metaConnected}
          prefix={adTotals?.spend ? '$' : ''}
        />
      </div>

      {/* Notice banner */}
      {liveSessions === null && !metaConnected && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <Calendar size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 leading-relaxed">
            <span className="font-semibold">Connect your accounts to see live data.</span>{' '}
            Link Google Analytics for website traffic, and Meta for Instagram and ad performance.
            Your Agent7even team can also help —{' '}
            <a href="/dashboard/support" className="font-semibold underline underline-offset-2 hover:text-amber-900 transition-colors">reach out via Support</a>.
          </p>
        </div>
      )}

      {/* Google Analytics */}
      <WebsiteAnalyticsSection
        propertyId={gaId}
        oauthConnected={oauthConnected}
        range={range}
        tooltip="Connect Google Analytics to see live sessions, users, and pageviews. Use 'Connect with Google' for instant setup, or choose the agency-assisted option if you prefer."
        onConnect={handleGAConnect}
        onSessionsLoaded={setLiveSessions}
        onDisconnect={() => { setGaId(null); setOauthConnected(false); setLiveSessions(null) }}
      />

      {/* Instagram */}
      {!metaConnected ? (
        <LockedPreviewSection
          title="Instagram"
          description="Connect Instagram to track followers, reach, and impressions."
          icon={Hash}
          logoSrc="/instagram-logo.png"
          tooltip="Your Instagram must be a Business account connected to a Facebook Page. The OAuth flow connects via Meta's Marketing API."
          connectHref="/api/analytics/meta-connect"
          connectLabel="Connect Instagram & Meta"
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <BrandIcon src="/instagram-logo.png" alt="Instagram" />
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Instagram</h3>
                {igHandle && <p className="text-xs text-gray-400">@{igHandle}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {metaLoading && <RefreshCw size={13} className="text-gray-400 animate-spin" />}
              <ConnectedBadge label="Connected" onDisconnect={handleMetaDisconnect} />
            </div>
          </div>
          {metaLoading ? (
            <div className="h-40 flex items-center justify-center">
              <p className="text-sm text-gray-400">Loading Instagram data...</p>
            </div>
          ) : igChartData.length > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Followers</p>
                  <p className="text-xl font-semibold text-gray-900">{fmt(metaData?.instagram?.followers ?? 0)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Posts</p>
                  <p className="text-xl font-semibold text-gray-900">{metaData?.instagram?.media_count ?? 0}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Period reach</p>
                  <p className="text-xl font-semibold text-gray-900">{fmt(igChartData.reduce((a, d) => a + d.reach, 0))}</p>
                </div>
              </div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Daily reach</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={igChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmt} />
                  <Tooltip formatter={(v) => [fmt(Number(v ?? 0)), 'Reach']} />
                  <Line type="monotone" dataKey="reach" stroke="#3B82F6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center text-center px-8 gap-2">
              <p className="text-sm font-medium text-gray-600">Instagram insights coming soon</p>
              <p className="text-xs text-gray-400">
                Follower count is live. Reach and impressions data will be available once
                our Meta integration is fully approved. No action needed on your end.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Meta Ads */}
      {!metaConnected ? (
        <LockedPreviewSection
          title="Meta Ads"
          description="Connect Meta Ads to track spend, clicks, and conversions."
          icon={MousePointerClick}
          logoSrc="/MetaLogo.png"
          tooltip="Go to Meta Business Suite → Settings → People and add your Agent7even team as a Partner with Advertiser access."
          connectHref="/api/analytics/meta-connect"
          connectLabel="Connect Instagram & Meta"
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <BrandIcon src="/MetaLogo.png" alt="Meta" />
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Meta Ads</h3>
                {metaAdAccountId && <p className="text-xs text-gray-400">Account {metaAdAccountId}</p>}
              </div>
            </div>
            {metaLoading && <RefreshCw size={13} className="text-gray-400 animate-spin" />}
          </div>
          {metaLoading ? (
            <div className="h-40 flex items-center justify-center">
              <p className="text-sm text-gray-400">Loading ads data...</p>
            </div>
          ) : adsChartData.length > 0 ? (
            <>
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Total spend', value: `$${adTotals?.spend.toFixed(2) ?? '0'}` },
                  { label: 'Clicks', value: fmt(adTotals?.clicks ?? 0) },
                  { label: 'Impressions', value: fmt(adTotals?.impressions ?? 0) },
                  { label: 'Conversions', value: fmt(adTotals?.conversions ?? 0) },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                    <p className="text-xl font-semibold text-gray-900">{s.value}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Daily spend & clicks</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={adsChartData} barSize={10}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="spend" fill="#3B82F6" radius={[3, 3, 0, 0]} name="Spend ($)" />
                  <Bar yAxisId="right" dataKey="clicks" fill="#e8a48a" radius={[3, 3, 0, 0]} name="Clicks" />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center">
              <p className="text-sm text-gray-400">No ad data found. Make sure you have active campaigns in Meta Ads.</p>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
