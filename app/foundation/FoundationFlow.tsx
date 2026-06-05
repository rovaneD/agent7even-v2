'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft, Loader2, Check, AlertCircle, Globe } from 'lucide-react'
import type { FoundationSuggestions } from '@/lib/research/exa'

type GenerationStage = 'scoring' | 'generating'
type PrefillPhase = 'input' | 'loading' | 'done' | 'skipped'

interface FieldScore {
  score: number
  feedback: string | null
}

const FIELD_LABELS: Record<string, string> = {
  businessDescription:   'Business description',
  problemSolved:         'Problem solved',
  transformation:        'Customer transformation',
  customerWho:           'Customer description',
  customerFrustration:   'Customer frustration',
  customerTriedBefore:   'What they tried before',
  customerBuyingTrigger: 'Buying trigger',
  differentiator:        'Differentiator',
  differentiatorOwn:     'Differentiator (own words)',
  toneTraits:            'Tone traits',
  brandsAdmired:         'Brands admired',
  neverSoundLike:        'Never sound like',
  marketingBudget:       'Marketing budget',
  channels:              'Channels',
  monthlyGoal:           'Monthly goal',
  competitors:           'Competitors',
}

function getStepForField(fieldKey: string): number {
  const stepMap: Record<string, number> = {
    businessDescription: 0, problemSolved: 0, transformation: 0,
    customerWho: 1, customerFrustration: 1, customerTriedBefore: 1, customerBuyingTrigger: 1,
    competitors: 2, differentiator: 2, differentiatorOwn: 2,
    toneTraits: 3, brandsAdmired: 3, neverSoundLike: 3,
    marketingBudget: 4, channels: 4, monthlyGoal: 4,
  }
  return stepMap[fieldKey] ?? 0
}

interface Props {
  profileId: string
  companyName: string
  initialStep: number
  selectedPlan?: string
}

interface StepAnswers {
  businessDescription: string
  problemSolved: string
  transformation: string
  customerWho: string
  customerFrustration: string
  customerTriedBefore: string
  customerBuyingTrigger: string
  competitors: string[]
  differentiator: string
  differentiatorOwn: string
  toneTraits: string[]
  brandsAdmired: string
  neverSoundLike: string
  marketingBudget: string
  channels: string[]
  monthlyGoal: string
}

const MAYA_INTROS = [
  "Let's start with the basics. Tell me about your business in your own words — no polished pitch needed.",
  "Now let's talk about who you're actually serving. The more specific you are here, the better everything else works.",
  "Every great brand stands for something specific. Let's figure out what makes you different from everyone else.",
  "How you sound is as important as what you say. Let's define your brand voice so every piece of content feels like you.",
  "Last step. Let's set up your first 30 days so you know exactly what to do and when.",
]

const STEP_TITLES = [
  'Your Business',
  'Your Customer',
  'Your Position',
  'Your Voice',
  'Your 30 Days',
]

export const DIFFERENTIATOR_OPTIONS = [
  'Better quality',
  'Faster results',
  'More personal',
  'Lower price',
  'Specialized for one type of customer',
  'Something completely different',
]

export const TONE_OPTIONS = [
  'Professional', 'Casual', 'Bold', 'Gentle',
  'Expert', 'Peer', 'Serious', 'Playful',
  'Warm', 'Direct', 'Inspiring', 'Grounded',
]

export const CHANNEL_OPTIONS = [
  'Instagram', 'Email', 'Website', 'TikTok',
  'Google', 'LinkedIn', 'Facebook', 'YouTube',
]

export const BUDGET_OPTIONS = [
  'Under $200/mo', '$200–$500/mo', '$500–$1,500/mo',
  '$1,500–$5,000/mo', '$5,000+/mo',
]

export const GOAL_OPTIONS = [
  'Get my first 10 customers',
  'Launch a product or service',
  'Build my audience from zero',
  'Drive traffic to my website',
  'Get more reviews and social proof',
]

