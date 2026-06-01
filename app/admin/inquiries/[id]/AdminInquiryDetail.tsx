'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, Save, Loader2, CheckCircle,
  AlertCircle, ExternalLink, User, Calendar,
  DollarSign, Monitor, Smartphone, Globe
} from 'lucide-react'

interface Inquiry {
  id: string
  service_type: string
  project_name: string
  description: string
  platform: string[] | null
  has_existing_brand: boolean | null
  has_existing_designs: boolean | null
  timeline: string | null
  budget_range: string | null
  additional_notes: string | null
  status: string
  admin_notes: string | null
  proposal_url: string | null
  created_at: string
  profiles: {
    id: string
    full_name: string
    company_name: string
    email: string
  }
}

interface Props {
  inquiry: Inquiry
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: 'bg-blue-50 text-blue-600' },
  { value: 'reviewing', label: 'Reviewing', color: 'bg-amber-50 text-amber-600' },
  { value: 'proposal_sent', label: 'Proposal sent', color: 'bg-purple-50 text-purple-600' },
  { value: 'accepted', label: 'Accepted', color: 'bg-emerald-50 text-emerald-600' },
  { value: 'declined', label: 'Declined', color: 'bg-gray-50 text-gray-400' },
]

const SERVICE_LABELS: Record<string, string> = {
  uiux: 'UI/UX Design',
  mobile_app: 'Mobile App Development',
  custom_dev: 'Custom Design & Development',
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminInquiryDetail({ inquiry: initial }: Props) {
  const [inquiry, setInquiry] = useState<Inquiry>(initial)
  const [adminNotes, setAdminNotes] = useState(initial.admin_notes ?? '')
  const [proposalUrl, setProposalUrl] = useState(initial.proposal_url ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const client = inquiry.profiles

  useEffect(() => {
    const lines = [
      `ADMIN — INQUIRY DETAIL: ${inquiry.project_name}`,
      `Service type: ${SERVICE_LABELS[inquiry.service_type] ?? inquiry.service_type}`,
      `Client: ${client.company_name ?? client.full_name} (${client.email})`,
      `Status: ${inquiry.status}`,
      `Timeline: ${inquiry.timeline ?? 'not specified'} | Budget: ${inquiry.budget_range ?? 'not specified'}`,
      `Existing brand: ${inquiry.has_existing_brand === null ? 'not specified' : inquiry.has_existing_brand ? 'yes' : 'no'}`,
      inquiry.proposal_url ? `Proposal: ${inquiry.proposal_url}` : 'No proposal link yet',
    ]
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context: lines.join('\n') } }))
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/inquiries/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: inquiry.id,
          status: inquiry.status,
          admin_notes: adminNotes,
          proposal_url: proposalUrl,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  const statusConfig = STATUS_OPTIONS.find(s => s.value === inquiry.status)

  return (
    <div className="px-8 py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link
            href="/admin/inquiries"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 mb-3 transition-colors"
          >
            <ChevronLeft size={16} />
            Back to inquiries
          </Link>
          <p className="text-[10px] font-semibold tracking-widest uppercase text-[#64748B] mb-1">
            {SERVICE_LABELS[inquiry.service_type] ?? inquiry.service_type}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">{inquiry.project_name}</h1>
          <p className="text-sm text-gray-400 mt-1">Submitted {formatDate(inquiry.created_at)}</p>
        </div>

        {/* Status + Save */}
        <div className="flex items-center gap-3">
          <select
            value={inquiry.status}
            onChange={e => setInquiry(prev => ({ ...prev, status: e.target.value }))}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#3B82F6] bg-white text-gray-700"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all ${
              saved
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-[#2D3748] text-white hover:bg-[#1a2535]'
            }`}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> :
             saved ? <CheckCircle size={14} /> :
             <Save size={14} />}
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* Left column — brief */}
        <div className="col-span-2 space-y-5">

          {/* Client info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Client</h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#2D3748]/10 flex items-center justify-center">
                <User size={16} className="text-[#64748B]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {client.company_name ?? client.full_name}
                </p>
                <p className="text-xs text-gray-400">{client.email}</p>
              </div>
              <Link
                href={`/admin/clients/${client.id}`}
                className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                View client <ExternalLink size={11} />
              </Link>
            </div>
          </div>

          {/* Project description */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Project description</h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{inquiry.description}</p>
          </div>

          {/* Additional notes */}
          {inquiry.additional_notes && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Additional notes</h2>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{inquiry.additional_notes}</p>
            </div>
          )}

          {/* Admin notes */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Internal notes</h2>
            <textarea
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              placeholder="Add notes about this inquiry — pricing estimates, scope thoughts, next steps..."
              rows={5}
              className="w-full text-sm text-gray-700 placeholder:text-gray-300 resize-none focus:outline-none"
            />
          </div>

          {/* Proposal URL */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Proposal link</h2>
            <input
              type="url"
              value={proposalUrl}
              onChange={e => setProposalUrl(e.target.value)}
              placeholder="https://docs.google.com/... or Notion link"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]/20 placeholder:text-gray-300"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Paste a link to the proposal document once it's ready.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <AlertCircle size={14} className="text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Right column — details */}
        <div className="space-y-5">

          {/* Status */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Status</h2>
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${statusConfig?.color}`}>
              {statusConfig?.label}
            </span>
          </div>

          {/* Project details */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Details</h2>

            <div className="flex items-start gap-3">
              <Calendar size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Timeline</p>
                <p className="text-sm font-medium text-gray-700">{inquiry.timeline ?? 'Not specified'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <DollarSign size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Budget range</p>
                <p className="text-sm font-medium text-gray-700">{inquiry.budget_range ?? 'Not specified'}</p>
              </div>
            </div>

            {inquiry.platform && inquiry.platform.length > 0 && (
              <div className="flex items-start gap-3">
                <Smartphone size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Platforms</p>
                  <p className="text-sm font-medium text-gray-700">{inquiry.platform.join(', ')}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Monitor size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Existing brand</p>
                <p className="text-sm font-medium text-gray-700">
                  {inquiry.has_existing_brand === null ? 'Not specified' :
                   inquiry.has_existing_brand ? 'Yes' : 'No — starting fresh'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Globe size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Existing designs</p>
                <p className="text-sm font-medium text-gray-700">
                  {inquiry.has_existing_designs === null ? 'Not specified' :
                   inquiry.has_existing_designs ? 'Yes' : 'No — needs design'}
                </p>
              </div>
            </div>
          </div>

          {/* Proposal link preview */}
          {inquiry.proposal_url && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Proposal</h2>
              <a
                href={inquiry.proposal_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-medium text-[#64748B] hover:text-[#b8471f] transition-colors"
              >
                <ExternalLink size={14} />
                View proposal
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
