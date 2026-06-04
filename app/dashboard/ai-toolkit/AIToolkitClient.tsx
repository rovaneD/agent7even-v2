'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Zap, Mail, Hash, Megaphone, Brush,
  BookOpen, Search, Copy, Check, Loader2,
  ChevronRight, Clock, Star, X, Lock,
  TrendingUp, ArrowRight, Info, Sparkles, CheckCircle,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Prompt {
  id: string
  category: string
  title: string
  description: string
  prompt: string
  variables: { key: string; label: string }[]
  time_saved_mins: number
}

interface SavedPrompt {
  id: string
  title: string
  prompt: string
  category: string
}

interface Profile {
  id: string
  company_name?: string
  full_name?: string
}

// ── Plan config ───────────────────────────────────────────────────────────────

const STARTER_LIMIT = 15

const PLAN_META: Record<string, { label: string; color: string; bg: string }> = {
  starter:  { label: 'Starter',  color: 'text-text-sec',     bg: 'bg-surface-muted' },
  growth:   { label: 'Growth',   color: 'text-text-sec',    bg: 'bg-brand-primary/10' },
  proagent: { label: 'ProAgent', color: 'text-[#7C3AED]',   bg: 'bg-[#7C3AED]/10' },
}

function getPlanLimits(plan: string | null): { unlimited: boolean; limit: number } {
  if (plan === 'growth' || plan === 'proagent') return { unlimited: true, limit: Infinity }
  if (plan === 'starter') return { unlimited: false, limit: STARTER_LIMIT }
  return { unlimited: false, limit: 0 }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all',        label: 'All tools',   icon: Zap },
  { id: 'social',     label: 'Social',      icon: Hash },
  { id: 'email',      label: 'Email',       icon: Mail },
  { id: 'ads',        label: 'Ads',         icon: Megaphone },
  { id: 'seo',        label: 'SEO',         icon: Search },
  { id: 'brand',      label: 'Brand',       icon: Brush },
  { id: 'operations', label: 'Operations',  icon: BookOpen },
]

const CATEGORY_COLORS: Record<string, string> = {
  social:     'bg-brand-tertiary/10 text-brand-tertiary',
  email:      'bg-brand-primary/10 text-brand-primary',
  ads:        'bg-brand-warning/10 text-brand-warning',
  seo:        'bg-status-success/10 text-status-success',
  brand:      'bg-[#7C3AED]/10 text-[#7C3AED]',
  operations: 'bg-surface-muted text-text-sec',
  general:    'bg-surface-muted text-text-sec',
}

// ── Plan tier per category ────────────────────────────────────────────────────
// Maps each category to the minimum plan required to use it.

const CATEGORY_MIN_PLAN: Record<string, 'starter' | 'growth' | 'proagent'> = {
  social:     'starter',
  email:      'starter',
  ads:        'growth',
  seo:        'growth',
  operations: 'growth',
  brand:      'proagent',
  general:    'starter',
}

const PLAN_ORDER = ['starter', 'growth', 'proagent']

function meetsRequirement(userPlan: string | null, required: string): boolean {
  if (!userPlan) return false
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(required)
}

const PLAN_BADGE: Record<string, { label: string; style: string }> = {
  starter:  { label: 'Starter+',  style: 'bg-surface-muted text-text-sec' },
  growth:   { label: 'Growth+',   style: 'bg-brand-primary/10 text-text-sec' },
  proagent: { label: 'ProAgent',  style: 'bg-[#7C3AED]/10 text-[#7C3AED]' },
}

const CATEGORY_TOOLTIP: Record<string, string> = {
  social:     'Create social media posts, captions, and campaign ideas. Available on all paid plans.',
  email:      'Write email campaigns, newsletters, and follow-up sequences. Available on all paid plans.',
  ads:        'Generate ad copy for Google, Meta, and more. Requires Growth or ProAgent.',
  seo:        'Build keyword strategies, meta descriptions, and blog outlines. Requires Growth or ProAgent.',
  operations: 'Streamline workflows, SOPs, and business templates. Requires Growth or ProAgent.',
  brand:      'Develop brand voice, positioning, and strategy documents. ProAgent exclusive.',
  general:    'General-purpose AI tools. Available on all paid plans.',
}