const ALL_DOCS = ['Business brief', 'Ideal customer profile', 'Positioning statement', 'Brand voice guide', '30-day plan']
const DOC_LABEL_BY_TYPE: Record<string, string> = {
  brief: 'Business brief',
  icp: 'Ideal customer profile',
  positioning: 'Positioning statement',
  voice: 'Brand voice guide',
  plan: '30-day plan',
}

const EXA_PREFILL_ENABLED = process.env.NEXT_PUBLIC_EXA_PREFILL_ENABLED === 'true'

function assignVariant(): 'exa_prefill' | 'manual_control' {
  if (!EXA_PREFILL_ENABLED) return 'manual_control'
  return Math.random() < 0.5 ? 'exa_prefill' : 'manual_control'
}

// Pre-filled fields are editable suggestions — styled with a blue tint + label.
function SuggestionLabel() {
  return (
    <p className="text-xs mt-1" style={{ color: '#9BA1AE' }}>
      Maya&apos;s suggestion — edit freely
    </p>
  )
}

export default function FoundationFlow({ profileId, companyName, initialStep, selectedPlan }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(initialStep)
  const [generating, setGenerating] = useState(false)
  const [generationStage, setGenerationStage] = useState<GenerationStage>('scoring')
  const [generationProgress, setGenerationProgress] = useState<string[]>([])
  const [showWeakFieldsWarning, setShowWeakFieldsWarning] = useState(false)
  const [foundationScore, setFoundationScore] = useState<number | null>(null)
  const [weakFields, setWeakFields] = useState<string[]>([])
  const [fieldScores, setFieldScores] = useState<Record<string, FieldScore>>({})
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<StepAnswers>({
    businessDescription: '',
    problemSolved: '',
    transformation: '',
    customerWho: '',
    customerFrustration: '',
    customerTriedBefore: '',
    customerBuyingTrigger: '',
    competitors: ['', '', ''],
    differentiator: '',
    differentiatorOwn: '',
    toneTraits: [],
    brandsAdmired: '',
    neverSoundLike: '',
    marketingBudget: '',
    channels: [],
    monthlyGoal: '',
  })

  // Pre-fill state — only active for new users (initialStep === 0) in the exa_prefill cohort.
  const [variant] = useState<'exa_prefill' | 'manual_control'>(() => assignVariant())
  const showPrefill = EXA_PREFILL_ENABLED && variant === 'exa_prefill' && initialStep === 0
  const [prefillPhase, setPrefillPhase] = useState<PrefillPhase>(showPrefill ? 'input' : 'skipped')
  const [websiteInput, setWebsiteInput] = useState('')
  const [businessNameInput, setBusinessNameInput] = useState('')
  const [prefillSuggestions, setPrefillSuggestions] = useState<FoundationSuggestions | null>(null)

  function isSuggested(field: keyof FoundationSuggestions): boolean {
    const val = prefillSuggestions?.[field]
    return val != null && (!Array.isArray(val) || val.length > 0)
  }

  function updateAnswer<K extends keyof StepAnswers>(key: K, value: StepAnswers[K]) {
    setAnswers(prev => ({ ...prev, [key]: value }))
  }

  function toggleArrayItem(key: keyof StepAnswers, item: string, max?: number) {
    setAnswers(prev => {
      const arr = prev[key] as string[]
      if (arr.includes(item)) return { ...prev, [key]: arr.filter(x => x !== item) }
      if (max && arr.length >= max) return prev
      return { ...prev, [key]: [...arr, item] }
    })
  }

  function canProceed() {
    switch (step) {
      case 0: return answers.businessDescription.length > 10 && answers.problemSolved.length > 10
      case 1: return answers.customerWho.length > 5 && answers.customerFrustration.length > 5
      case 2: return answers.differentiator.length > 0
      case 3: return answers.toneTraits.length >= 2
      case 4: return answers.marketingBudget.length > 0 && answers.monthlyGoal.length > 0
      default: return false
    }
  }

  async function saveStep() {
    await fetch('/api/foundation/save-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, answers }),
    })
  }

  async function handleNext() {
    await saveStep()
    if (step < 4) {
      setStep(s => s + 1)
    } else {
      await handleGenerate()
    }
  }

  async function callGenerate() {
    const res = await fetch('/api/foundation/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, companyName }),
    })
    const data = await res.json().catch(() => ({}))
    const generated = Array.isArray(data.generated) ? data.generated : []
    setGenerationProgress(generated.map((type: string) => DOC_LABEL_BY_TYPE[type]).filter(Boolean))
    if (!res.ok || data.success !== true) {
      if (res.status === 402 || data.error === 'INSUFFICIENT_CREDITS') {
        throw new Error('Your Foundation could not be generated because this account has no available credits.')
      }
      throw new Error(data.error || 'Your Foundation could not be generated. Please try again.')
    }
    setGenerationProgress(ALL_DOCS)
    router.push(selectedPlan ? `/checkout-now?plan=${encodeURIComponent(selectedPlan)}` : '/pricing?foundation=complete')
  }

  async function handleGenerate() {
    setGenerationError(null)
    setGenerating(true)
    setGenerationStage('scoring')

    try {
      const scoreRes = await fetch('/api/foundation/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const scoreData = await scoreRes.json()

      if (scoreData.overallScore < 50) {
        setFoundationScore(scoreData.overallScore)
        setWeakFields(scoreData.topWeakFields ?? [])
        setFieldScores(scoreData.fieldScores ?? {})
        setGenerating(false)
        setShowWeakFieldsWarning(true)
        return
      }

      setGenerationStage('generating')
      await callGenerate()
    } catch (error) {
      setGenerating(false)
      setGenerationError(error instanceof Error ? error.message : 'Your Foundation could not be generated. Please try again.')
    }
  }

  async function handleGenerateAnyway() {
    setShowWeakFieldsWarning(false)
    setGenerationError(null)
    setGenerating(true)
    setGenerationStage('generating')
    try {
      await callGenerate()
    } catch (error) {
      setGenerating(false)
      setGenerationError(error instanceof Error ? error.message : 'Your Foundation could not be generated. Please try again.')
    }
  }

  // ── Pre-fill handlers ─────────────────────────────────────────────────────

  async function handlePrefillSubmit() {
    if (!websiteInput.trim() && !businessNameInput.trim()) return
    setPrefillPhase('loading')

    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000))

    const fetchResearch = fetch('/api/foundation/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        website: websiteInput.trim() || undefined,
        businessName: businessNameInput.trim() || undefined,
      }),
    })
      .then(r => r.json())
      .catch(() => null)

    const result = await Promise.race([fetchResearch, timeout])

    if (!result || !result.prefilled || !result.research?.suggestions) {
      setPrefillPhase('skipped')
      return
    }

    const suggestions: FoundationSuggestions = result.research.suggestions

    // Apply suggestions to answers for eligible fields.
    setAnswers(prev => {
      const updated = { ...prev }
      if (suggestions.businessDescription) updated.businessDescription = suggestions.businessDescription
      if (suggestions.problemSolved)       updated.problemSolved = suggestions.problemSolved
      if (suggestions.transformation)      updated.transformation = suggestions.transformation ?? ''
      if (suggestions.customerWho)         updated.customerWho = suggestions.customerWho
      if (suggestions.differentiatorOwn)   updated.differentiatorOwn = suggestions.differentiatorOwn ?? ''
      if (suggestions.competitors?.length) {
        const filled = suggestions.competitors.slice(0, 3)
        const padded = [...filled, ...['', '', '']].slice(0, 3)
        updated.competitors = padded
      }
      return updated
    })

    setPrefillSuggestions(suggestions)
    setPrefillPhase('done')
  }

  function handleSkipPrefill() {
    setPrefillPhase('skipped')
  }

  // ── Pre-step screen ───────────────────────────────────────────────────────

  if (prefillPhase === 'input') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-lg w-full">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#2D3748] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold">M</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Maya</p>
              <p className="text-xs text-gray-400">Foundation setup</p>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Let me do some homework first.
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            Drop your website or business name and I&apos;ll research your business before
            we start — so you&apos;re confirming instead of writing from scratch.
          </p>

          <div className="space-y-4 mb-6">
            <div>
              <label className="text-sm font-semibold text-gray-800 block mb-2">
                Website URL{' '}
                <span className="text-gray-400 font-normal">(recommended)</span>
              </label>
              <div className="relative">
                <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="url"
                  value={websiteInput}
                  onChange={e => setWebsiteInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePrefillSubmit()}
                  placeholder="https://yourbusiness.com"
                  className="w-full text-sm border border-gray-200 rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:border-[#3B82F6] placeholder:text-gray-300 transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-800 block mb-2">
                Business name{' '}
                <span className="text-gray-400 font-normal">(optional if you have a URL)</span>
              </label>
              <input
                type="text"
                value={businessNameInput}
                onChange={e => setBusinessNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePrefillSubmit()}
                placeholder={companyName || 'Your Business Name'}
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#3B82F6] placeholder:text-gray-300 transition-colors"
              />
            </div>
          </div>

          <button
            onClick={handlePrefillSubmit}
            disabled={!websiteInput.trim() && !businessNameInput.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#3B82F6' }}
          >
            Let Maya look it up
            <ArrowRight size={15} />
          </button>

          <button
            onClick={handleSkipPrefill}
            className="w-full mt-3 py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip — I&apos;ll fill this in myself
          </button>
        </div>
      </div>
    )
  }

  // ── Pre-fill loading screen ───────────────────────────────────────────────

  if (prefillPhase === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-sm w-full px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#2D3748] flex items-center justify-center mx-auto mb-6">
            <span className="text-white font-bold text-xl">M</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Looking into your business...
          </h2>
          <p className="text-sm text-gray-400 mb-8">
            Maya is reading your site and finding what she can.
          </p>
          <div className="flex justify-center">
            <Loader2 size={24} className="text-gray-300 animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  // ── Weak fields warning ────────────────────────────────────────────────────

  if (showWeakFieldsWarning) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-lg w-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#2D3748] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold">M</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Maya</p>
              <p className="text-xs text-gray-400">Foundation review</p>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            A few answers could be stronger
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            Your foundation is {foundationScore}% complete. Stronger answers help me
            create better content — but you can always improve this later.
          </p>
          <div className="space-y-3 mb-8">
            {weakFields.map(fieldKey => (
              <div key={fieldKey} className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle size={14} className="text-orange-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {FIELD_LABELS[fieldKey] ?? fieldKey}
                    </p>
                    {fieldScores[fieldKey]?.feedback && (
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        {fieldScores[fieldKey].feedback}
                      </p>
                    )}
                    <button
                      onClick={() => {
                        setShowWeakFieldsWarning(false)
                        setStep(getStepForField(fieldKey))
                      }}
                      className="text-xs font-medium text-black underline mt-2 block"
                    >
                      Improve this answer →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowWeakFieldsWarning(false)}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:border-gray-400 transition-colors"
            >
              Go back and improve
            </button>
            <button
              onClick={handleGenerateAnyway}
              className="flex-1 py-3 bg-[#2D3748] text-white rounded-xl text-sm font-medium hover:bg-[#1E293B] transition-colors"
            >
              Generate anyway
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Generation screen ──────────────────────────────────────────────────────

  if (generating) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-sm w-full px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#2D3748] flex items-center justify-center mx-auto mb-6">
            <span className="text-white font-bold text-xl">M</span>
          </div>
          {generationStage === 'scoring' ? (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Evaluating your answers...
              </h2>
              <p className="text-sm text-gray-400 mb-8">
                Maya is reviewing each answer for specificity.
              </p>
              <div className="flex justify-center">
                <Loader2 size={24} className="text-gray-300 animate-spin" />
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Building your foundation...
              </h2>
              <p className="text-sm text-gray-400 mb-8">
                Maya is reviewing your answers and generating your documents.
              </p>
              <div className="space-y-3 text-left">
                {ALL_DOCS.map(doc => (
                  <div key={doc} className="flex items-center gap-3">
                    {generationProgress.includes(doc) ? (
                      <div className="w-5 h-5 rounded-full bg-[#2D3748] flex items-center justify-center flex-shrink-0">
                        <Check size={11} className="text-white" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex items-center justify-center flex-shrink-0">
                        <Loader2 size={11} className="text-gray-300 animate-spin" />
                      </div>
                    )}
                    <span className={`text-sm ${generationProgress.includes(doc) ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                      {doc}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Step flow ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Header */}
      <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#2D3748] flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="text-sm font-medium text-gray-900">Maya</span>
        </div>
        <div className="flex items-center gap-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className={`h-1.5 w-8 rounded-full transition-all duration-300 ${i <= step ? 'bg-[#2D3748]' : 'bg-gray-100'}`}
            />
          ))}
          <span className="text-xs text-gray-400 ml-2">{step + 1} of 5</span>
        </div>
      </div>

      {/* Maya intro */}
      <div className="px-6 py-6 border-b border-gray-50 bg-gray-50/50">
        <div className="max-w-2xl mx-auto flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#2D3748] flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white font-bold text-xs">M</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 mb-0.5">Maya</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              {prefillPhase === 'done' && step === 0
                ? "I looked up your business and pre-filled some fields. Review them and edit anything that's off — these are my best guesses, not facts."
                : MAYA_INTROS[step]
              }
            </p>
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">
            Step {step + 1} — {STEP_TITLES[step]}
          </p>

          {/* STEP 1 — Business */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-2">
                  What does {companyName || 'your business'} do?
                </label>
                <textarea
                  value={answers.businessDescription}
                  onChange={e => updateAnswer('businessDescription', e.target.value)}
                  placeholder="e.g. I make handmade skincare products for women with sensitive skin"
                  rows={3}
                  className={`w-full text-sm border rounded-xl px-4 py-3 focus:outline-none resize-none placeholder:text-gray-300 transition-colors ${
                    isSuggested('businessDescription')
                      ? 'border-blue-200 bg-blue-50/30 focus:border-[#3B82F6]'
                      : 'border-gray-200 focus:border-[#2D3748]'
                  }`}
                />
                {isSuggested('businessDescription') && <SuggestionLabel />}
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-2">
                  What problem do you solve?
                </label>
                <textarea
                  value={answers.problemSolved}
                  onChange={e => updateAnswer('problemSolved', e.target.value)}
                  placeholder="e.g. Most skincare products have harsh chemicals that cause reactions for sensitive skin types"
                  rows={3}
                  className={`w-full text-sm border rounded-xl px-4 py-3 focus:outline-none resize-none placeholder:text-gray-300 transition-colors ${
                    isSuggested('problemSolved')
                      ? 'border-blue-200 bg-blue-50/30 focus:border-[#3B82F6]'
                      : 'border-gray-200 focus:border-[#2D3748]'
                  }`}
                />
                {isSuggested('problemSolved') && <SuggestionLabel />}
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-2">
                  What does life look like for a customer after working with you?{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={answers.transformation}
                  onChange={e => updateAnswer('transformation', e.target.value)}
                  placeholder="e.g. They finally have a skincare routine that doesn't cause flare-ups"
                  rows={2}
                  className={`w-full text-sm border rounded-xl px-4 py-3 focus:outline-none resize-none placeholder:text-gray-300 transition-colors ${
                    isSuggested('transformation')
                      ? 'border-blue-200 bg-blue-50/30 focus:border-[#3B82F6]'
                      : 'border-gray-200 focus:border-[#2D3748]'
                  }`}
                />
                {isSuggested('transformation') && <SuggestionLabel />}
              </div>
            </div>
          )}

          {/* STEP 2 — Customer */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-2">
                  Who is your ideal customer?
                </label>
                <textarea
                  value={answers.customerWho}
                  onChange={e => updateAnswer('customerWho', e.target.value)}
                  placeholder="e.g. Women 30–50 with sensitive skin who shop online and care about clean ingredients"
                  rows={2}
                  className={`w-full text-sm border rounded-xl px-4 py-3 focus:outline-none resize-none placeholder:text-gray-300 transition-colors ${
                    isSuggested('customerWho')
                      ? 'border-blue-200 bg-blue-50/30 focus:border-[#3B82F6]'
                      : 'border-gray-200 focus:border-[#2D3748]'
                  }`}
                />
                {isSuggested('customerWho') && <SuggestionLabel />}
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-2">
                  What&apos;s their biggest frustration before finding you?
                </label>
                <textarea
                  value={answers.customerFrustration}
                  onChange={e => updateAnswer('customerFrustration', e.target.value)}
                  placeholder="e.g. Every product they try causes breakouts or irritation"
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#2D3748] resize-none placeholder:text-gray-300 transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-2">
                  What have they already tried that didn&apos;t work?{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={answers.customerTriedBefore}
                  onChange={e => updateAnswer('customerTriedBefore', e.target.value)}
                  placeholder="e.g. Drugstore brands, expensive department store products, dermatologist recommendations"
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#2D3748] resize-none placeholder:text-gray-300 transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-2">
                  What makes them finally say yes and buy?{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={answers.customerBuyingTrigger}
                  onChange={e => updateAnswer('customerBuyingTrigger', e.target.value)}
                  placeholder="e.g. Seeing before/after photos from real customers with similar skin"
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#2D3748] resize-none placeholder:text-gray-300 transition-colors"
                />
              </div>
            </div>
          )}

          {/* STEP 3 — Position */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-2">
                  Who are your main competitors?{' '}
                  <span className="text-gray-400 font-normal">(up to 3 — optional)</span>
                </label>
                {isSuggested('competitors') && (
                  <p className="text-xs mb-2" style={{ color: '#9BA1AE' }}>
                    Maya found these — edit or clear any that aren&apos;t right
                  </p>
                )}
                <div className="space-y-2">
                  {[0, 1, 2].map(i => (
                    <input
                      key={i}
                      type="text"
                      value={answers.competitors[i]}
                      onChange={e => {
                        const updated = [...answers.competitors]
                        updated[i] = e.target.value
                        updateAnswer('competitors', updated)
                      }}
                      placeholder={`@competitor${i + 1} or business name`}
                      className={`w-full text-sm border rounded-xl px-4 py-3 focus:outline-none placeholder:text-gray-300 transition-colors ${
                        isSuggested('competitors') && answers.competitors[i]
                          ? 'border-blue-200 bg-blue-50/30 focus:border-[#3B82F6]'
                          : 'border-gray-200 focus:border-[#2D3748]'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-3">
                  What makes you different?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DIFFERENTIATOR_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => updateAnswer('differentiator', opt)}
                      className={`text-sm font-medium py-3 px-4 rounded-xl border text-left transition-all ${
                        answers.differentiator === opt
                          ? 'border-2 border-[#3B82F6] bg-blue-50/30 text-[#2D3748]'
                          : 'border-gray-200 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-2">
                  Say it in your own words{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={answers.differentiatorOwn}
                  onChange={e => updateAnswer('differentiatorOwn', e.target.value)}
                  placeholder="e.g. We're the only skincare brand that formulates specifically for sensitive + acne-prone skin types together"
                  rows={2}
                  className={`w-full text-sm border rounded-xl px-4 py-3 focus:outline-none resize-none placeholder:text-gray-300 transition-colors ${
                    isSuggested('differentiatorOwn')
                      ? 'border-blue-200 bg-blue-50/30 focus:border-[#3B82F6]'
                      : 'border-gray-200 focus:border-[#2D3748]'
                  }`}
                />
                {isSuggested('differentiatorOwn') && <SuggestionLabel />}
              </div>
            </div>
          )}

          {/* STEP 4 — Voice (never pre-filled) */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-1">
                  Pick words that describe how you want to sound{' '}
                  <span className="text-gray-400 font-normal">(pick at least 2, up to 4)</span>
                </label>
                <p className="text-xs text-gray-400 mb-3">These will guide every piece of content Maya creates for you</p>
                <div className="flex flex-wrap gap-2">
                  {TONE_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => toggleArrayItem('toneTraits', opt, 4)}
                      className={`text-sm font-medium px-4 py-2 rounded-full border transition-all ${
                        answers.toneTraits.includes(opt)
                          ? 'border-2 border-[#3B82F6] bg-blue-50/30 text-[#2D3748]'
                          : 'border-gray-200 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-2">
                  A brand whose voice you admire{' '}
                  <span className="text-gray-400 font-normal">(any industry — optional)</span>
                </label>
                <input
                  type="text"
                  value={answers.brandsAdmired}
                  onChange={e => updateAnswer('brandsAdmired', e.target.value)}
                  placeholder="e.g. Glossier, Patagonia, Morning Brew"
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#2D3748] placeholder:text-gray-300 transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-2">
                  One thing you never want to sound like{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={answers.neverSoundLike}
                  onChange={e => updateAnswer('neverSoundLike', e.target.value)}
                  placeholder="e.g. Corporate and stiff, overly salesy, like every other skincare brand"
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#2D3748] placeholder:text-gray-300 transition-colors"
                />
              </div>
            </div>
          )}

          {/* STEP 5 — Plan (never pre-filled) */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-3">
                  Monthly marketing budget
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {BUDGET_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => updateAnswer('marketingBudget', opt)}
                      className={`text-sm font-medium py-3 px-4 rounded-xl border text-left transition-all ${
                        answers.marketingBudget === opt
                          ? 'border-2 border-[#3B82F6] bg-blue-50/30 text-[#2D3748]'
                          : 'border-gray-200 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-1">
                  Where do you want to show up?{' '}
                  <span className="text-gray-400 font-normal">(pick all that apply)</span>
                </label>
                <div className="flex flex-wrap gap-2 mt-3">
                  {CHANNEL_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => toggleArrayItem('channels', opt)}
                      className={`text-sm font-medium px-4 py-2 rounded-full border transition-all ${
                        answers.channels.includes(opt)
                          ? 'border-2 border-[#3B82F6] bg-blue-50/30 text-[#2D3748]'
                          : 'border-gray-200 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-800 block mb-3">
                  One goal for this month
                </label>
                <div className="space-y-2">
                  {GOAL_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => updateAnswer('monthlyGoal', opt)}
                      className={`w-full text-sm font-medium py-3 px-4 rounded-xl border text-left transition-all ${
                        answers.monthlyGoal === opt
                          ? 'border-2 border-[#3B82F6] bg-blue-50/30 text-[#2D3748]'
                          : 'border-gray-200 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer nav */}
      <div className="border-t border-gray-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => step > 0 && setStep(s => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800 disabled:opacity-30 transition-colors"
          >
            <ArrowLeft size={15} />
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="flex items-center gap-2 bg-[#2D3748] text-white text-[15px] font-medium px-6 py-3 rounded-xl hover:bg-[#1E293B] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {step === 4 ? 'Build my foundation' : 'Continue'}
            <ArrowRight size={15} />
          </button>
        </div>
        {generationError && (
          <div className="mx-auto mt-3 flex max-w-2xl items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{generationError}</span>
          </div>
        )}
      </div>
    </div>
  )
}
