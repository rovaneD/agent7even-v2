'use client'

import type { ReactNode } from 'react'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import type { SiteSnapshot } from '@/lib/foundation/siteSnapshot'
import {
  ONBOARDING_BUSINESS_TYPES,
  type OnboardingBusinessTypeId,
} from '@/lib/foundation/onboardingBusinessTypes'

export type OnboardChecklistItem = {
  id: string
  label: string
  ready: boolean
}

export type OnboardConfirmAnswers = {
  businessDescription: string
  customerWho: string
  customerFrustration: string
  visualCasting: string
  visualAesthetic: string
  transformation: string
  differentiatorOwn: string
  differentiator: string
  toneTraits: string[]
}

type Props = {
  businessName: string
  onBusinessNameChange: (value: string) => void
  businessType: OnboardingBusinessTypeId | null
  onBusinessTypeChange: (value: OnboardingBusinessTypeId) => void
  answers: OnboardConfirmAnswers
  onAnswerChange: <K extends keyof OnboardConfirmAnswers>(key: K, value: OnboardConfirmAnswers[K]) => void
  siteSnapshot: SiteSnapshot | null
  hostname: string
  websiteUrl: string
  checklist: OnboardChecklistItem[]
  generationError: string | null
  confirmSaving: boolean
  onBack: () => void
  onLooksGood: () => void
  onEditDetails: () => void
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-2 block text-sm font-medium text-gray-800">{children}</label>
}

