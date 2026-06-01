'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Building2, Globe, Hash, Calendar, Clock,
  Mail, Bell, Zap, Shield, Ban, RefreshCw, AlertTriangle,
  Activity, CreditCard, Users, BookOpen, MessageSquare,
  HelpCircle, Loader2, Send, X,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type ClientProfile = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  company_name: string | null
  website_url: string | null
  instagram_handle: string | null
  plan: string | null
  status: string | null
  role: string | null
  last_active_at: string | null
  engagement_score: number | null
  foundation_score: number | null
  foundation_complete: boolean | null
  foundation_answers: Record<string, unknown> | null
  stripe_customer_id: string | null
  created_at: string
}

type ActivityEvent = { id: string; event_type: string; metadata: unknown; created_at: string }
type AdminNote = { id: string; body: string; created_at: string; profiles?: { full_name: string | null; avatar_url: string | null } }
type SupportTicket = { id: string; subject: string; status: string; priority: string; created_at: string }
type TeamMember = { id: string; role: string; status: string; created_at: string; profiles?: { id: string; full_name: string | null; email: string | null; avatar_url: string | null } }
type FieldScore = { field_name: string; score: number }

// ── Constants ──────────────────────────────────────────────────────────────

const PLAN_CREDITS: Record<string, number> = { starter: 100, growth: 350, proagent: 1000 }
const PLAN_LABELS: Record<string, string> = { starter: 'Starter', growth: 'Growth', proagent: 'ProAgent' }
const PLAN_COLORS: Record<string, string> = {
  starter:  'bg-gray-100 text-gray-600',
  growth:   'bg-blue-50 text-blue-600',
  proagent: 'bg-[#2D3748]/10 text-[#2D3748]',
}
const ACTIVITY_LABELS: Record<string, string> = {
  page_view:          'Viewed a page',
  maya_message:       'Sent a message to Maya',
  agent_run:          'Ran an agent',
  agent_approved:     'Approved agent output',
  campaign_created:   'Created a campaign',
  foundation_updated: 'Updated Foundation answers',
  brand_kit_updated:  'Edited Brand Kit',
  analytics_viewed:   'Viewed Analytics',
}

type Tab = 'activity' | 'billing' | 'team' | 'foundation' | 'notes' | 'support'

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function derivedStatus(profile: ClientProfile): 'healthy' | 'drifting' | 'at_risk' {
  const hoursInactive = (Date.now() - new Date(profile.last_active_at ?? 0).getTime()) / 3600000
  const score = profile.engagement_score ?? 0
  if (hoursInactive <= 24 && score >= 50) return 'healthy'
  if (hoursInactive > 48 || score < 30) return 'at_risk'
  return 'drifting'
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ScoreRow({ label, score, max = 100, unit = '' }: { label: string; score: number | null; max?: number; unit?: string }) {
  const pct = Math.min(100, (((score ?? 0) / max) * 100))
  const color = pct >= 70 ? 'bg-green-400' : pct >= 40 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-gray-600 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2">
        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-gray-500 tabular-nums w-20 text-right">
          {score ?? 0}{unit ? ` ${unit}` : ''}{max !== 100 ? ` / ${max}` : ''}
        </span>
      </div>
    </div>
  )
}

function ActionBtn({ icon, label, onClick, variant = 'default' }: {
  icon: React.ReactNode; label: string; onClick: () => void; variant?: 'default' | 'danger'
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
        variant === 'danger' ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span className="flex-shrink-0 text-gray-400">{icon}</span>
      {label}
    </button>
  )
}

