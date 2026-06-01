'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Loader2, Check } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface FieldScore {
  score: number
  feedback: string | null
}

interface Answers {
  businessDescription: string
  problemSolved: string
  transformation: string
  customerWho: string
  customerFrustration: string
  customerTriedBefore: string
  customerBuyingTrigger: string
  competitors: string
  differentiator: string
  differentiatorOwn: string
  toneTraits: string
  brandsAdmired: string
  neverSoundLike: string
  marketingBudget: string
  channels: string
  monthlyGoal: string
}

interface Props {
  profileId: string
  companyName: string
  initialAnswers: Record<string, unknown> | null
  initialScore: number
  initialFieldScores: Record<string, FieldScore>
  foundationComplete: boolean
  lastUpdated: string | null
}

// ── Field groups ───────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  businessDescription:   'Business description',
  problemSolved:         'Problem solved',
  transformation:        'Customer transformation',
  customerWho:           'Customer description',
  customerFrustration:   'Customer frustration',
  customerTriedBefore:   'What they tried before',
  customerBuyingTrigger: 'Buying trigger',
  competitors:           'Competitors',
  differentiator:        'Differentiator',
  differentiatorOwn:     'Differentiator (own words)',
  toneTraits:            'Tone traits',
  brandsAdmired:         'Brands admired',
  neverSoundLike:        'Never sound like',
  marketingBudget:       'Marketing budget',
  channels:              'Channels',
  monthlyGoal:           'Monthly goal',
}