export default function FoundationOnboardConfirm({
  businessName,
  onBusinessNameChange,
  businessType,
  onBusinessTypeChange,
  answers,
  onAnswerChange,
  siteSnapshot,
  hostname,
  websiteUrl,
  checklist,
  generationError,
  confirmSaving,
  onBack,
  onLooksGood,
  onEditDetails,
}: Props) {
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`

  const positioning = siteSnapshot?.marketPositioning ?? {
    primary: answers.transformation || answers.differentiatorOwn || answers.businessDescription,
    secondary: siteSnapshot?.customerSegments?.[0]?.description,
    tertiary: answers.differentiator || undefined,
  }

  const checklistItems = checklist.length
    ? checklist
    : [
        { id: 'identity', label: 'Core identity is accurate', ready: answers.businessDescription.length > 40 },
        { id: 'audience', label: 'Target audience is relevant', ready: answers.customerWho.length > 25 },
        {
          id: 'positioning',
          label: 'Marketing positioning makes sense',
          ready: Boolean(answers.differentiatorOwn || answers.differentiator || positioning.primary),
        },
      ]

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <header className="border-b border-gray-100 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2D3748]">
              <span className="text-sm font-bold text-white">M</span>
            </div>
            <span className="text-sm font-medium text-gray-900">Foundation setup</span>
          </div>
          <nav className="hidden items-center gap-2 text-xs text-gray-400 sm:flex">
            <span className="font-medium text-gray-900">Getting started</span>
            <span>›</span>
            <span>Strategy</span>
            <span>›</span>
            <span>Campaign</span>
            <span>›</span>
            <span>Content</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1 space-y-6 pb-28">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
              First, let&apos;s confirm some basics about your business.
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              We built this from {hostname || 'your website'}. Fix anything that&apos;s off before Maya generates your Foundation.
            </p>
          </div>

          {generationError ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
              {generationError}
            </div>
          ) : null}

          <SectionCard title="Business name">
            <input
              type="text"
              value={businessName}
              onChange={e => onBusinessNameChange(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-[#3B82F6] focus:outline-none"
              placeholder="Your business name"
            />
          </SectionCard>

          <SectionCard
            title="Type of business"
            subtitle="This helps Maya tailor campaigns and content formats."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {ONBOARDING_BUSINESS_TYPES.map(option => {
                const selected = businessType === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onBusinessTypeChange(option.id)}
                    className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                      selected
                        ? 'border-[#3B82F6] bg-blue-50/60 ring-1 ring-[#3B82F6]'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900">{option.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">{option.description}</p>
                  </button>
                )
              })}
            </div>
          </SectionCard>

          <SectionCard title="Elevator pitch" subtitle="Core identity">
            <textarea
              value={answers.businessDescription}
              onChange={e => onAnswerChange('businessDescription', e.target.value)}
              rows={5}
              className="w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm leading-relaxed text-gray-900 focus:border-[#3B82F6] focus:outline-none"
            />
          </SectionCard>

          <SectionCard title="Logo">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={faviconUrl}
                  alt=""
                  className="h-12 w-12 object-contain"
                  onError={e => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
              <p className="text-sm text-gray-500">
                Pulled from your site. Upload a full logo later in Brand Kit.
              </p>
            </div>
          </SectionCard>

          <SectionCard title="Who you're speaking to">
            <FieldLabel>Ideal customer</FieldLabel>
            <textarea
              value={answers.customerWho}
              onChange={e => onAnswerChange('customerWho', e.target.value)}
              rows={3}
              className="mb-4 w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm leading-relaxed text-gray-900 focus:border-[#3B82F6] focus:outline-none"
            />
            <FieldLabel>What frustrates them</FieldLabel>
            <textarea
              value={answers.customerFrustration}
              onChange={e => onAnswerChange('customerFrustration', e.target.value)}
              rows={3}
              className="w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm leading-relaxed text-gray-900 focus:border-[#3B82F6] focus:outline-none"
            />
          </SectionCard>

          <SectionCard title="Who appears in your content">
            <FieldLabel>Casting & representation</FieldLabel>
            <textarea
              value={answers.visualCasting}
              onChange={e => onAnswerChange('visualCasting', e.target.value)}
              rows={3}
              placeholder="e.g. Real small-business owners, mid-action — diverse, authentic, never stock-photo stiff"
              className="w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm leading-relaxed text-gray-900 focus:border-[#3B82F6] focus:outline-none"
            />
            {answers.visualAesthetic ? (
              <>
                <FieldLabel>Visual aesthetic</FieldLabel>
                <textarea
                  value={answers.visualAesthetic}
                  onChange={e => onAnswerChange('visualAesthetic', e.target.value)}
                  rows={2}
                  className="mt-4 w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm leading-relaxed text-gray-900 focus:border-[#3B82F6] focus:outline-none"
                />
              </>
            ) : null}
          </SectionCard>

          {answers.toneTraits.length > 0 ? (
            <SectionCard title="Brand voice">
              <div className="flex flex-wrap gap-2">
                {answers.toneTraits.map(trait => (
                  <span
                    key={trait}
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-700"
                  >
                    {trait}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={onEditDetails}
                className="mt-3 text-sm font-medium text-[#3B82F6] hover:underline"
              >
                Edit voice traits in full wizard →
              </button>
            </SectionCard>
          ) : null}

          <SectionCard title="Market positioning">
            <ul className="space-y-3 text-sm leading-relaxed text-gray-800">
              <li>
                <span className="font-medium text-gray-900">Primary: </span>
                {positioning.primary}
              </li>
              {positioning.secondary ? (
                <li>
                  <span className="font-medium text-gray-900">Secondary: </span>
                  {positioning.secondary}
                </li>
              ) : null}
              {positioning.tertiary ? (
                <li>
                  <span className="font-medium text-gray-900">Tertiary: </span>
                  {positioning.tertiary}
                </li>
              ) : null}
            </ul>
            {siteSnapshot?.competitiveAdvantages?.length ? (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Competitive advantages
                </p>
                <ul className="space-y-1 text-sm text-gray-700">
                  {siteSnapshot.competitiveAdvantages.slice(0, 4).map(item => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </SectionCard>

          <p className="text-xs text-gray-400">
            Source: {websiteUrl || hostname}
          </p>
        </div>

        <aside className="hidden w-72 flex-shrink-0 lg:block">
          <div className="sticky top-8 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Does this look right?</h2>
            <p className="mt-2 text-sm text-gray-500">
              We built this from your website. Fix anything that&apos;s off.
            </p>

            <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-gray-400">
              What to check
            </p>
            <ul className="mt-3 space-y-3">
              {checklistItems.map(item => (
                <li key={item.id} className="flex items-start gap-2 text-sm">
                  <span
                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                      item.ready ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {item.ready ? <Check size={12} /> : null}
                  </span>
                  <span className={item.ready ? 'text-gray-700' : 'text-gray-500'}>{item.label}</span>
                </li>
              ))}
            </ul>

            <p className="mt-5 text-sm text-gray-500">
              Need to add or edit? Click any section on the left.
            </p>
            <p className="mt-4 text-sm text-gray-600">
              <span className="font-medium text-gray-900">Why this matters:</span>{' '}
              The more accurate this is, the better your content will be.
            </p>
          </div>
        </aside>
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={onBack}
            disabled={confirmSaving}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onEditDetails}
              disabled={confirmSaving}
              className="hidden rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:border-gray-300 sm:inline-flex disabled:opacity-50"
            >
              Full wizard
            </button>
            <button
              type="button"
              onClick={onLooksGood}
              disabled={confirmSaving || !businessName.trim() || !answers.businessDescription.trim()}
              className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-60"
              style={{ backgroundColor: '#3B82F6' }}
            >
              {confirmSaving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Finishing…
                </>
              ) : (
                'Looks good'
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
