'use client'

import { useState, useMemo } from 'react'
import { useMayaContext } from '@/hooks/useMayaContext'
import { buildServiceInquiryMayaContext } from '@/lib/maya/summaries/phase3Context'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, Send, Loader2, AlertCircle,
  Monitor, Smartphone, Globe, CheckCircle
} from 'lucide-react'

interface Props {
  companyName: string
}

const SERVICE_TYPES = [
  {
    id: 'uiux',
    label: 'UI/UX Design',
    description: 'User research, wireframes, prototypes, and design systems',
    icon: Monitor,
  },
  {
    id: 'mobile_app',
    label: 'Mobile App Development',
    description: 'Native or cross-platform iOS and Android applications',
    icon: Smartphone,
  },
  {
    id: 'custom_dev',
    label: 'Custom Design & Development',
    description: 'Bespoke web applications, platforms, and digital products',
    icon: Globe,
  },
]

const PLATFORMS = ['iOS', 'Android', 'Web', 'All platforms']

const TIMELINES = [
  'As soon as possible',
  '1-2 months',
  '3-6 months',
  '6+ months',
  'Flexible',
]

const BUDGETS = [
  'Under $5,000',
  '$5,000 - $15,000',
  '$15,000 - $30,000',
  '$30,000 - $50,000',
  '$50,000+',
  'Not sure yet',
]

