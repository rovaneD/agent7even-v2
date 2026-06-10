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
  if (score == null) return 'text-text-soft'
  if (score >= 71) return 'text-status-success'
  if (score >= 50) return 'text-status-warning'
  return 'text-status-danger'
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

// Fields rendered as chip/button selects — users can't type more specific answers,
// so surfacing them in "Areas to strengthen" gives unusable advice.
const SELECT_ONLY_FIELDS = new Set(['differentiator', 'marketingBudget', 'monthlyGoal', 'toneTraits', 'channels'])

function computeWeakFields(scores: Record<string, FieldScore>): string[] {
  return Object.entries(scores)
    .filter(([k, v]) => !SELECT_ONLY_FIELDS.has(k) && v.score > 0 && v.score < 70)
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
    <div className="rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-gray-200 focus-within:border-brand-primary/50">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-text">{label}</span>
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
          className="w-full resize-none border-0 bg-transparent p-0 text-[14px] leading-relaxed text-text-sec outline-none placeholder:text-text-soft"
          style={{
            maxHeight: collapsed ? COLLAPSED_MAX : undefined,
            overflow: collapsed ? 'hidden' : 'visible',
          }}
        />
        {collapsed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent" />
        )}
      </div>

      {score?.feedback && score.score < 70 && !focused && (
        <p className="mt-1.5 text-xs leading-relaxed text-amber-600">{score.feedback}</p>
      )}
      {overflowing && !focused && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-1.5 text-xs text-brand-primary hover:underline"
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
      <p className="mb-0.5 text-[11px] text-text-soft">Competitor {index + 1}</p>
      <textarea
        ref={taRef}
        value={value}
        onChange={e => onChange(index, e.target.value)}
        rows={1}
        spellCheck
        placeholder={`@competitor${index + 1} or business name`}
        className="w-full resize-none border-0 bg-transparent p-0 text-[14px] leading-relaxed text-text-sec outline-none placeholder:text-text-soft"
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
    <div className="rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-gray-200 focus-within:border-brand-primary/50">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-text">Competitors</span>
        {score != null && score.score > 0 && (
          <span className={`flex-shrink-0 text-xs font-medium ${scoreColor(score.score)}`}>
            {score.score}%
          </span>
        )}
      </div>
      <div className="space-y-3 divide-y divide-border">
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
    <div className="rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-border-strong">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-text">{label}</span>
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
                ? 'border-transparent bg-brand-primary text-white'
                : 'border-border text-text-sec hover:border-brand-primary/40 hover:text-text'
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
    <div className="rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-border-strong">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-text">{label}</span>
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
                ? 'border-transparent bg-brand-primary text-white'
                : 'border-border text-text-sec hover:border-brand-primary/40 hover:text-text'
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
      <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-8">
        <section className="mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className="p-7">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-primary">Foundation</p>
            <h1 className="text-[30px] font-semibold tracking-tight text-text">Your business foundation</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-sec">The answers that inform everything Maya creates for you.</p>
          </div>
        </section>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-12 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary/10">
            <span className="text-xl font-bold text-brand-primary">M</span>
          </div>
          <p className="mb-1 text-sm font-semibold text-text">
            {foundationComplete ? 'Foundation answers not yet scored' : 'Foundation not yet complete'}
          </p>
          <p className="mb-6 max-w-xs text-xs leading-relaxed text-text-sec">
            {foundationComplete
              ? 'Complete a rescore to unlock your Foundation living document.'
              : 'Complete your Foundation setup so Maya knows your business inside out.'}
          </p>
          <Link
            href="/foundation"
            className="rounded-xl bg-brand-primary px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#2563EB]"
          >
            {foundationComplete ? 'Go to Foundation' : 'Set up Foundation'}
          </Link>
        </div>
      </div>
    )
  }

  // ── Main editor ──────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-8">

      <section className="mb-7 overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-primary">Foundation</p>
            <h1 className="text-[30px] font-semibold tracking-tight text-text">{companyName || 'Your'} foundation</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-sec">
              The answers that inform everything Maya creates for you. Edit anything, then rescore.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-soft">Strength</p>
            <p className={`mt-1 text-2xl font-semibold ${scoreColor(score)}`}>{score}%</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">

        {/* ── Left: field sections ─────────────────────────────────────────── */}
        <div className="space-y-7">

          {/* Your business */}
          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-text-soft">Your business</p>
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
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-text-soft">Your customer</p>
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
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-text-soft">Your position</p>
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
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-text-soft">Your voice</p>
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
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-text-soft">Your 30 days</p>
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

          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-text">Foundation strength</span>
              <span className={`text-2xl font-semibold ${scoreColor(score)}`}>{score}%</span>
            </div>

            <div className="my-3 h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${score}%`, background: score >= 71 ? '#10B981' : score >= 50 ? '#FCA509' : '#EE533B' }}
              />
            </div>

            {weakFields.length === 0 && score > 0 ? (
              <p className="mb-3 flex items-center gap-1.5 text-xs text-emerald-700">
                <Check size={13} strokeWidth={2.5} />
                Strong foundation — no weak areas
              </p>
            ) : weakFields.length > 0 ? (
              <div className="mb-3 space-y-2.5">
                <p className="text-xs font-medium text-text-soft">Areas to strengthen</p>
                {weakFields.map(field => (
                  <div key={field} className="flex items-start gap-2">
                    <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                    <div>
                      <p className="text-xs font-medium text-text">{FIELD_LABELS[field]}</p>
                      {fieldScores[field]?.feedback && (
                        <p className="mt-0.5 text-xs leading-relaxed text-text-soft">
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
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
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

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <p className="mb-2 text-xs font-semibold text-text">What Maya uses this for</p>
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
