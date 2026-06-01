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
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
          checked ? 'bg-[#2D3748]' : 'bg-gray-200'
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
    starter: 'bg-gray-100 text-gray-600',
    growth: 'bg-[#2D3748]/10 text-[#64748B]',
    proagent: 'bg-[#0d0d0d] text-white',
  }
  const label = plan ?? 'No plan'
  const key = plan ?? ''
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${map[key] ?? 'bg-gray-100 text-gray-500'}`}>
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
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage your account and business details</p>
      </div>

      {/* Account info — read only */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-5">Account</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
              <User size={16} className="text-gray-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Full name</p>
              <p className="text-sm font-medium text-gray-800">{profile.full_name ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-gray-400">@</span>
            </div>
            <div>
              <p className="text-xs text-gray-400">Email</p>
              <p className="text-sm font-medium text-gray-800">{profile.email ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-gray-400">★</span>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs text-gray-400">Current plan</p>
                <div className="mt-1">{planBadge(profile.plan)}</div>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-4">
          To update your name or email, visit your{' '}
          <button
            onClick={() => openUserProfile()}
            className="text-[#64748B] underline underline-offset-2"
          >
            account settings
          </button>
          . To change your plan, go to{' '}
          <a href="/dashboard/billing" className="text-[#64748B] underline underline-offset-2">Billing</a>.
        </p>
      </div>

      {/* Business details — editable */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-5">Business details</h2>
        <div className="space-y-5">

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              <Building size={12} />
              Company name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Your business name"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]/20 placeholder:text-gray-300 transition-colors"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              <Globe size={12} />
              Website URL
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={e => setWebsiteUrl(e.target.value)}
              placeholder="https://yourbusiness.com"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]/20 placeholder:text-gray-300 transition-colors"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              <Hash size={12} />
              Instagram handle
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">@</span>
              <input
                type="text"
                value={instagramHandle}
                onChange={e => setInstagramHandle(e.target.value.replace('@', ''))}
                placeholder="yourbusiness"
                className={`w-full text-sm border rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-1 placeholder:text-gray-300 transition-colors ${
                  error
                    ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                    : 'border-gray-200 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20'
                }`}
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 mt-2">
                <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-50">
          <p className="text-xs text-gray-400">
            {isDirty ? 'You have unsaved changes' : 'All changes saved'}
          </p>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className={`flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all ${
              saved
                ? 'bg-emerald-50 text-emerald-700'
                : isDirty
                ? 'bg-[#2D3748] text-white hover:bg-[#1a2535]'
                : 'bg-gray-50 text-gray-300 cursor-not-allowed'
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
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Bell size={14} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">Email notifications</h2>
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
        <p className="text-xs text-gray-400 mt-4">Changes save automatically when you toggle.</p>
      </div>

    </div>
  )
}
