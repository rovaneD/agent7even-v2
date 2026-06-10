'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { Save, Loader2, CheckCircle, AlertCircle, User, Building, Globe, Hash, Bell } from 'lucide-react'

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  company_name: string | null
  website_url: string | null
  instagram_handle: string | null
  business_type: string | null
  plan: string | null
  status: string | null
  email_digest: boolean | null
  email_approvals: boolean | null
  email_weekly: boolean | null
}

function PreferenceToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-text">{label}</p>
        <p className="text-xs text-text-soft mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
          checked ? 'bg-brand-primary' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

interface Props {
  profile: Profile
}

function planBadge(plan: string | null) {
  const map: Record<string, string> = {
    starter: 'bg-surface-muted text-text-sec',
    growth: 'bg-brand-primary/10 text-text-sec',
    proagent: 'bg-[#0d0d0d] text-white',
  }
  const label = plan ?? 'No plan'
  const key = plan ?? ''
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${map[key] ?? 'bg-surface-muted text-text-sec'}`}>
      {label}
    </span>
  )
}

export default function SettingsClient({ profile }: Props) {
  const router = useRouter()
  const { openUserProfile } = useClerk()
  const [companyName, setCompanyName] = useState(profile.company_name ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url ?? '')
  const [instagramHandle, setInstagramHandle] = useState(profile.instagram_handle ?? '')
  const [emailDigest, setEmailDigest]       = useState(profile.email_digest    ?? true)
  const [emailApprovals, setEmailApprovals] = useState(profile.email_approvals ?? true)
  const [emailWeekly, setEmailWeekly]       = useState(profile.email_weekly    ?? true)

  useEffect(() => {
    const context = `SETTINGS PAGE
Full name: ${profile.full_name ?? 'not set'}
Email: ${profile.email ?? 'not set'}
Company name: ${profile.company_name ?? 'not set'}
Website URL: ${profile.website_url ?? 'not set'}
Instagram handle: ${profile.instagram_handle ? `@${profile.instagram_handle}` : 'not set'}
Business type: ${profile.business_type ?? 'not set'}
Plan: ${profile.plan ?? 'none'}
Account status: ${profile.status ?? 'unknown'}
The user can update their company name, website URL, and Instagram handle. Name and email are managed via Clerk.`
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context } }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty =
    companyName !== (profile.company_name ?? '') ||
    websiteUrl !== (profile.website_url ?? '') ||
    instagramHandle !== (profile.instagram_handle ?? '') ||
    emailDigest    !== (profile.email_digest    ?? true) ||
    emailApprovals !== (profile.email_approvals ?? true) ||
    emailWeekly    !== (profile.email_weekly    ?? true)

  async function updateEmailPref(field: 'emailDigest' | 'emailApprovals' | 'emailWeekly', val: boolean) {
    const next = {
      emailDigest:    field === 'emailDigest'    ? val : emailDigest,
      emailApprovals: field === 'emailApprovals' ? val : emailApprovals,
      emailWeekly:    field === 'emailWeekly'    ? val : emailWeekly,
    }
    if (field === 'emailDigest')    setEmailDigest(val)
    if (field === 'emailApprovals') setEmailApprovals(val)
    if (field === 'emailWeekly')    setEmailWeekly(val)
    await fetch('/api/settings/update', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ companyName, websiteUrl, instagramHandle, ...next }),
    })
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, websiteUrl, instagramHandle, emailDigest, emailApprovals, emailWeekly }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1240px] space-y-6 px-4 py-8 sm:px-8">

      {/* Header */}
      <div className="rounded-2xl border border-gray-100 bg-white p-7">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-primary">Settings</p>
        <h1 className="text-[32px] font-semibold tracking-[-0.03em] text-text">Account controls</h1>
        <p className="mt-2 text-sm text-text-sec">Manage business details, notification preferences, and account access.</p>
      </div>

      {/* Account info — read only */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <h2 className="text-sm font-semibold text-text mb-5">Account</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
              <User size={16} className="text-brand-primary" />
            </div>
            <div>
              <p className="text-xs text-text-soft">Full name</p>
              <p className="text-sm font-medium text-text">{profile.full_name ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-brand-primary">@</span>
            </div>
            <div>
              <p className="text-xs text-text-soft">Email</p>
              <p className="text-sm font-medium text-text">{profile.email ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-brand-primary">★</span>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs text-text-soft">Current plan</p>
                <div className="mt-1">{planBadge(profile.plan)}</div>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-text-soft mt-4">
          To update your name or email, visit your{' '}
          <button
            onClick={() => openUserProfile()}
            className="text-brand-primary underline underline-offset-2"
          >
            account settings
          </button>
          . To change your plan, go to{' '}
          <a href="/dashboard/billing" className="text-brand-primary underline underline-offset-2">Billing</a>.
        </p>
      </div>

      {/* Business details — editable */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <h2 className="text-sm font-semibold text-text mb-5">Business details</h2>
        <div className="space-y-5">

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-text-soft uppercase tracking-wide mb-2">
              <Building size={12} />
              Company name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Your business name"
              className="w-full text-sm border border-border rounded-xl px-4 py-3 text-text focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 placeholder:text-text-soft transition-colors"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-text-soft uppercase tracking-wide mb-2">
              <Globe size={12} />
              Website URL
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={e => setWebsiteUrl(e.target.value)}
              placeholder="https://yourbusiness.com"
              className="w-full text-sm border border-border rounded-xl px-4 py-3 text-text focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 placeholder:text-text-soft transition-colors"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-text-soft uppercase tracking-wide mb-2">
              <Hash size={12} />
              Instagram handle
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-text-soft">@</span>
              <input
                type="text"
                value={instagramHandle}
                onChange={e => setInstagramHandle(e.target.value.replace('@', ''))}
                placeholder="yourbusiness"
                className={`w-full text-sm border rounded-xl pl-8 pr-4 py-3 text-text focus:outline-none focus:ring-1 placeholder:text-text-soft transition-colors ${
                  error
                    ? 'border-status-danger/40 focus:border-status-danger focus:ring-status-danger/10'
                    : 'border-border focus:border-brand-primary focus:ring-brand-primary/20'
                }`}
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 mt-2">
                <AlertCircle size={13} className="text-status-danger flex-shrink-0" />
                <p className="text-xs text-status-danger">{error}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 pt-5 border-t border-border">
          <p className="text-xs text-text-soft">
            {isDirty ? 'You have unsaved changes' : 'All changes saved'}
          </p>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className={`flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all ${
              saved
                ? 'bg-status-success/10 text-status-success'
                : isDirty
                ? 'bg-brand-primary text-white hover:bg-[#2563EB]'
                : 'bg-surface-muted text-text-soft cursor-not-allowed'
            }`}
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Saving...</>
            ) : saved ? (
              <><CheckCircle size={14} /> Saved</>
            ) : (
              <><Save size={14} /> Save changes</>
            )}
          </button>
        </div>
      </div>

      {/* Email preferences */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="flex items-center gap-2 mb-5">
          <Bell size={14} className="text-brand-primary" />
          <h2 className="text-sm font-semibold text-text">Email notifications</h2>
        </div>
        <div>
          <PreferenceToggle
            label="Morning digest"
            description="Daily summary of agent activity and today's plan"
            checked={emailDigest}
            onChange={val => updateEmailPref('emailDigest', val)}
          />
          <PreferenceToggle
            label="Approval alerts"
            description="Notified when an agent output needs your review"
            checked={emailApprovals}
            onChange={val => updateEmailPref('emailApprovals', val)}
          />
          <PreferenceToggle
            label="Weekly summary"
            description="What Maya accomplished this week"
            checked={emailWeekly}
            onChange={val => updateEmailPref('emailWeekly', val)}
          />
        </div>
        <p className="text-xs text-text-soft mt-4">Changes save automatically when you toggle.</p>
      </div>

    </div>
  )
}
