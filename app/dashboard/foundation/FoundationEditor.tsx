'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Loader2, Check } from 'lucide-react'
import {
  DIFFERENTIATOR_OPTIONS,
  TONE_OPTIONS,
  CHANNEL_OPTIONS,
  BUDGET_OPTIONS,
  GOAL_OPTIONS,
} from '@/app/foundation/FoundationFlow'

// ── Types ────────────────────────────────────────────────────────────────────

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
  competitors: [string, string, string]
  differentiator: string
  differentiatorOwn: string
  toneTraits: string[]
  brandsAdmired: string
  neverSoundLike: string
  marketingBudget: string
  channels: string[]
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

// ── Constants ────────────────────────────────────────────────────────────────

const COLLAPSED_MAX = 132

// Labels match FIELD_EXPECTATIONS in /api/foundation/score/route.ts — keep in sync
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number | undefined): string {
  if (score == null) return 'text-gray-400'
  if (score >= 85) return 'text-emerald-600'
  if (score >= 75) return 'text-lime-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-500'
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

function normalizeAnswers(raw: Record<string, unknown> | null): Answers {
  const empty: Answers = {
    businessDescription: '', problemSolved: '', transformation: '',
    customerWho: '', customerFrustration: '', customerTriedBefore: '', customerBuyingTrigger: '',
    competitors: ['', '', ''],
    differentiator: '', differentiatorOwn: '',
    toneTraits: [], brandsAdmired: '', neverSoundLike: '',
    marketingBudget: '', channels: [], monthlyGoal: '',
  }
  if (!raw) return empty

  const str = (v: unknown): string => {
    if (!v) return ''
    if (Array.isArray(v)) return v.filter(Boolean).map(String).join(', ')
    return String(v)
  }
  const strArr = (v: unknown): string[] => {
    if (!v) return []
    if (Array.isArray(v)) return v.filter(Boolean).map(String)
    if (typeof v === 'string') return v.split(',').map(x => x.trim()).filter(Boolean)
    return []
  }

  let competitors: [string, string, string] = ['', '', '']
  const rawComp = raw.competitors
  if (Array.isArray(rawComp)) {
    competitors = [String(rawComp[0] ?? ''), String(rawComp[1] ?? ''), String(rawComp[2] ?? '')]
  } else if (typeof rawComp === 'string' && rawComp) {
    const parts = rawComp.split(',').map(x => x.trim())
    competitors = [parts[0] ?? '', parts[1] ?? '', parts[2] ?? '']
  }

  return {
    businessDescription:   str(raw.businessDescription),
    problemSolved:         str(raw.problemSolved),
    transformation:        str(raw.transformation),
    customerWho:           str(raw.customerWho),
    customerFrustration:   str(raw.customerFrustration),
    customerTriedBefore:   str(raw.customerTriedBefore),
    customerBuyingTrigger: str(raw.customerBuyingTrigger),
    competitors,
    differentiator:        str(raw.differentiator),
    differentiatorOwn:     str(raw.differentiatorOwn),
    toneTraits:            strArr(raw.toneTraits),
    brandsAdmired:         str(raw.brandsAdmired),
    neverSoundLike:        str(raw.neverSoundLike),
    marketingBudget:       str(raw.marketingBudget),
    channels:              strArr(raw.channels),
    monthlyGoal:           str(raw.monthlyGoal),
  }
}

function computeWeakFields(scores: Record<string, FieldScore>): string[] {
  return Object.entries(scores)
    .filter(([, v]) => v.score > 0 && v.score < 70)
    .sort((a, b) => a[1].score - b[1].score)
    .slice(0, 5)
    .map(([k]) => k)
}

// ── AnswerField — auto-growing, collapsible text field ───────────────────────

function AnswerField({
  fieldKey,
  label,
  value,
  score,
  onChange,
}: {
  fieldKey: string
  label: string
  value: string
  score: FieldScore | undefined
  onChange: (key: string, value: string) => void
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  const resize = useCallback(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
    setOverflowing(ta.scrollHeight > COLLAPSED_MAX + 8)
  }, [])

  useEffect(() => { resize() }, [value, resize])
  useEffect(() => { resize() }, [focused, resize])
  useEffect(() => { resize() }, [expanded, resize])

  const isOpen = focused || expanded
  const collapsed = !isOpen && overflowing

  return (
    <div className="rounded-xl border border-gray-200/80 bg-white px-4 py-3.5 transition-colors hover:border-gray-300 focus-within:border-gray-400">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-gray-900">{label}</span>
        {score != null && score.score > 0 && (
          <span className={`flex-shrink-0 text-xs font-medium ${scoreColor(score.score)}`}>
            {score.score}%
          </span>
        )}
      </div>

      <div className="relative">
        <textarea
          ref={taRef}
          value={value}
          onChange={e => onChange(fieldKey, e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={1}
          spellCheck
          placeholder={`Add your ${label.toLowerCase()}…`}
          className="w-full resize-none border-0 bg-transparent p-0 text-[14px] leading-relaxed text-gray-600 outline-none placeholder:text-gray-400"
          style={{
            maxHeight: collapsed ? COLLAPSED_MAX : undefined,
            overflow: collapsed ? 'hidden' : 'visible',
          }}
        />
        {collapsed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
        )}
      </div>

      {score?.feedback && score.score < 70 && !focused && (
        <p className="mt-1.5 text-xs leading-relaxed text-amber-600">{score.feedback}</p>
      )}
      {overflowing && !focused && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-1.5 text-xs text-blue-600 hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

// ── CompetitorEntry — single auto-growing competitor input ───────────────────

function CompetitorEntry({
  index,
  value,
  onChange,
}: {
  index: number
  value: string
  onChange: (i: number, v: string) => void
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)

  const resize = useCallback(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }, [])

  useEffect(() => { resize() }, [value, resize])

  return (
    <div>
      <p className="mb-0.5 text-[11px] text-gray-400">Competitor {index + 1}</p>
      <textarea
        ref={taRef}
        value={value}
        onChange={e => onChange(index, e.target.value)}
        rows={1}
        spellCheck
        placeholder={`@competitor${index + 1} or business name`}
        className="w-full resize-none border-0 bg-transparent p-0 text-[14px] leading-relaxed text-gray-600 outline-none placeholder:text-gray-400"
      />
    </div>
  )
}

// ── CompetitorsField — 3 entries sharing one card ────────────────────────────

function CompetitorsField({
  values,
  score,
  onChange,
}: {
  values: [string, string, string]
  score: FieldScore | undefined
  onChange: (values: [string, string, string]) => void
}) {
  function updateEntry(i: number, v: string) {
    const updated = [...values] as [string, string, string]
    updated[i] = v
    onChange(updated)
  }

  return (
    <div className="rounded-xl border border-gray-200/80 bg-white px-4 py-3.5 transition-colors hover:border-gray-300 focus-within:border-gray-400">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-gray-900">Competitors</span>
        {score != null && score.score > 0 && (
          <span className={`flex-shrink-0 text-xs font-medium ${scoreColor(score.score)}`}>
            {score.score}%
          </span>
        )}
      </div>
      <div className="space-y-3 divide-y divide-gray-100">
        {values.map((v, i) => (
          <div key={i} className={i > 0 ? 'pt-3' : ''}>
            <CompetitorEntry index={i} value={v} onChange={updateEntry} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SingleChipField ──────────────────────────────────────────────────────────

function SingleChipField({
  label,
  options,
  value,
  score,
  fullWidth,
  onChange,
}: {
  label: string
  options: string[]
  value: string
  score: FieldScore | undefined
  fullWidth?: boolean
  onChange: (v: string) => void
}) {
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white px-4 py-3.5 transition-colors hover:border-gray-300">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-gray-900">{label}</span>
        {score != null && score.score > 0 && (
          <span className={`flex-shrink-0 text-xs font-medium ${scoreColor(score.score)}`}>
            {score.score}%
          </span>
        )}
      </div>
      <div className={fullWidth ? 'space-y-2' : 'grid grid-cols-2 gap-2'}>
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-lg border px-3 py-2 text-left text-[13px] font-medium transition-all ${
              value === opt
                ? 'border-transparent bg-gray-900 text-white'
                : 'border-gray-200 text-gray-600 hover:border-gray-400'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── MultiChipField ───────────────────────────────────────────────────────────

function MultiChipField({
  label,
  options,
  value,
  score,
  maxSelect,
  onChange,
}: {
  label: string
  options: string[]
  value: string[]
  score: FieldScore | undefined
  maxSelect?: number
  onChange: (v: string[]) => void
}) {
  function toggle(opt: string) {
    if (value.includes(opt)) {
      onChange(value.filter(v => v !== opt))
    } else if (!maxSelect || value.length < maxSelect) {
      onChange([...value, opt])
    }
  }

  return (
    <div className="rounded-xl border border-gray-200/80 bg-white px-4 py-3.5 transition-colors hover:border-gray-300">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-gray-900">{label}</span>
        {score != null && score.score > 0 && (
          <span className={`flex-shrink-0 text-xs font-medium ${scoreColor(score.score)}`}>
            {score.score}%
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all ${
              value.includes(opt)
                ? 'border-transparent bg-gray-900 text-white'
                : 'border-gray-200 text-gray-600 hover:border-gray-400'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function FoundationEditor({
  companyName,
  initialAnswers,
  initialScore,
  initialFieldScores,
  foundationComplete,
  lastUpdated,
}: Props) {
  const [answers, setAnswers] = useState<Answers>(() => normalizeAnswers(initialAnswers))
  const [fieldScores, setFieldScores] = useState<Record<string, FieldScore>>(initialFieldScores)
  const [score, setScore] = useState(initialScore)
  const [weakFields, setWeakFields] = useState<string[]>(() => computeWeakFields(initialFieldScores))
  const [rescoring, setRescoring] = useState(false)
  const [rescored, setRescored] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(lastUpdated)

  function dispatchCanvasContext(ans: Answers, currentScore: number, weak: string[]) {
    const display = (v: string | string[]): string => {
      if (Array.isArray(v)) {
        const filled = v.filter(Boolean)
        return filled.length ? filled.join(', ') : '(not filled in)'
      }
      return v?.trim() ? v.trim() : '(not filled in)'
    }
    const lines = [
      'FOUNDATION PAGE',
      `Score: ${currentScore}%`,
      '',
      'CURRENT ANSWERS:',
      ...Object.entries(FIELD_LABELS).map(([k, label]) =>
        `${label}: ${display(ans[k as keyof Answers] as string | string[])}`
      ),
    ]
    if (weak.length) {
      lines.push('', 'WEAK AREAS (below 70%):')
      weak.forEach(f => lines.push(`- ${FIELD_LABELS[f]}`))
    }
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context: lines.join('\n') } }))
  }

  useEffect(() => {
    dispatchCanvasContext(answers, score, weakFields)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function updateText(key: string, value: string) {
    setAnswers(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  function updateCompetitors(values: [string, string, string]) {
    setAnswers(prev => ({ ...prev, competitors: values }))
    setDirty(true)
  }

  function updateSingle(key: 'differentiator' | 'marketingBudget' | 'monthlyGoal', value: string) {
    setAnswers(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  function updateMulti(key: 'toneTraits' | 'channels', value: string[]) {
    setAnswers(prev => ({ ...prev, [key]: value }))
    setDirty(true)
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

      const newScore: number = data.overallScore
      const newFieldScores: Record<string, FieldScore> = data.fieldScores ?? {}
      const newWeak: string[] = data.topWeakFields ?? computeWeakFields(newFieldScores)

      setScore(newScore)
      setFieldScores(newFieldScores)
      setWeakFields(newWeak)
      setLastUpdatedAt(new Date().toISOString())
      setDirty(false)
      setRescored(true)

      window.dispatchEvent(new CustomEvent('foundation:rescored', { detail: { score: newScore } }))
      dispatchCanvasContext(answers, newScore, newWeak)
      setTimeout(() => setRescored(false), 3000)

      // Regenerate foundation documents in background
      setGenerating(true)
      fetch('/api/foundation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, companyName }),
      })
        .catch(err => console.error('[foundation] doc generation failed:', err))
        .finally(() => setGenerating(false))
    } finally {
      setRescoring(false)
    }
  }

  // ── Empty state ──────────────────────────────────────────────────────────

  if (!initialAnswers) {
    return (
      <div className="px-8 pt-8 pb-6 max-w-[1200px]">
        <div className="mb-8">
          <p className="text-[11px] font-semibold tracking-widest uppercase text-[#94A3B8] mb-2">Foundation</p>
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
        <p className="text-[11px] font-semibold tracking-widest uppercase text-[#94A3B8] mb-2">Foundation</p>
        <h1 className="text-2xl font-bold text-gray-900">{companyName || 'Your'} foundation</h1>
        <p className="text-gray-500 text-sm mt-1">
          The answers that inform everything Maya creates for you. Edit anything, then rescore.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">

        {/* ── Left: field sections ─────────────────────────────────────────── */}
        <div className="space-y-7">

          {/* Your business */}
          <div>
            <p className="mb-2.5 text-xs font-medium tracking-wide text-gray-400">Your business</p>
            <div className="space-y-2.5">
              {(['businessDescription', 'problemSolved', 'transformation'] as const).map(key => (
                <AnswerField
                  key={key}
                  fieldKey={key}
                  label={FIELD_LABELS[key]}
                  value={answers[key]}
                  score={fieldScores[key]}
                  onChange={updateText}
                />
              ))}
            </div>
          </div>

          {/* Your customer */}
          <div>
            <p className="mb-2.5 text-xs font-medium tracking-wide text-gray-400">Your customer</p>
            <div className="space-y-2.5">
              {(['customerWho', 'customerFrustration', 'customerTriedBefore', 'customerBuyingTrigger'] as const).map(key => (
                <AnswerField
                  key={key}
                  fieldKey={key}
                  label={FIELD_LABELS[key]}
                  value={answers[key]}
                  score={fieldScores[key]}
                  onChange={updateText}
                />
              ))}
            </div>
          </div>

          {/* Your position */}
          <div>
            <p className="mb-2.5 text-xs font-medium tracking-wide text-gray-400">Your position</p>
            <div className="space-y-2.5">
              <CompetitorsField
                values={answers.competitors}
                score={fieldScores.competitors}
                onChange={updateCompetitors}
              />
              <SingleChipField
                label={FIELD_LABELS.differentiator}
                options={DIFFERENTIATOR_OPTIONS}
                value={answers.differentiator}
                score={fieldScores.differentiator}
                onChange={v => updateSingle('differentiator', v)}
              />
              <AnswerField
                fieldKey="differentiatorOwn"
                label={FIELD_LABELS.differentiatorOwn}
                value={answers.differentiatorOwn}
                score={fieldScores.differentiatorOwn}
                onChange={updateText}
              />
            </div>
          </div>

          {/* Your voice */}
          <div>
            <p className="mb-2.5 text-xs font-medium tracking-wide text-gray-400">Your voice</p>
            <div className="space-y-2.5">
              <MultiChipField
                label={FIELD_LABELS.toneTraits}
                options={TONE_OPTIONS}
                value={answers.toneTraits}
                score={fieldScores.toneTraits}
                maxSelect={4}
                onChange={v => updateMulti('toneTraits', v)}
              />
              <AnswerField
                fieldKey="brandsAdmired"
                label={FIELD_LABELS.brandsAdmired}
                value={answers.brandsAdmired}
                score={fieldScores.brandsAdmired}
                onChange={updateText}
              />
              <AnswerField
                fieldKey="neverSoundLike"
                label={FIELD_LABELS.neverSoundLike}
                value={answers.neverSoundLike}
                score={fieldScores.neverSoundLike}
                onChange={updateText}
              />
            </div>
          </div>

          {/* Your 30 days */}
          <div>
            <p className="mb-2.5 text-xs font-medium tracking-wide text-gray-400">Your 30 days</p>
            <div className="space-y-2.5">
              <SingleChipField
                label={FIELD_LABELS.marketingBudget}
                options={BUDGET_OPTIONS}
                value={answers.marketingBudget}
                score={fieldScores.marketingBudget}
                onChange={v => updateSingle('marketingBudget', v)}
              />
              <MultiChipField
                label={FIELD_LABELS.channels}
                options={CHANNEL_OPTIONS}
                value={answers.channels}
                score={fieldScores.channels}
                onChange={v => updateMulti('channels', v)}
              />
              <SingleChipField
                label={FIELD_LABELS.monthlyGoal}
                options={GOAL_OPTIONS}
                value={answers.monthlyGoal}
                score={fieldScores.monthlyGoal}
                fullWidth
                onChange={v => updateSingle('monthlyGoal', v)}
              />
            </div>
          </div>

        </div>

        {/* ── Right: strength panel (sticky) ───────────────────────────────── */}
        <div className="lg:sticky lg:top-8 lg:self-start space-y-3">

          <div className="rounded-xl border border-gray-200/80 bg-white p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-900">Foundation strength</span>
              <span className={`text-2xl font-semibold ${scoreColor(score)}`}>{score}%</span>
            </div>

            <div className="my-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${score}%`, background: score >= 85 ? '#16a34a' : score >= 75 ? '#65a30d' : score >= 50 ? '#d97706' : '#ef4444' }}
              />
            </div>

            {weakFields.length === 0 && score > 0 ? (
              <p className="mb-3 flex items-center gap-1.5 text-xs text-emerald-700">
                <Check size={13} strokeWidth={2.5} />
                Strong foundation — no weak areas
              </p>
            ) : weakFields.length > 0 ? (
              <div className="mb-3 space-y-2.5">
                <p className="text-xs font-medium text-gray-400">Areas to strengthen</p>
                {weakFields.map(field => (
                  <div key={field} className="flex items-start gap-2">
                    <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                    <div>
                      <p className="text-xs font-medium text-gray-700">{FIELD_LABELS[field]}</p>
                      {fieldScores[field]?.feedback && (
                        <p className="mt-0.5 text-xs leading-relaxed text-gray-400">
                          {fieldScores[field].feedback}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleRescore}
              disabled={rescoring}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {rescoring ? (
                <><Loader2 size={13} className="animate-spin" />Rescoring…</>
              ) : rescored ? (
                <><Check size={13} className="text-emerald-500" />Score updated</>
              ) : (
                dirty ? 'Save & rescore' : 'Rescore my foundation'
              )}
            </button>

            {generating && (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-gray-400">
                <Loader2 size={10} className="animate-spin" />
                Updating Maya&apos;s context…
              </p>
            )}
            {!generating && (
              <p className="mt-2 text-center text-[11px] text-gray-400">
                {dirty
                  ? 'Unsaved edits — rescore to save'
                  : lastUpdatedAt
                    ? `Last scored ${relativeTime(lastUpdatedAt)}`
                    : 'Not yet scored'}
              </p>
            )}
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="mb-2 text-xs font-medium text-gray-700">What Maya uses this for</p>
            <ul className="space-y-1.5">
              {[
                'Every piece of content stays in your brand voice',
                'Campaigns are built around your actual customer',
                'Agents write with your differentiator front of mind',
                'Analytics recommendations fit your goals',
              ].map(item => (
                <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-gray-500">
                  <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-gray-300" />
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
