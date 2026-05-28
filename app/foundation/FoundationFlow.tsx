'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft, Loader2, Check } from 'lucide-react'

interface Props {
  profileId: string
  companyName: string
  initialStep: number
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

const DIFFERENTIATOR_OPTIONS = [
  'Better quality',
  'Faster results',
  'More personal',
  'Lower price',
  'Specialized for one type of customer',
  'Something completely different',
]

const TONE_OPTIONS = [
  'Professional', 'Casual', 'Bold', 'Gentle',
  'Expert', 'Peer', 'Serious', 'Playful',
  'Warm', 'Direct', 'Inspiring', 'Grounded',
]

const CHANNEL_OPTIONS = [
  'Instagram', 'Email', 'Website', 'TikTok',
  'Google', 'LinkedIn', 'Facebook', 'YouTube',
]

const BUDGET_OPTIONS = [
  'Under $200/mo', '$200–$500/mo', '$500–$1,500/mo',
  '$1,500–$5,000/mo', '$5,000+/mo',
]

const GOAL_OPTIONS = [
  'Get my first 10 customers',
  'Launch a product or service',
  'Build my audience from zero',
  'Drive traffic to my website',
  'Get more reviews and social proof',
]

const ALL_DOCS = ['Business brief', 'Ideal customer profile', 'Positioning statement', 'Brand voice guide', '30-day plan']

export default function FoundationFlow({ profileId, companyName, initialStep }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(initialStep)
  const [generating, setGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState<string[]>([])
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

  async function handleGenerate() {
    setGenerating(true)

    for (let i = 0; i < ALL_DOCS.length; i++) {
      await new Promise(r => setTimeout(r, 600))
      setGenerationProgress(prev => [...prev, ALL_DOCS[i]])
    }

    try {
      await fetch('/api/foundation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, companyName }),
      })
      router.push('/maya?new=true')
    } catch {
      setGenerating(false)
    }
  }

  // ── Generation screen ──────────────────────────────────────────────────────

  if (generating) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-sm w-full px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center mx-auto mb-6">
            <span className="text-white font-bold text-xl">M</span>
          </div>
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
                  <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center flex-shrink-0">
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
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="text-sm font-medium text-gray-900">Maya</span>
        </div>
        <div className="flex items-center gap-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className={`h-1.5 w-8 rounded-full transition-all duration-300 ${i <= step ? 'bg-black' : 'bg-gray-100'}`}
            />
          ))}
          <span className="text-xs text-gray-400 ml-2">{step + 1} of 5</span>
        </div>
      </div>

      {/* Maya intro */}
      <div className="px-6 py-6 border-b border-gray-50 bg-gray-50/50">
        <div className="max-w-2xl mx-auto flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white font-bold text-xs">M</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 mb-0.5">Maya</p>
            <p className="text-sm text-gray-600 leading-relaxed">{MAYA_INTROS[step]}</p>
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
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black resize-none placeholder:text-gray-300 transition-colors"
                />
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
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black resize-none placeholder:text-gray-300 transition-colors"
                />
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
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black resize-none placeholder:text-gray-300 transition-colors"
                />
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
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black resize-none placeholder:text-gray-300 transition-colors"
                />
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
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black resize-none placeholder:text-gray-300 transition-colors"
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
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black resize-none placeholder:text-gray-300 transition-colors"
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
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black resize-none placeholder:text-gray-300 transition-colors"
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
                      className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black placeholder:text-gray-300 transition-colors"
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
                          ? 'border-black bg-black text-white'
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
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black resize-none placeholder:text-gray-300 transition-colors"
                />
              </div>
            </div>
          )}

          {/* STEP 4 — Voice */}
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
                          ? 'border-black bg-black text-white'
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
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black placeholder:text-gray-300 transition-colors"
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
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black placeholder:text-gray-300 transition-colors"
                />
              </div>
            </div>
          )}

          {/* STEP 5 — Plan */}
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
                          ? 'border-black bg-black text-white'
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
                          ? 'border-black bg-black text-white'
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
                          ? 'border-black bg-black text-white'
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
            className="flex items-center gap-2 bg-black text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {step === 4 ? 'Build my foundation' : 'Continue'}
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