const FIELD_GROUPS = [
  {
    title: 'Your Business',
    fields: ['businessDescription', 'problemSolved', 'transformation'],
  },
  {
    title: 'Your Customer',
    fields: ['customerWho', 'customerFrustration', 'customerTriedBefore', 'customerBuyingTrigger'],
  },
  {
    title: 'Your Position',
    fields: ['competitors', 'differentiator', 'differentiatorOwn'],
  },
  {
    title: 'Your Voice',
    fields: ['toneTraits', 'brandsAdmired', 'neverSoundLike'],
  },
  {
    title: 'Your 30 Days',
    fields: ['marketingBudget', 'channels', 'monthlyGoal'],
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeAnswers(raw: Record<string, unknown> | null): Answers {
  const stringify = (v: unknown): string => {
    if (!v) return ''
    if (Array.isArray(v)) return v.filter(Boolean).join(', ')
    return String(v)
  }
  return {
    businessDescription:   stringify(raw?.businessDescription),
    problemSolved:         stringify(raw?.problemSolved),
    transformation:        stringify(raw?.transformation),
    customerWho:           stringify(raw?.customerWho),
    customerFrustration:   stringify(raw?.customerFrustration),
    customerTriedBefore:   stringify(raw?.customerTriedBefore),
    customerBuyingTrigger: stringify(raw?.customerBuyingTrigger),
    competitors:           stringify(raw?.competitors),
    differentiator:        stringify(raw?.differentiator),
    differentiatorOwn:     stringify(raw?.differentiatorOwn),
    toneTraits:            stringify(raw?.toneTraits),
    brandsAdmired:         stringify(raw?.brandsAdmired),
    neverSoundLike:        stringify(raw?.neverSoundLike),
    marketingBudget:       stringify(raw?.marketingBudget),
    channels:              stringify(raw?.channels),
    monthlyGoal:           stringify(raw?.monthlyGoal),
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function scoreColor(score: number): string {
  if (score >= 80) return '#16a34a'
  if (score >= 60) return '#ca8a04'
  return '#3B82F6'
}

// ── Component ──────────────────────────────────────────────────────────────

export default function FoundationEditor({
  companyName,
  initialAnswers,
  initialScore,
  initialFieldScores,
  foundationComplete,
  lastUpdated,
}: Props) {
  const [answers, setAnswers] = useState<Answers>(normalizeAnswers(initialAnswers))
  const [savedAnswers] = useState<Answers>(normalizeAnswers(initialAnswers))
  const [score, setScore] = useState(initialScore)
  const [fieldScores, setFieldScores] = useState<Record<string, FieldScore>>(initialFieldScores)
  const [weakFields, setWeakFields] = useState<string[]>(
    Object.entries(initialFieldScores)
      .filter(([, v]) => v.score < 70 && v.score > 0)
      .sort((a, b) => a[1].score - b[1].score)
      .slice(0, 5)
      .map(([k]) => k)
  )
  const [rescoring, setRescoring] = useState(false)
  const [rescored, setRescored] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(lastUpdated)

  const hasChanges = JSON.stringify(answers) !== JSON.stringify(savedAnswers)

  function dispatchCanvasContext(currentAnswers: Answers, currentScore: number, currentWeakFields: string[]) {
    const filled = (v: string) => v?.trim() ? v.trim() : '(not filled in)'
    const lines = [
      `FOUNDATION PAGE`,
      `Score: ${currentScore}%`,
      ``,
      `CURRENT ANSWERS:`,
      ...Object.entries(FIELD_LABELS).map(([k, label]) =>
        `${label}: ${filled(currentAnswers[k as keyof Answers])}`
      ),
    ]
    if (currentWeakFields.length > 0) {
      lines.push(``, `WEAK AREAS (below 70%):`)
      currentWeakFields.forEach(f => lines.push(`- ${FIELD_LABELS[f]}`))
    }
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context: lines.join('\n') } }))
  }

  // Dispatch on mount so Maya knows the page state when the panel opens
  useEffect(() => {
    dispatchCanvasContext(answers, score, weakFields)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function updateField(key: keyof Answers, value: string) {
    setAnswers(prev => ({ ...prev, [key]: value }))
  }

  async function handleRescore() {
    setRescoring(true)
    try {
      const res = await fetch('/api/foundation/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      setScore(data.overallScore)
      setFieldScores(data.fieldScores ?? {})
      setWeakFields(data.topWeakFields ?? [])
      setLastUpdatedAt(new Date().toISOString())
      setRescored(true)
      window.dispatchEvent(new CustomEvent('foundation:rescored', { detail: { score: data.overallScore } }))
      dispatchCanvasContext(answers, data.overallScore, data.topWeakFields ?? [])
      setTimeout(() => setRescored(false), 3000)

      // Regenerate foundation documents in background
      const splitToArray = (s: string) => s ? s.split(',').map(x => x.trim()).filter(Boolean) : []
      const adaptedAnswers = {
        ...answers,
        competitors: splitToArray(answers.competitors),
        toneTraits:  splitToArray(answers.toneTraits),
        channels:    splitToArray(answers.channels),
      }
      setGenerating(true)
      fetch('/api/foundation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: adaptedAnswers, companyName }),
      })
        .catch(err => console.error('[foundation] doc generation failed:', err))
        .finally(() => setGenerating(false))
    } finally {
      setRescoring(false)
    }
  }

  // ── Empty state — no answers saved yet ──────────────────────────────────

  if (!initialAnswers) {
    return (
      <div className="px-8 pt-8 pb-6 max-w-[1200px]">
        <div className="mb-8">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-[#64748B] mb-2">Foundation</p>
          <h1 className="text-2xl font-bold text-gray-900">Your business foundation</h1>
          <p className="text-gray-500 text-sm mt-1">The answers that inform everything Maya creates for you.</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-4">
            <span className="text-gray-300 font-bold text-xl">M</span>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">
            {foundationComplete ? 'Foundation answers not yet scored' : 'Foundation not yet complete'}
          </p>
          <p className="text-xs text-gray-400 max-w-xs leading-relaxed mb-6">
            {foundationComplete
              ? 'Complete a rescore to unlock your Foundation living document.'
              : 'Complete your Foundation setup so Maya knows your business inside out.'}
          </p>
          <Link
            href="/foundation"
            className="px-5 py-2.5 bg-[#2D3748] text-white text-[15px] font-medium rounded-xl hover:bg-[#1E293B] transition-colors"
          >
            {foundationComplete ? 'Go to Foundation' : 'Set up Foundation'}
          </Link>
        </div>
      </div>
    )
  }

  // ── Main editor ──────────────────────────────────────────────────────────

  return (
    <div className="px-8 pt-8 pb-6 max-w-[1200px]">

      {/* Header */}
      <div className="mb-8">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-[#64748B] mb-2">Foundation</p>
        <h1 className="text-2xl font-bold text-gray-900">{companyName || 'Your'} foundation</h1>
        <p className="text-gray-500 text-sm mt-1">
          The answers that inform everything Maya creates for you. Edit anything, then rescore.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

        {/* Left — editable answers (3/5) */}
        <div className="lg:col-span-3 space-y-6">
          {FIELD_GROUPS.map(group => (
            <div key={group.title} className="bg-white rounded-2xl border border-gray-100 p-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">
                {group.title}
              </p>
              <div className="space-y-5">
                {group.fields.map(key => {
                  const fs = fieldScores[key]
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-gray-700">
                          {FIELD_LABELS[key]}
                        </label>
                        {fs && fs.score > 0 && (
                          <span style={{ color: scoreColor(fs.score) }} className="text-xs font-medium">
                            {fs.score}%
                          </span>
                        )}
                      </div>
                      <textarea
                        value={answers[key as keyof Answers]}
                        onChange={e => updateField(key as keyof Answers, e.target.value)}
                        rows={2}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-black resize-none placeholder:text-gray-300 transition-colors leading-relaxed"
                        placeholder={`Add your ${FIELD_LABELS[key]?.toLowerCase()}…`}
                      />
                      {fs?.feedback && fs.score < 70 && (
                        <p className="text-xs text-orange-500 mt-1 leading-relaxed">
                          {fs.feedback}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right — score card (2/5) */}
        <div className="lg:col-span-2 sticky top-6 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900">Foundation strength</h3>
              <span
                className="text-2xl font-bold"
                style={{ color: scoreColor(score) }}
              >
                {score}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-100 rounded-full h-2 mb-6">
              <div
                className="rounded-full h-2 transition-all duration-500"
                style={{
                  width: `${score}%`,
                  background: scoreColor(score),
                }}
              />
            </div>

            {/* Weak fields */}
            {weakFields.length > 0 && (
              <div className="space-y-3 mb-5">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Areas to strengthen
                </p>
                {weakFields.map(field => (
                  <div key={field} className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-gray-700">
                        {FIELD_LABELS[field]}
                      </p>
                      {fieldScores[field]?.feedback && (
                        <p className="text-xs text-gray-400 leading-relaxed mt-0.5">
                          {fieldScores[field].feedback}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {weakFields.length === 0 && score > 0 && (
              <div className="flex items-center gap-2 mb-5 text-green-600">
                <Check size={14} />
                <p className="text-xs font-medium">Strong foundation — no weak areas</p>
              </div>
            )}

            <button
              onClick={handleRescore}
              disabled={rescoring}
              className="w-full py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {rescoring ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Rescoring…
                </>
              ) : rescored ? (
                <>
                  <Check size={13} className="text-green-500" />
                  Score updated
                </>
              ) : (
                hasChanges ? 'Save & rescore' : 'Rescore my foundation'
              )}
            </button>

            {generating && (
              <p className="text-xs text-gray-400 text-center mt-2 flex items-center justify-center gap-1.5">
                <Loader2 size={10} className="animate-spin" />
                Updating Maya&apos;s context…
              </p>
            )}
            {!generating && lastUpdatedAt && (
              <p className="text-xs text-gray-400 text-center mt-2">
                Last scored {relativeTime(lastUpdatedAt)}
              </p>
            )}
          </div>

          {/* What Maya does with this */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">What Maya uses this for</p>
            <ul className="space-y-1.5">
              {[
                'Every piece of content stays in your brand voice',
                'Campaigns are built around your actual customer',
                'Agents write with your differentiator front of mind',
                'Analytics recommendations fit your goals',
              ].map(item => (
                <li key={item} className="flex items-start gap-2 text-xs text-gray-500">
                  <div className="w-1 h-1 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </div>
  )
}