export default function InquiryForm({ companyName }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [serviceType, setServiceType] = useState('')
  const [projectName, setProjectName] = useState('')
  const [description, setDescription] = useState('')
  const [platforms, setPlatforms] = useState<string[]>([])
  const [hasExistingBrand, setHasExistingBrand] = useState<boolean | null>(null)
  const [hasExistingDesigns, setHasExistingDesigns] = useState<boolean | null>(null)
  const [timeline, setTimeline] = useState('')
  const [budgetRange, setBudgetRange] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')

  const mayaContext = useMemo(
    () =>
      buildServiceInquiryMayaContext({
        companyName,
        step,
        serviceType,
        projectName,
        description,
        platforms,
        hasExistingBrand,
        hasExistingDesigns,
        timeline,
        budgetRange,
        additionalNotes,
        submitted,
      }),
    [
      companyName,
      step,
      serviceType,
      projectName,
      description,
      platforms,
      hasExistingBrand,
      hasExistingDesigns,
      timeline,
      budgetRange,
      additionalNotes,
      submitted,
    ],
  )
  useMayaContext(mayaContext)

  function togglePlatform(p: string) {
    setPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  function canProceedStep1() {
    return serviceType !== '' && projectName.trim().length > 0 && description.trim().length > 0
  }

  function canProceedStep2() {
    return hasExistingBrand !== null && hasExistingDesigns !== null
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/services/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType,
          projectName,
          description,
          platforms,
          hasExistingBrand,
          hasExistingDesigns,
          timeline,
          budgetRange,
          additionalNotes,
        }),
      })
      if (!res.ok) throw new Error('Failed to submit')
      setSubmitted(true)
    } catch {
      setError('Failed to submit your inquiry. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Success state
  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={28} className="text-emerald-600" />
        </div>
        <h2 className="text-[26px] font-semibold text-[#2D3748] mb-2">Inquiry submitted</h2>
        <p className="text-sm text-gray-400 leading-relaxed mb-8">
          We've received your project inquiry for <strong>{projectName}</strong>.
          The Agent7even team will review your brief and get back to you within 1-2 business days
          with next steps.
        </p>
        <button
          onClick={() => router.push('/dashboard/services')}
          className="inline-flex items-center gap-2 bg-[#2D3748] text-white text-[15px] font-medium px-6 py-3 rounded-xl hover:bg-[#1E293B] transition-colors"
        >
          Back to services
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-8">

      {/* Header */}
      <button
        onClick={() => step === 1 ? router.push('/dashboard/services') : setStep(s => s - 1)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 mb-8 transition-colors"
      >
        <ChevronLeft size={16} />
        {step === 1 ? 'Back to services' : 'Previous step'}
      </button>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-[#3B82F6] uppercase tracking-wide">
            Design & Development
          </span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400">Step {step} of 3</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Tell us about your project</h1>
        <p className="text-sm text-gray-400 mt-1">
          We'll review your brief and come back with a custom proposal.
        </p>
      </div>

      {/* Progress */}
      <div className="flex gap-1.5 mb-8">
        {[1, 2, 3].map(s => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-all ${
              s <= step ? 'bg-[#2D3748]' : 'bg-gray-100'
            }`}
          />
        ))}
      </div>

      {/* Step 1 — Project basics */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-3">
              What type of project is this?
            </label>
            <div className="space-y-3">
              {SERVICE_TYPES.map(type => {
                const Icon = type.icon
                return (
                  <button
                    key={type.id}
                    onClick={() => setServiceType(type.id)}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
                      serviceType === type.id
                        ? 'border-[#3B82F6] bg-[#2D3748]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      serviceType === type.id ? 'bg-[#2D3748]/10' : 'bg-gray-50'
                    }`}>
                      <Icon size={16} className={serviceType === type.id ? 'text-[#3B82F6]' : 'text-gray-400'} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${serviceType === type.id ? 'text-[#3B82F6]' : 'text-gray-800'}`}>
                        {type.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{type.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
              Project name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="e.g. Durso Design Mobile App, Client Portal Redesign"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]/20 placeholder:text-gray-300"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
              Describe what you need
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Tell us what you're trying to build, who it's for, and what problem it solves..."
              rows={5}
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]/20 placeholder:text-gray-300 resize-none"
            />
          </div>

          {serviceType === 'mobile_app' && (
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
                Target platforms
              </label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`text-xs font-medium px-3 py-2 rounded-lg border transition-all ${
                      platforms.includes(p)
                        ? 'bg-[#2D3748] border-[#3B82F6] text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2 — Existing assets */}
      {step === 2 && (
        <div className="space-y-8">
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
              Do you have an existing brand identity?
            </label>
            <p className="text-xs text-gray-400 mb-3">Logo, colors, typography, brand guide</p>
            <div className="flex gap-3">
              {[
                { value: true, label: 'Yes — I have a brand' },
                { value: false, label: 'No — starting fresh' },
              ].map(opt => (
                <button
                  key={String(opt.value)}
                  onClick={() => setHasExistingBrand(opt.value)}
                  className={`flex-1 text-sm font-medium py-3 px-4 rounded-xl border transition-all ${
                    hasExistingBrand === opt.value
                      ? 'border-[#3B82F6] bg-[#2D3748]/5 text-[#3B82F6]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">
              Do you have existing designs or wireframes?
            </label>
            <p className="text-xs text-gray-400 mb-3">Figma files, sketches, reference screens</p>
            <div className="flex gap-3">
              {[
                { value: true, label: 'Yes — I have designs' },
                { value: false, label: 'No — need design too' },
              ].map(opt => (
                <button
                  key={String(opt.value)}
                  onClick={() => setHasExistingDesigns(opt.value)}
                  className={`flex-1 text-sm font-medium py-3 px-4 rounded-xl border transition-all ${
                    hasExistingDesigns === opt.value
                      ? 'border-[#3B82F6] bg-[#2D3748]/5 text-[#3B82F6]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3 — Timeline and budget */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-3">
              What's your timeline?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TIMELINES.map(t => (
                <button
                  key={t}
                  onClick={() => setTimeline(t)}
                  className={`text-sm font-medium py-3 px-4 rounded-xl border text-left transition-all ${
                    timeline === t
                      ? 'border-[#3B82F6] bg-[#2D3748]/5 text-[#3B82F6]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-3">
              Budget range <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {BUDGETS.map(b => (
                <button
                  key={b}
                  onClick={() => setBudgetRange(b)}
                  className={`text-sm font-medium py-3 px-4 rounded-xl border text-left transition-all ${
                    budgetRange === b
                      ? 'border-[#3B82F6] bg-[#2D3748]/5 text-[#3B82F6]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
              Anything else we should know? <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={additionalNotes}
              onChange={e => setAdditionalNotes(e.target.value)}
              placeholder="Reference links, competitors you admire, specific requirements..."
              rows={4}
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]/20 placeholder:text-gray-300 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-100">
        <button
          onClick={() => step === 1 ? router.push('/dashboard/services') : setStep(s => s - 1)}
          className="text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
        >
          {step === 1 ? 'Cancel' : '← Previous'}
        </button>

        {step < 3 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={step === 1 ? !canProceedStep1() : !canProceedStep2()}
            className="flex items-center gap-2 bg-[#2D3748] text-white text-[15px] font-medium px-6 py-3 rounded-xl hover:bg-[#1E293B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!timeline || submitting}
            className="flex items-center gap-2 bg-[#2D3748] text-white text-[15px] font-medium px-6 py-3 rounded-xl hover:bg-[#1E293B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <><Loader2 size={14} className="animate-spin" /> Submitting...</>
            ) : (
              <><Send size={14} /> Submit inquiry</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