const PLAN_TOOLTIP: Record<string, string> = {
  starter:  'Starter — $49/mo\n15 AI runs/month · Social & Email tools · Full dashboard',
  growth:   'Growth — $89/mo\nUnlimited runs · All tools including Ads, SEO & Ops · Priority support',
  proagent: 'ProAgent — $149/mo\nUnlimited runs · Every tool including Brand Strategy · Dedicated support',
}

// ── Tooltip component ─────────────────────────────────────────────────────────

function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setVisible(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative inline-flex items-center" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-60 bg-gray-900 text-white text-xs rounded-xl px-3.5 py-2.5 shadow-xl whitespace-pre-line leading-relaxed pointer-events-none">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fillPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `[${key}]`)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs text-text-soft hover:text-brand-primary transition-colors">
      {copied ? <Check size={12} className="text-status-success" /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function PromptRunner({
  prompt,
  profileId,
  brandKitComplete,
  onClose,
}: {
  prompt: Prompt
  profileId: string
  brandKitComplete: boolean
  onClose: () => void
}) {
  const [vars, setVars] = useState<Record<string, string>>({})
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [useBrandVoice, setUseBrandVoice] = useState(brandKitComplete)

  const filledPrompt = fillPrompt(prompt.prompt, vars)
  const allVarsFilled = prompt.variables.every(v => vars[v.key]?.trim())

  const run = async () => {
    setLoading(true)
    setOutput('')
    try {
      const res = await fetch('/api/ai/run-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: filledPrompt,
          promptId: prompt.id,
          timeSavedMins: prompt.time_saved_mins,
          useBrandVoice,
        }),
      })
      const data = await res.json()
      if (data.output) setOutput(data.output)
    } finally {
      setLoading(false)
    }
  }

  const savePrompt = async () => {
    setSaving(true)
    try {
      await fetch('/api/ai/save-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: prompt.title,
          prompt: filledPrompt,
          category: prompt.category,
        }),
      })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  void profileId

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-surface rounded-[24px] w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">

        <div className="flex items-start justify-between p-6 border-b border-border sticky top-0 bg-surface rounded-t-[24px]">
          <div>
            <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full ${CATEGORY_COLORS[prompt.category] ?? 'bg-surface-muted text-text-sec'}`}>
              {prompt.category}
            </span>
            <h2 className="text-base font-bold text-text mt-2">{prompt.title}</h2>
            <p className="text-xs text-text-soft mt-0.5 flex items-center gap-1">
              <Clock size={10} /> Saves ~{prompt.time_saved_mins} min
            </p>
          </div>
          <button onClick={onClose} className="text-text-soft hover:text-text">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {prompt.variables.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-soft uppercase tracking-widest mb-3">Fill in your details</p>
              <div className="space-y-3">
                {prompt.variables.map(v => (
                  <div key={v.key}>
                    <label className="text-xs font-medium text-text-sec block mb-1">{v.label}</label>
                    <input
                      type="text"
                      value={vars[v.key] ?? ''}
                      onChange={e => setVars(prev => ({ ...prev, [v.key]: e.target.value }))}
                      placeholder={`Enter ${v.label.toLowerCase()}...`}
                      className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm text-text placeholder:text-text-soft outline-none focus:border-brand-primary transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Brand voice toggle */}
          <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${useBrandVoice && brandKitComplete ? 'bg-brand-primary/5 border-brand-primary/20' : 'bg-surface-muted border-border'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${useBrandVoice && brandKitComplete ? 'bg-brand-primary/10' : 'bg-bg-soft'}`}>
                <Sparkles size={15} className={useBrandVoice && brandKitComplete ? 'text-brand-primary' : 'text-text-soft'} />
              </div>
              <div>
                <p className="text-sm font-semibold text-text">Use my brand voice</p>
                <p className="text-xs text-text-soft">{brandKitComplete ? "Claude will write in your brand's tone and style" : 'Complete your Brand Kit to enable this feature'}</p>
              </div>
            </div>
            <button
              onClick={() => brandKitComplete && setUseBrandVoice(v => !v)}
              disabled={!brandKitComplete}
              className={`relative w-11 h-6 rounded-full transition-colors ${useBrandVoice && brandKitComplete ? 'bg-brand-primary' : brandKitComplete ? 'bg-border' : 'bg-bg-soft cursor-not-allowed'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${useBrandVoice && brandKitComplete ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <button
            onClick={run}
            disabled={loading || (!allVarsFilled && prompt.variables.length > 0)}
            className="w-full bg-brand-primary text-white font-medium text-sm py-3 rounded-xl hover:bg-[#2563EB] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Zap size={14} /> Generate</>}
          </button>

          {output && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-text-soft uppercase tracking-widest">Output</p>
                <div className="flex items-center gap-3">
                  <CopyButton text={output} />
                  <button
                    onClick={savePrompt}
                    disabled={saving || saved}
                    className="flex items-center gap-1.5 text-xs text-text-soft hover:text-brand-primary transition-colors"
                  >
                    {saved ? <><Check size={12} className="text-status-success" /> Saved</> : <><Star size={12} /> Save prompt</>}
                  </button>
                </div>
              </div>
              <div className="bg-surface-muted rounded-xl p-4 text-sm text-text-sec leading-relaxed whitespace-pre-wrap border border-border">
                {output}
              </div>
              <button
                onClick={run}
                disabled={loading}
                className="mt-3 text-xs text-brand-primary hover:text-[#2563EB] transition-colors flex items-center gap-1"
              >
                <Zap size={11} /> Regenerate
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Plan banner ───────────────────────────────────────────────────────────────

function PlanBanner({ plan, monthlyRuns }: { plan: string | null; monthlyRuns: number }) {
  const { unlimited, limit } = getPlanLimits(plan)
  const meta = plan ? PLAN_META[plan] : null
  const runsLeft = Math.max(0, limit - monthlyRuns)
  const pct = unlimited ? 100 : Math.min(100, (monthlyRuns / limit) * 100)
  const nearLimit = !unlimited && monthlyRuns >= limit * 0.8

  if (!plan) {
    return (
      <div className="bg-[#0d0d0d] rounded-2xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <Lock size={16} className="text-white/60" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">No active plan</p>
            <p className="text-xs text-white/40 mt-0.5">Subscribe to start using AI tools</p>
          </div>
        </div>
        <a
          href="/pricing"
          className="inline-flex items-center gap-2 bg-brand-primary hover:bg-[#2563EB] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors flex-shrink-0"
        >
          View plans <ArrowRight size={14} />
        </a>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border p-5 mb-6 ${nearLimit ? 'bg-status-warning/10 border-status-warning/20' : 'bg-white border-gray-100'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Tooltip content={PLAN_TOOLTIP[plan] ?? plan}>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full cursor-default flex items-center gap-1.5 ${meta?.bg} ${meta?.color}`}>
              {meta?.label ?? plan}
              <Info size={11} className="opacity-60" />
            </span>
          </Tooltip>
          {unlimited ? (
            <p className="text-sm text-text-sec">
              <span className="font-semibold text-text">Unlimited</span> AI runs this month
            </p>
          ) : (
            <p className="text-sm text-text-sec">
              <span className={`font-semibold ${nearLimit ? 'text-status-warning' : 'text-text'}`}>
                {monthlyRuns} of {limit}
              </span>{' '}
              runs used this month
              {runsLeft > 0 && (
                <span className="text-text-soft ml-1">({runsLeft} left)</span>
              )}
            </p>
          )}
        </div>

        {plan === 'starter' && (
          <a
            href="/dashboard/billing"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:text-[#2563EB] transition-colors flex-shrink-0"
          >
            <TrendingUp size={14} />
            Upgrade to Growth — unlimited runs
          </a>
        )}
      </div>

      {!unlimited && (
        <div className="mt-4">
          <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pct >= 100 ? 'bg-status-danger' : pct >= 80 ? 'bg-status-warning' : 'bg-brand-primary'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {pct >= 100 && (
            <p className="text-xs text-status-danger font-medium mt-2">
              Monthly limit reached. <a href="/dashboard/billing" className="underline">Upgrade to Growth</a> for unlimited runs.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Upgrade callout (shown below the grid when on starter) ────────────────────

function UpgradeCallout() {
  return (
    <div className="mt-8 rounded-[24px] bg-gradient-to-br from-brand-secondary to-[#1a2535] p-6 text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">Growth &amp; ProAgent</p>
          <h3 className="text-base font-semibold mb-1">Unlock unlimited AI runs</h3>
          <p className="text-sm text-white/70">
            Starter is limited to 15 runs/month. Upgrade to Growth ($89/mo) for unlimited access to every AI tool.
          </p>
        </div>
        <a
          href="/pricing"
          className="inline-flex items-center gap-2 bg-white text-text-sec text-sm font-bold px-5 py-3 rounded-xl hover:bg-[#f5f4f0] transition-colors flex-shrink-0 whitespace-nowrap"
        >
          See plans <ArrowRight size={14} />
        </a>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AIToolkitClient({
  prompts,
  savedPrompts,
  totalRuns,
  totalTimeSaved,
  plan,
  monthlyRuns,
  hasBrandKit: _hasBrandKit,
  brandKitComplete,
}: {
  prompts: Prompt[]
  savedPrompts: SavedPrompt[]
  totalRuns: number
  totalTimeSaved: number
  plan: string | null
  monthlyRuns: number
  companyName: string
  hasBrandKit: boolean
  brandKitComplete: boolean
}) {
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeTier, setActiveTier] = useState<'all' | 'starter' | 'growth' | 'proagent'>('all')
  const [activeTab, setActiveTab] = useState<'library' | 'saved'>('library')
  const [search, setSearch] = useState('')
  const [runningPrompt, setRunningPrompt] = useState<Prompt | null>(null)

  const { unlimited, limit } = getPlanLimits(plan)
  const isAtLimit = !unlimited && monthlyRuns >= limit

  // Tier filter: cumulative — each tier shows everything included at that level and below
  // Starter → starter tools only | Growth → starter + growth | ProAgent → all tools
  const filtered = prompts.filter(p => {
    const requiredTier = CATEGORY_MIN_PLAN[p.category] ?? 'starter'
    const matchesTier = activeTier === 'all' || meetsRequirement(activeTier, requiredTier)
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory
    const matchesSearch = search === '' ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
    return matchesTier && matchesCategory && matchesSearch
  })

  const totalHours = Math.round(totalTimeSaved / 60 * 10) / 10

  function isPromptLocked(prompt: Prompt): boolean {
    const required = CATEGORY_MIN_PLAN[prompt.category] ?? 'starter'
    if (!meetsRequirement(plan, required)) return true
    if (isAtLimit) return true
    return false
  }

  function handlePromptClick(prompt: Prompt) {
    if (isPromptLocked(prompt)) return
    setRunningPrompt(prompt)
  }

  return (
    <div className="mx-auto max-w-[1240px] px-8 py-8">

      {/* Header */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-primary">AI Toolkit</p>
            <h1 className="text-[32px] font-semibold tracking-[-0.03em] text-text">Prompt library</h1>
            <p className="mt-2 text-sm text-text-sec">Generate content, copy, and strategy from reusable marketing prompts.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-shrink-0">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4 text-center">
              <p className="text-xl font-semibold text-brand-primary">{totalRuns}</p>
              <p className="text-xs text-text-soft">Outputs</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4 text-center">
              <p className="text-xl font-semibold text-status-success">{totalHours}h</p>
              <p className="text-xs text-text-soft">Time saved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Brand Kit nudge / active banner */}
      {!brandKitComplete && (
        <div className="flex items-start gap-3 bg-brand-primary/5 border border-brand-primary/10 rounded-2xl px-4 py-3 mb-5">
          <Sparkles size={15} className="text-brand-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text mb-0.5">Your AI outputs are generic right now</p>
            <p className="text-xs text-text-sec leading-relaxed">Complete your Brand Kit and Claude will automatically write in your brand&apos;s voice, tone, and style for every prompt you run.</p>
          </div>
          <a href="/dashboard/brand-kit" className="flex-shrink-0 text-xs font-semibold text-brand-primary bg-brand-primary/10 hover:bg-brand-primary/20 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">Complete Brand Kit →</a>
        </div>
      )}
      {brandKitComplete && (
        <div className="flex items-center gap-2 bg-status-success/10 border border-status-success/20 rounded-2xl px-4 py-2.5 mb-5">
          <CheckCircle size={14} className="text-status-success flex-shrink-0" />
          <p className="text-xs text-status-success font-medium">Brand Kit active. AI outputs will reflect your brand voice when enabled.</p>
        </div>
      )}

      {/* Plan banner */}
      <PlanBanner plan={plan} monthlyRuns={monthlyRuns} />

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface-muted rounded-xl p-1 w-fit mb-6">
        {([['library', 'Prompt library'], ['saved', `Saved (${savedPrompts.length})`]] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab ? 'bg-surface text-text shadow-sm' : 'text-text-sec hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'library' && (
        <>
          {/* Plan tier toggle */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {([
              { key: 'all',      label: 'Show all' },
              { key: 'starter',  label: 'Starter',  badge: 'bg-surface-muted text-text-sec' },
              { key: 'growth',   label: 'Growth',   badge: 'bg-brand-primary/10 text-text-sec' },
              { key: 'proagent', label: 'ProAgent', badge: 'bg-[#7C3AED]/10 text-[#7C3AED]' },
            ] as const).map(tier => (
              <button
                key={tier.key}
                onClick={() => { setActiveTier(tier.key); setActiveCategory('all') }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                  activeTier === tier.key
                    ? tier.key === 'all'
                      ? 'bg-brand-primary text-white border-brand-primary'
                      : `${tier.badge} border-current`
                    : 'bg-surface text-text-sec border-border hover:border-brand-primary/30'
                }`}
              >
                {tier.key !== 'all' && activeTier !== tier.key ? `${tier.label} plan` : tier.label}
              </button>
            ))}
            {activeTier !== 'all' && (
              <span className="text-xs text-text-soft ml-1">
                {activeTier === 'starter'  && 'Social & Email tools included in every plan'}
                {activeTier === 'growth'   && 'All Starter tools + Ads, SEO & Operations'}
                {activeTier === 'proagent' && 'Every tool — Starter, Growth & Brand Strategy'}
              </span>
            )}
          </div>

          {/* Search + category filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
            <div className="relative w-full sm:flex-1 sm:max-w-xs">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-soft" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search prompts..."
                className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl text-sm text-text placeholder:text-text-soft outline-none focus:border-brand-primary transition-colors"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setActiveCategory(cat.id); setActiveTier('all') }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      activeCategory === cat.id
                        ? 'bg-brand-primary text-white'
                        : 'bg-surface border border-border text-text-sec hover:border-brand-primary/30'
                    }`}
                  >
                    <Icon size={11} />
                    {cat.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Prompt cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map(prompt => {
              const locked = isPromptLocked(prompt)
              const required = CATEGORY_MIN_PLAN[prompt.category] ?? 'starter'
              const planBadge = PLAN_BADGE[required]
              const tierTooltip = CATEGORY_TOOLTIP[prompt.category] ?? ''
              const needsUpgrade = plan ? !meetsRequirement(plan, required) : false

              return (
                <button
                  key={prompt.id}
                  onClick={() => handlePromptClick(prompt)}
                  disabled={locked}
                  className={`rounded-2xl border p-5 text-left transition-all group relative ${
                    locked
                      ? 'bg-gray-50 border-gray-100 cursor-not-allowed'
                      : 'bg-white border-gray-100 hover:border-brand-primary/30 cursor-pointer'
                  }`}
                >
                  {locked && (
                    <div className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                      <Lock size={11} className="text-gray-500" />
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-3">
                    <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full ${CATEGORY_COLORS[prompt.category] ?? 'bg-gray-50 text-gray-500'}`}>
                      {prompt.category}
                    </span>
                    <div className={`flex items-center gap-1 text-[10px] text-text-soft ${locked ? 'pr-7' : ''}`}>
                      <Clock size={10} />
                      ~{prompt.time_saved_mins}m saved
                    </div>
                  </div>

                  <h3 className={`text-sm font-semibold mb-1 transition-colors ${locked ? 'text-text-sec' : 'text-text group-hover:text-brand-primary'}`}>
                    {prompt.title}
                  </h3>
                  <p className="text-xs leading-relaxed mb-4 text-text-sec">
                    {prompt.description}
                  </p>

                  {/* Footer row — plan badge + action */}
                  <div className="flex items-center justify-between">
                    <Tooltip content={tierTooltip}>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full cursor-default ${planBadge.style}`}>
                        {planBadge.label}
                        <Info size={9} className="opacity-60" />
                      </span>
                    </Tooltip>

                    {!locked && (
                      <div className="flex items-center gap-1 text-xs font-semibold text-brand-primary">
                        Use prompt <ChevronRight size={11} />
                      </div>
                    )}
                    {locked && isAtLimit && (
                      <div className="flex items-center gap-1 text-xs font-medium text-amber-600">
                        Limit reached
                      </div>
                    )}
                    {locked && needsUpgrade && (
                      <a
                        href="/pricing"
                        onClick={e => e.stopPropagation()}
                        className="text-xs font-semibold text-brand-primary hover:underline"
                      >
                        Upgrade →
                      </a>
                    )}
                    {locked && !plan && (
                      <a
                        href="/pricing"
                        onClick={e => e.stopPropagation()}
                        className="text-xs font-semibold text-brand-primary hover:underline"
                      >
                        Subscribe →
                      </a>
                    )}
                  </div>
                </button>
              )
            })}

            {filtered.length === 0 && (
              <div className="col-span-2 bg-surface rounded-2xl border border-border p-12 text-center">
                <Zap size={20} className="text-text-soft mx-auto mb-3" />
                <p className="text-sm text-text-soft">No prompts found</p>
              </div>
            )}
          </div>

          {/* Upgrade callout for starter */}
          {plan === 'starter' && <UpgradeCallout />}
        </>
      )}

      {activeTab === 'saved' && (
        <div className="space-y-3">
          {savedPrompts.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-border p-12 text-center">
              <Star size={20} className="text-text-soft mx-auto mb-3" />
              <p className="text-sm text-text-soft">No saved prompts yet</p>
              <p className="text-xs text-text-soft mt-1">Run a prompt and save it to find it here.</p>
              <button
                onClick={() => setActiveTab('library')}
                className="mt-4 text-sm font-semibold text-brand-primary hover:text-[#2563EB] transition-colors"
              >
                Browse prompt library →
              </button>
            </div>
          ) : (
            savedPrompts.map(sp => (
              <div key={sp.id} className="bg-surface rounded-2xl border border-border p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full ${CATEGORY_COLORS[sp.category] ?? 'bg-gray-50 text-gray-500'}`}>
                      {sp.category || 'custom'}
                    </span>
                    <p className="text-sm font-semibold text-text mt-2">{sp.title}</p>
                  </div>
                  <CopyButton text={sp.prompt} />
                </div>
                <p className="text-xs text-text-soft leading-relaxed bg-surface-muted rounded-lg p-3 mt-2 font-mono">
                  {sp.prompt.slice(0, 200)}{sp.prompt.length > 200 ? '...' : ''}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Prompt runner modal */}
      {runningPrompt && (
        <PromptRunner
          prompt={runningPrompt}
          profileId=""
          brandKitComplete={brandKitComplete}
          onClose={() => setRunningPrompt(null)}
        />
      )}
    </div>
  )
}
