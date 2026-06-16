'use client'

import { useState } from 'react'

const REQUEST_TYPES = [
  { value: 'full_account', label: 'Delete my entire Agent7even account and all associated data' },
  { value: 'connected_accounts', label: 'Delete connected integration data only (Google Analytics, social accounts, etc.)' },
  { value: 'meta_platform', label: 'Delete my Meta / Instagram / Facebook data held by Agent7even' },
  { value: 'other', label: 'Other (describe below)' },
] as const

export default function DataDeletionRequestForm() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [requestType, setRequestType] = useState<string>('full_account')
  const [details, setDetails] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [website, setWebsite] = useState('') // honeypot
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [referenceId, setReferenceId] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!fullName.trim() || !email.trim()) {
      setError('Please enter your name and email.')
      return
    }
    if (!confirmed) {
      setError('Please confirm that you understand this request may be irreversible.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/data-deletion/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          accountEmail: accountEmail.trim() || undefined,
          requestType,
          details: details.trim() || undefined,
          website,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Something went wrong. Please try again or email support@agent7even.ai.')
        return
      }
      setReferenceId(json.referenceId ?? '')
      setSubmitted(true)
    } catch {
      setError('Network error. Please try again or email support@agent7even.ai directly.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-6">
        <p className="text-[15px] font-semibold text-emerald-900 mb-2">Request received</p>
        <p className="text-[14px] text-emerald-800 leading-relaxed">
          We received your data deletion request{referenceId ? ` (reference ${referenceId})` : ''}.
          We will verify your identity using the email provided and respond within 30 days, usually sooner.
          A confirmation email has been sent to <strong>{email}</strong>.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-6 space-y-5">
      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[13px] font-medium text-gray-800">Full name *</span>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[14px] text-gray-900 outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium text-gray-800">Email address *</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[14px] text-gray-900 outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
            autoComplete="email"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-[13px] font-medium text-gray-800">Agent7even account email (if different)</span>
        <input
          type="email"
          value={accountEmail}
          onChange={(e) => setAccountEmail(e.target.value)}
          placeholder="Optional — helps us locate your account"
          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[14px] text-gray-900 outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
        />
      </label>

      <fieldset>
        <legend className="text-[13px] font-medium text-gray-800 mb-2">What would you like deleted? *</legend>
        <div className="space-y-2">
          {REQUEST_TYPES.map((option) => (
            <label key={option.value} className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="requestType"
                value={option.value}
                checked={requestType === option.value}
                onChange={() => setRequestType(option.value)}
                className="mt-1"
              />
              <span className="text-[14px] text-gray-700 leading-snug">{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-[13px] font-medium text-gray-800">Additional details</span>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={4}
          placeholder="Optional — include connected Instagram/Facebook username, Google Analytics property, or anything else that helps us process your request."
          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[14px] text-gray-900 outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 resize-y"
        />
      </label>

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1"
        />
        <span className="text-[13px] text-gray-600 leading-relaxed">
          I understand that deleting my data may be irreversible and may cancel access to my Agent7even account and connected services.
        </span>
      </label>

      {/* Honeypot — hidden from users */}
      <label className="hidden" aria-hidden="true">
        <span>Website</span>
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="w-full sm:w-auto bg-[#3B82F6] text-white text-[14px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
      >
        {loading ? 'Submitting…' : 'Submit deletion request'}
      </button>
    </form>
  )
}