function Modal({ title, onClose, children, variant = 'default' }: {
  title: string; onClose: () => void; children: React.ReactNode; variant?: 'default' | 'danger'
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className={`text-base font-semibold ${variant === 'danger' ? 'text-red-600' : 'text-gray-900'}`}>{title}</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ClientDetail({
  clientId,
  initialProfile,
  initialCreditBalance,
  initialNotes,
  initialActivity,
  initialTeamMembers,
  initialTickets,
  fieldScores,
  duplicateAccount,
}: {
  clientId: string
  initialProfile: ClientProfile
  initialCreditBalance: number
  initialNotes: AdminNote[]
  initialActivity: ActivityEvent[]
  initialTeamMembers: TeamMember[]
  initialTickets: SupportTicket[]
  fieldScores: FieldScore[]
  duplicateAccount: { id: string; full_name: string | null } | null
}) {
  const [profile, setProfile] = useState(initialProfile)
  const [tab, setTab] = useState<Tab>('activity')

  // Notes
  const [notes, setNotes] = useState(initialNotes)
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Billing lazy
  const [billingData, setBillingData] = useState<{ invoices: any[]; subscription: any } | null>(null)
  const [billingLoading, setBillingLoading] = useState(false)

  // Modals
  const [showEmail, setShowEmail] = useState(false)
  const [showPlan, setShowPlan] = useState(false)
  const [showRole, setShowRole] = useState(false)
  const [showReset, setShowReset] = useState(false)

  // Modal state
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(profile.plan ?? 'starter')
  const [selectedRole, setSelectedRole] = useState(profile.role ?? 'client')

  // Toast
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (tab === 'billing' && !billingData && !billingLoading) {
      setBillingLoading(true)
      fetch(`/api/admin/clients/${clientId}/billing`)
        .then(r => r.json())
        .then(d => { setBillingData(d); setBillingLoading(false) })
        .catch(() => setBillingLoading(false))
    }
  }, [tab, clientId, billingData, billingLoading])

  useEffect(() => {
    const lines = [
      `ADMIN — CLIENT DETAIL: ${profile.full_name || profile.company_name || profile.email || clientId}`,
      `Company: ${profile.company_name ?? '—'}`,
      `Email: ${profile.email ?? '—'}`,
      `Plan: ${profile.plan ?? 'none'} | Status: ${profile.status ?? '—'}`,
      `Foundation score: ${profile.foundation_score ?? 0} | Engagement score: ${profile.engagement_score ?? 0}`,
      `Foundation complete: ${profile.foundation_complete ? 'yes' : 'no'}`,
      `Last active: ${profile.last_active_at ?? 'never'}`,
      initialActivity.length > 0
        ? `Recent activity: ${initialActivity.slice(0, 5).map(e => e.event_type.replace(/_/g, ' ')).join(', ')}`
        : 'No activity recorded',
      initialTickets.length > 0
        ? `Support tickets: ${initialTickets.map(t => `"${t.subject}" [${t.status}]`).join(', ')}`
        : 'No support tickets',
    ]
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context: lines.join('\n') } }))
  }, [])

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleNudge() {
    await fetch(`/api/admin/clients/${clientId}/nudge`, { method: 'POST' })
    showToast('Maya nudge sent')
  }

  async function handleSendEmail() {
    if (!emailSubject.trim() || !emailBody.trim()) return
    setSendingEmail(true)
    const res = await fetch(`/api/admin/clients/${clientId}/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: emailSubject, body: emailBody }),
    })
    setSendingEmail(false)
    if (res.ok) {
      setShowEmail(false)
      setEmailSubject('')
      setEmailBody('')
      showToast('Email sent')
    }
  }

  async function handleChangePlan() {
    await fetch(`/api/admin/clients/${clientId}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: selectedPlan }),
    })
    setProfile(p => ({ ...p, plan: selectedPlan }))
    setShowPlan(false)
    showToast('Plan updated')
  }

  async function handleChangeRole() {
    await fetch(`/api/admin/clients/${clientId}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: selectedRole }),
    })
    setProfile(p => ({ ...p, role: selectedRole }))
    setShowRole(false)
    showToast('Role updated')
  }

  async function handleToggleSuspend() {
    const newStatus = profile.status === 'suspended' ? 'active' : 'suspended'
    await fetch(`/api/admin/clients/${clientId}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setProfile(p => ({ ...p, status: newStatus }))
    showToast(newStatus === 'suspended' ? 'Account suspended' : 'Account reactivated')
  }

  async function handleResetFoundation() {
    await fetch(`/api/admin/clients/${clientId}/reset-foundation`, { method: 'POST' })
    setProfile(p => ({ ...p, foundation_complete: false, foundation_score: 0 }))
    setShowReset(false)
    showToast('Foundation reset')
  }

  async function handleAddNote() {
    if (!newNote.trim()) return
    setSavingNote(true)
    const res = await fetch(`/api/admin/clients/${clientId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: newNote }),
    })
    const data = await res.json()
    if (data.note) { setNotes(prev => [data.note, ...prev]); setNewNote('') }
    setSavingNote(false)
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const status = derivedStatus(profile)
  const planMax = PLAN_CREDITS[profile.plan ?? ''] ?? 100

  const STATUS_DOT: Record<string, string> = {
    healthy: 'bg-green-400', drifting: 'bg-yellow-400', at_risk: 'bg-red-400',
  }

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'activity',   label: 'Activity',   icon: <Activity size={13} /> },
    { key: 'billing',    label: 'Billing',     icon: <CreditCard size={13} /> },
    { key: 'team',       label: 'Team',        icon: <Users size={13} /> },
    { key: 'foundation', label: 'Foundation',  icon: <BookOpen size={13} /> },
    { key: 'notes',      label: 'Notes',       icon: <MessageSquare size={13} /> },
    { key: 'support',    label: 'Support',     icon: <HelpCircle size={13} /> },
  ]

  return (
    <div className="px-8 py-8 max-w-[1400px]">

      {/* Back */}
      <Link href="/admin/clients" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-5">
        <ArrowLeft size={14} /> Back to clients
      </Link>

      {/* Duplicate warning */}
      {duplicateAccount && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <p className="text-sm text-yellow-800">
              Duplicate account — <strong>{duplicateAccount.full_name ?? duplicateAccount.id}</strong> shares this email
            </p>
          </div>
          <button
            onClick={handleToggleSuspend}
            className="text-sm font-medium text-yellow-800 underline"
          >
            Deactivate this account
          </button>
        </div>
      )}

      {/* Two-panel layout */}
      <div className="flex gap-6 items-start">

        {/* ── LEFT PANEL ── */}
        <div className="w-[360px] flex-shrink-0 space-y-4">

          {/* Identity card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#2D3748]/10 flex items-center justify-center text-[#9BA1AE] font-bold text-lg flex-shrink-0">
                    {(profile.full_name || profile.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="font-semibold text-gray-900 truncate">{profile.full_name || '—'}</h2>
                  <p className="text-sm text-gray-400 truncate">{profile.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
                <span className="text-xs text-gray-500 capitalize">{status.replace('_', ' ')}</span>
              </div>
            </div>

            {/* Company details */}
            <div className="space-y-2.5 pt-4 border-t border-gray-100">
              {profile.company_name && (
                <div className="flex items-start gap-2.5">
                  <Building2 size={13} className="text-gray-300 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400">Company</p>
                    <p className="text-xs text-gray-700 font-medium">{profile.company_name}</p>
                  </div>
                </div>
              )}
              {profile.website_url && (
                <div className="flex items-start gap-2.5">
                  <Globe size={13} className="text-gray-300 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400">Website</p>
                    <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 font-medium hover:underline truncate block max-w-[240px]">
                      {profile.website_url}
                    </a>
                  </div>
                </div>
              )}
              {profile.instagram_handle && (
                <div className="flex items-start gap-2.5">
                  <Hash size={13} className="text-gray-300 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400">Instagram</p>
                    <p className="text-xs text-gray-700 font-medium">@{profile.instagram_handle}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2.5">
                <Calendar size={13} className="text-gray-300 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400">Joined</p>
                  <p className="text-xs text-gray-700 font-medium">{formatDate(profile.created_at)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock size={13} className="text-gray-300 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400">Last active</p>
                  <p className="text-xs text-gray-700 font-medium">{relativeTime(profile.last_active_at)}</p>
                </div>
              </div>
            </div>

            {/* Badges */}
            <div className="flex gap-2 pt-4 border-t border-gray-100 mt-4 flex-wrap">
              {profile.plan && (
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${PLAN_COLORS[profile.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                  {PLAN_LABELS[profile.plan] ?? profile.plan}
                </span>
              )}
              {profile.role && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-50 text-purple-600">
                  {profile.role}
                </span>
              )}
              {profile.status === 'suspended' && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-red-50 text-red-500">
                  Suspended
                </span>
              )}
            </div>
          </div>

          {/* Health scores */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Health</h3>
            <div className="space-y-4">
              <ScoreRow label="Engagement" score={profile.engagement_score} />
              <ScoreRow label="Foundation" score={profile.foundation_score} />
              <ScoreRow label="Credits" score={initialCreditBalance} max={planMax} unit="cr" />
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Actions</h3>
            <div className="space-y-0.5">
              <ActionBtn icon={<Mail size={14} />} label="Send email" onClick={() => setShowEmail(true)} />
              <ActionBtn icon={<Bell size={14} />} label="Send Maya nudge" onClick={handleNudge} />
              <ActionBtn icon={<Zap size={14} />} label="Change plan" onClick={() => setShowPlan(true)} />
              <ActionBtn icon={<Shield size={14} />} label="Change role" onClick={() => setShowRole(true)} />
              <ActionBtn
                icon={<Ban size={14} />}
                label={profile.status === 'suspended' ? 'Reactivate account' : 'Suspend account'}
                onClick={handleToggleSuspend}
                variant={profile.status === 'suspended' ? 'default' : 'danger'}
              />
              <ActionBtn icon={<RefreshCw size={14} />} label="Reset Foundation" onClick={() => setShowReset(true)} variant="danger" />
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="flex-1 min-w-0">

          {/* Tab bar */}
          <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100">

            {/* ── Activity ── */}
            {tab === 'activity' && (
              <div className="p-6">
                {initialActivity.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">No activity recorded yet</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Event', 'Description', 'Time'].map(h => (
                          <th key={h} className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest pb-3 pr-6 last:pr-0">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {initialActivity.map(ev => (
                        <tr key={ev.id} className="border-b border-gray-50 last:border-0">
                          <td className="py-3 pr-6">
                            <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-2 py-1 rounded-full whitespace-nowrap">
                              {ev.event_type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-3 pr-6 text-sm text-gray-600">
                            {ACTIVITY_LABELS[ev.event_type] ?? ev.event_type.replace(/_/g, ' ')}
                          </td>
                          <td className="py-3 text-xs text-gray-400 whitespace-nowrap">{relativeTime(ev.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── Billing ── */}
            {tab === 'billing' && (
              <div className="p-6">
                {billingLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="w-5 h-5 border-2 border-gray-200 border-t-[#3B82F6] rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Plan + credits */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Current plan</p>
                        <p className="text-lg font-semibold text-gray-900 capitalize">{profile.plan ?? '—'}</p>
                        {billingData?.subscription?.current_period_end && (
                          <p className="text-xs text-gray-400 mt-1">
                            Renews {formatDate(new Date(billingData.subscription.current_period_end * 1000).toISOString())}
                          </p>
                        )}
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Credits</p>
                        <p className="text-lg font-semibold text-gray-900">{initialCreditBalance} <span className="text-sm font-normal text-gray-400">/ {planMax}</span></p>
                        <p className="text-xs text-gray-400 mt-1">remaining this month</p>
                      </div>
                    </div>

                    {/* Stripe ID */}
                    {profile.stripe_customer_id && (
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-400">Stripe customer:</p>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono select-all">{profile.stripe_customer_id}</code>
                      </div>
                    )}

                    {/* Invoices */}
                    {billingData?.invoices && billingData.invoices.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Invoices</p>
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-100">
                              {['Date', 'Amount', 'Status', ''].map(h => (
                                <th key={h} className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest pb-2 pr-4 last:pr-0">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {billingData.invoices.map((inv: any) => (
                              <tr key={inv.id} className="border-b border-gray-50 last:border-0">
                                <td className="py-3 pr-4 text-sm text-gray-600">{formatDate(new Date(inv.created * 1000).toISOString())}</td>
                                <td className="py-3 pr-4 text-sm font-medium text-gray-900">${(inv.amount_paid / 100).toFixed(2)}</td>
                                <td className="py-3 pr-4">
                                  <span className={`text-[10px] font-semibold uppercase px-2 py-1 rounded-full ${inv.status === 'paid' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                                    {inv.status}
                                  </span>
                                </td>
                                <td className="py-3 text-right">
                                  {inv.hosted_invoice_url && (
                                    <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                                      Download
                                    </a>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Manual override */}
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Manual plan override</p>
                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <select
                            value={selectedPlan}
                            onChange={e => setSelectedPlan(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#3B82F6]/40 bg-white"
                          >
                            <option value="starter">Starter</option>
                            <option value="growth">Growth</option>
                            <option value="proagent">ProAgent</option>
                          </select>
                          <p className="text-[10px] text-gray-400 mt-1.5">Updates DB only — does not affect Stripe.</p>
                        </div>
                        <button onClick={handleChangePlan} className="px-4 py-2.5 bg-[#2D3748] text-white rounded-xl text-sm font-medium">
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Team ── */}
            {tab === 'team' && (
              <div className="p-6">
                {initialTeamMembers.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">No team members</p>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Member', 'Email', 'Role', 'Status', 'Joined'].map(h => (
                          <th key={h} className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest pb-3 pr-4 last:pr-0">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {initialTeamMembers.map(m => (
                        <tr key={m.id} className="border-b border-gray-50 last:border-0">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2.5">
                              {m.profiles?.avatar_url ? (
                                <img src={m.profiles.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-bold">
                                  {(m.profiles?.full_name || '?')[0].toUpperCase()}
                                </div>
                              )}
                              <span className="text-sm text-gray-700">{m.profiles?.full_name ?? '—'}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-sm text-gray-500">{m.profiles?.email ?? '—'}</td>
                          <td className="py-3 pr-4 text-sm text-gray-500 capitalize">{m.role}</td>
                          <td className="py-3 pr-4">
                            <span className={`text-[10px] font-semibold uppercase px-2 py-1 rounded-full ${m.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                              {m.status}
                            </span>
                          </td>
                          <td className="py-3 text-xs text-gray-400">{formatDate(m.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── Foundation ── */}
            {tab === 'foundation' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Foundation Answers</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Read-only — admin cannot edit</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${(profile.foundation_score ?? 0) >= 80 ? 'bg-green-400' : (profile.foundation_score ?? 0) >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`}
                          style={{ width: `${profile.foundation_score ?? 0}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-700">{profile.foundation_score ?? 0}%</span>
                    </div>
                    <span className={`text-[10px] font-semibold uppercase px-2 py-1 rounded-full ${profile.foundation_complete ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                      {profile.foundation_complete ? 'Complete' : 'In progress'}
                    </span>
                  </div>
                </div>

                {fieldScores.length > 0 && (
                  <div className="mb-6">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Field scores</p>
                    <div className="grid grid-cols-2 gap-2">
                      {fieldScores.map(fs => (
                        <div key={fs.field_name} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                          <span className="text-xs text-gray-600 capitalize">{(fs.field_name ?? '').replace(/_/g, ' ')}</span>
                          <span className="text-xs font-semibold text-gray-900">{fs.score ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {profile.foundation_answers ? (
                  <div className="space-y-3">
                    {Object.entries(profile.foundation_answers).map(([key, value]) => {
                      if (!value || (Array.isArray(value) && value.length === 0)) return null
                      return (
                        <div key={key} className="border border-gray-100 rounded-xl p-4">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </p>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {Array.isArray(value) ? (value as string[]).join(', ') : String(value)}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-10">No foundation answers yet</p>
                )}
              </div>
            )}

            {/* ── Notes ── */}
            {tab === 'notes' && (
              <div className="p-6">
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <textarea
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Add an internal note…"
                    rows={3}
                    className="w-full bg-transparent text-sm resize-none outline-none text-gray-800 placeholder:text-gray-400"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={handleAddNote}
                      disabled={!newNote.trim() || savingNote}
                      className="flex items-center gap-2 text-sm font-medium bg-[#2D3748] text-white px-4 py-2 rounded-xl disabled:opacity-40 transition-opacity"
                    >
                      {savingNote ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      Add note
                    </button>
                  </div>
                </div>

                {notes.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No notes yet</p>
                ) : (
                  <div>
                    {notes.map(note => (
                      <div key={note.id} className="flex gap-3 py-4 border-b border-gray-100 last:border-0">
                        <div className="w-8 h-8 rounded-full bg-[#2D3748]/10 flex items-center justify-center text-[#9BA1AE] text-xs font-bold flex-shrink-0">
                          {(note.profiles?.full_name || 'A')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">{note.profiles?.full_name ?? 'Admin'}</span>
                            <span className="text-xs text-gray-400">{relativeTime(note.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{note.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Support ── */}
            {tab === 'support' && (
              <div className="p-6">
                {initialTickets.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">No support tickets</p>
                ) : (
                  <div className="space-y-3">
                    {initialTickets.map(ticket => (
                      <Link
                        key={ticket.id}
                        href={`/admin/support/${ticket.id}`}
                        className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{ticket.subject}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatDate(ticket.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold uppercase px-2 py-1 rounded-full ${
                            ticket.priority === 'urgent' ? 'bg-red-50 text-red-500' :
                            ticket.priority === 'medium' ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-50 text-gray-400'
                          }`}>{ticket.priority}</span>
                          <span className={`text-[10px] font-semibold uppercase px-2 py-1 rounded-full ${
                            ticket.status === 'open' ? 'bg-blue-50 text-blue-600' :
                            ticket.status === 'resolved' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'
                          }`}>{ticket.status}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}

      {showEmail && (
        <Modal title={`Send email to ${profile.full_name ?? profile.email}`} onClose={() => setShowEmail(false)}>
          <input
            placeholder="Subject"
            value={emailSubject}
            onChange={e => setEmailSubject(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:border-[#3B82F6]/40"
          />
          <textarea
            placeholder="Message"
            value={emailBody}
            onChange={e => setEmailBody(e.target.value)}
            rows={6}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none outline-none focus:border-[#3B82F6]/40"
          />
          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowEmail(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm">Cancel</button>
            <button
              onClick={handleSendEmail}
              disabled={!emailSubject.trim() || !emailBody.trim() || sendingEmail}
              className="flex-1 py-3 bg-[#2D3748] text-white rounded-xl text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {sendingEmail && <Loader2 size={14} className="animate-spin" />}
              Send email
            </button>
          </div>
        </Modal>
      )}

      {showPlan && (
        <Modal title="Change plan" onClose={() => setShowPlan(false)}>
          <p className="text-sm text-gray-500 mb-4">Current plan: <strong className="capitalize">{profile.plan ?? '—'}</strong></p>
          {(['starter', 'growth', 'proagent'] as const).map(plan => (
            <button
              key={plan}
              onClick={() => setSelectedPlan(plan)}
              className={`w-full text-left px-4 py-3 rounded-xl border mb-2 text-sm font-medium ${
                selectedPlan === plan ? 'border-2 border-[#3B82F6] bg-blue-50/30 text-[#2D3748]' : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              {PLAN_LABELS[plan]}
            </button>
          ))}
          <p className="text-xs text-gray-400 mt-2">Updates DB only — does not affect Stripe.</p>
          <button onClick={handleChangePlan} className="w-full mt-4 py-3 bg-[#2D3748] text-white rounded-xl text-sm font-medium">
            Confirm change
          </button>
        </Modal>
      )}

      {showRole && (
        <Modal title="Change role" onClose={() => setShowRole(false)}>
          <p className="text-sm text-gray-500 mb-4">Current role: <strong>{profile.role ?? '—'}</strong></p>
          {(['client', 'admin', 'owner'] as const).map(role => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`w-full text-left px-4 py-3 rounded-xl border mb-2 text-sm font-medium capitalize ${
                selectedRole === role ? 'border-2 border-[#3B82F6] bg-blue-50/30 text-[#2D3748]' : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              {role}
            </button>
          ))}
          <button onClick={handleChangeRole} className="w-full mt-4 py-3 bg-[#2D3748] text-white rounded-xl text-sm font-medium">
            Confirm change
          </button>
        </Modal>
      )}

      {showReset && (
        <Modal title="Reset Foundation?" onClose={() => setShowReset(false)} variant="danger">
          <p className="text-sm text-gray-600 mb-6">
            This will set foundation_complete to false and foundation_score to 0.
            The client will be redirected through Foundation on next login.
            Their existing answers will be preserved.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setShowReset(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm">Cancel</button>
            <button onClick={handleResetFoundation} className="flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-medium">
              Reset Foundation
            </button>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  )
}
