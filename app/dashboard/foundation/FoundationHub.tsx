'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import type { FoundationMemoryResponse, AgentMemoryStat } from '@/app/api/foundation/memory/route'

// Client-side extraction types (mirrored from lib/foundation/extract.ts)
type ExtractionItem = {
  field: string
  value: string | string[]
  confidence: 'high' | 'medium' | 'low'
  source: string
  question?: string
}
type ExtractionResult = { items: ExtractionItem[]; summary: string }
type KnowledgeItem = {
  id: string
  source_type: string
  source_name: string | null
  extraction_result: ExtractionResult | null
  confirmed_fields: unknown
  created_at: string
}
import {
  Building2, Users, Target, Mic, Calendar, History,
  Upload, Sparkles, RefreshCw, Plus, Pencil,
  Eye, Rocket, BarChart2, TrendingUp, Mail, Megaphone, Search, ShieldCheck,
  Loader2, CloudUpload, Link2, FileText, Brain, Info,
  CheckSquare, Square, X, AlertCircle, Trash2, ChevronDown,
} from 'lucide-react'
import { AGENTS, AGENT_COLORS } from '@/lib/agents/registry'
import type { FoundationSectionKey } from '@/lib/agents/registry'

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'intelligence' | 'knowledge' | 'memory' | 'connections'
type Health = 'strong' | 'needs_work' | 'thin'
type SectionKey = 'business' | 'customer' | 'position' | 'voice' | 'plan' | 'memory'

interface AgentTag {
  id: string
  name: string
  column: 'approval' | 'auto'
  warnIfThin: boolean
}

interface SectionDef {
  key: SectionKey
  title: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  keyFields: string[]
  editFields: { key: keyof Answers; label: string; type: 'textarea' | 'text' | 'chips' | 'competitors' }[]
  agents: AgentTag[]
  affectedDocs: string[]  // which foundation_documents types regenerate on edit
  emptyText: string
  editable: boolean
}

interface Answers {
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

interface FieldScore { score: number; feedback: string | null }

export interface Props {
  profileId: string
  companyName: string
  answers: Answers
  score: number
  fieldScores: Record<string, FieldScore>
  lastUpdated: string | null
}

// ── Registry-derived agent connectivity ───────────────────────────────────────

// Icon map for registry agents (lucide icons, keyed by agent id)
const AGENT_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  competitor_watcher:     Eye,
  weekly_content:         Pencil,
  campaign_builder:       Rocket,
  performance_digest:     BarChart2,
  trend_spotter:          TrendingUp,
  email_sequence_builder: Mail,
  ad_variations:          Megaphone,
  seo_scanner:            Search,
  brand_voice_guardian:   ShieldCheck,
}

function agentsForSection(sectionKey: FoundationSectionKey): AgentTag[] {
  return Object.values(AGENTS)
    .filter(a => a.foundationSections.includes(sectionKey))
    .map(a => ({
      id:          a.id,
      name:        a.name,
      column:      a.autonomyLevel === 'approval_required' ? 'approval' : 'auto',
      warnIfThin:  a.warnIfThinSections.includes(sectionKey),
    }))
}

// ── Section definitions ────────────────────────────────────────────────────────

const SECTIONS: SectionDef[] = [
  {
    key: 'business', title: 'Your Business', icon: Building2, editable: true,
    keyFields: ['businessDescription', 'problemSolved'],
    editFields: [
      { key: 'businessDescription', label: 'What your business does', type: 'textarea' },
      { key: 'problemSolved',       label: 'The problem you solve',   type: 'textarea' },
      { key: 'transformation',      label: 'The transformation you create', type: 'textarea' },
    ],
    affectedDocs: ['brief', 'plan'],
    emptyText: 'Describe what your business does, the problem you solve, and the transformation you create for customers.',
    agents: agentsForSection('business'),
  },
  {
    key: 'customer', title: 'Your Customer', icon: Users, editable: true,
    keyFields: ['customerWho', 'customerFrustration'],
    editFields: [
      { key: 'customerWho',           label: 'Who is your ideal customer?',       type: 'textarea' },
      { key: 'customerFrustration',   label: 'Their biggest frustration',         type: 'textarea' },
      { key: 'customerTriedBefore',   label: 'What they\'ve tried before',        type: 'textarea' },
      { key: 'customerBuyingTrigger', label: 'What makes them decide to buy',     type: 'textarea' },
    ],
    affectedDocs: ['icp'],
    emptyText: 'Describe your ideal customer, their biggest frustration, and what makes them decide to buy.',
    agents: agentsForSection('customer'),
  },
  {
    key: 'position', title: 'Your Position', icon: Target, editable: true,
    keyFields: ['differentiator', 'competitors'],
    editFields: [
      { key: 'competitors',       label: 'Main competitors',                    type: 'competitors' },
      { key: 'differentiator',    label: 'What makes you genuinely different',  type: 'textarea' },
      { key: 'differentiatorOwn', label: 'In your own words',                  type: 'textarea' },
    ],
    affectedDocs: ['positioning'],
    emptyText: 'Add your main competitors and what makes you genuinely different — Competitor Watcher and Ad Variations depend on this most.',
    agents: agentsForSection('position'),
  },
  {
    key: 'voice', title: 'Your Voice', icon: Mic, editable: true,
    keyFields: ['toneTraits', 'brandsAdmired'],
    editFields: [
      { key: 'toneTraits',      label: 'Tone traits (comma-separated)',   type: 'chips' },
      { key: 'brandsAdmired',   label: 'Brands you admire',               type: 'textarea' },
      { key: 'neverSoundLike',  label: 'Never sound like',                type: 'textarea' },
    ],
    affectedDocs: ['voice'],
    emptyText: 'Choose your tone traits and name a brand you admire — this is how Maya makes every output sound like you.',
    agents: agentsForSection('voice'),
  },
  {
    key: 'plan', title: 'Your 30 Days', icon: Calendar, editable: true,
    keyFields: ['marketingBudget', 'monthlyGoal'],
    editFields: [
      { key: 'marketingBudget', label: 'Monthly marketing budget', type: 'text' },
      { key: 'channels',        label: 'Channels (comma-separated)', type: 'chips' },
      { key: 'monthlyGoal',     label: 'Primary goal this month',   type: 'textarea' },
    ],
    affectedDocs: ['plan'],
    emptyText: 'Set your monthly budget, preferred channels, and one goal so Campaign Builder can create a focused plan.',
    agents: agentsForSection('plan'),
  },
  {
    key: 'memory', title: "Maya's Memory", icon: History, editable: false,
    keyFields: [],
    editFields: [],
    affectedDocs: [],
    emptyText: "Auto-populates as you use Maya's agents. Maya learns what content you approve, what performs, and what to avoid — then applies it automatically.",
    agents: agentsForSection('memory'),
  },
]

// Flat list for the Connections tab
const AGENT_REGISTRY = Object.values(AGENTS).map(a => ({
  id:   a.id,
  name: a.name,
  icon: AGENT_ICONS[a.id] ?? Brain,
  foundationSections: a.foundationSections,
  color: AGENT_COLORS[a.id] ?? { bg: '#F3F4F6', fg: '#6B7280' },
}))

// ── Helpers ────────────────────────────────────────────────────────────────────

function sectionHealth(answers: Answers, fieldScores: Record<string, FieldScore>, key: SectionKey): Health {
  if (key === 'memory') return 'thin' // rendered as "Building"

  const fields = SECTIONS.find(s => s.key === key)!.keyFields
  const scored = fields.filter(f => fieldScores[f]?.score != null)

  if (scored.length > 0) {
    const avg = scored.reduce((s, f) => s + fieldScores[f].score, 0) / scored.length
    if (avg >= 70) return 'strong'
    if (avg >= 40) return 'needs_work'
    return 'thin'
  }

  // No scores yet — fill check
  const filled = fields.filter(f => {
    const v = (answers as unknown as Record<string, unknown>)[f]
    return Array.isArray(v) ? (v as string[]).filter(Boolean).length > 0 : Boolean(v)
  })
  if (filled.length === 0) return 'thin'
  return 'needs_work'
}

function sectionScore(fieldScores: Record<string, FieldScore>, key: SectionKey): number | null {
  if (key === 'memory') return null
  const fields = SECTIONS.find(s => s.key === key)!.keyFields
  const scored = fields.filter(f => fieldScores[f]?.score != null)
  if (scored.length === 0) return null
  return Math.round(scored.reduce((s, f) => s + fieldScores[f].score, 0) / scored.length)
}

function toArr(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string' && v.trim()) return v.split(',').map(s => s.trim()).filter(Boolean)
  return []
}

function sectionPreview(answers: Answers, key: SectionKey): string | null {
  const t = (s: string) => s.length > 130 ? s.slice(0, 130) + '…' : s
  if (key === 'business') return answers.businessDescription ? t(answers.businessDescription) : null
  if (key === 'customer') return answers.customerWho ? t(answers.customerWho) : null
  if (key === 'position') {
    const comps = toArr(answers.competitors).filter(Boolean)
    const parts = [
      comps.length > 0 ? `Competitors: ${comps.join(', ')}` : '',
      answers.differentiator ? answers.differentiator : '',
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : null
  }
  if (key === 'voice') {
    const traits = toArr(answers.toneTraits)
    return traits.length > 0 ? `Tone: ${traits.join(' · ')}` : null
  }
  if (key === 'plan') {
    const channels = toArr(answers.channels)
    const parts = [
      answers.marketingBudget,
      channels.length > 0 ? channels.join(', ') : '',
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : null
  }
  return null
}

function barColor(score: number): string {
  if (score >= 70) return '#10B981'
  if (score >= 40) return '#3B82F6'
  return '#F59E0B'
}

function scoreStatus(score: number): string {
  if (score >= 70) return 'Strong foundation'
  if (score >= 40) return 'Building toward a strong foundation'
  return 'Needs more detail to work well'
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never updated'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'Updated today'
  if (days === 1) return 'Updated yesterday'
  return `Updated ${days} days ago`
}

function deriveSuggestions(answers: Answers, healthMap: Record<SectionKey, Health>): string[] {
  const s: string[] = []
  if (healthMap.position !== 'strong') {
    const comps = toArr(answers.competitors).filter(Boolean)
    if (comps.length < 2) s.push("Adding more competitors sharpens Competitor Watcher and Ad Variations — Maya needs context to differentiate you.")
  }
  if (healthMap.voice !== 'strong') s.push("Completing your Voice section ensures Weekly Content and Email Sequences match your actual tone, not a generic one.")
  if (healthMap.customer !== 'strong') s.push("A detailed Customer section helps Ad Variations write copy that speaks directly to your buyer's frustration.")
  if (healthMap.business !== 'strong') s.push("Strengthening Your Business section improves every agent output — it's the baseline context all 9 agents read first.")
  return s.slice(0, 3)
}

// Build agent → sections map for connections tab
function buildAgentSectionsMap(): Record<string, string[]> {
  const sectionTitles: Record<string, string> = Object.fromEntries(SECTIONS.map(s => [s.key, s.title]))
  return Object.fromEntries(
    AGENT_REGISTRY.map(a => [
      a.id,
      a.foundationSections.map(k => sectionTitles[k]).filter(Boolean),
    ])
  )
}

// ── Small components ───────────────────────────────────────────────────────────

function HealthPill({ health, isMemory }: { health: Health; isMemory?: boolean }) {
  if (isMemory) return (
    <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: '#EFF6FF', color: '#1D4ED8' }}>Building</span>
  )
  if (health === 'strong') return (
    <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: '#D1FAE5', color: '#065F46' }}>Strong</span>
  )
  if (health === 'needs_work') return (
    <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: '#FEF3C7', color: '#92400E' }}>Needs work</span>
  )
  return (
    <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: '#FEE2E2', color: '#991B1B' }}>Thin</span>
  )
}

function AgentPill({ agent, health }: { agent: AgentTag; health: Health }) {
  const isWarn = agent.warnIfThin && health !== 'strong'
  if (isWarn) return (
    <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border"
      style={{ background: '#FFFBEB', color: '#92400E', borderColor: '#FDE68A' }}>
      {agent.name} — limited
    </span>
  )
  if (agent.column === 'approval') return (
    <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border"
      style={{ background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}>
      {agent.name}
    </span>
  )
  return (
    <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border"
      style={{ background: '#F0FDF4', color: '#166534', borderColor: '#BBF7D0' }}>
      {agent.name}
    </span>
  )
}

// ── Sidebar cards ──────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  return (
    <div className="relative group inline-flex items-center">
      <Info size={12} className="text-text-soft cursor-help hover:text-text-sec transition-colors" />
      <div className="absolute bottom-full right-0 mb-2 w-60 bg-gray-900 text-white text-[11px] leading-relaxed rounded-xl px-3 py-2.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
        {text}
        <div className="absolute top-full right-2 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
      </div>
    </div>
  )
}

function StrengthCard({
  score, healthMap, onRescore, rescoring,
}: {
  score: number
  healthMap: Record<SectionKey, Health>
  onRescore: () => void
  rescoring: boolean
}) {
  const color = barColor(score)
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-soft">Foundation Strength</p>
        <InfoTooltip text="Scored 0–100 by evaluating the depth and specificity of your answers across all six foundation sections. Agents use this score to decide how confidently they can generate content on your behalf — higher score means more autonomous output." />
      </div>
      <p className="text-[32px] font-[500] leading-none mb-1" style={{ color }}>{score}</p>
      <p className="text-xs text-text-soft mb-2">out of 100 · {scoreStatus(score)}</p>
      <div className="h-1.5 w-full bg-surface-muted rounded-full overflow-hidden mb-4">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>

      <div className="space-y-2 mb-4">
        {SECTIONS.filter(s => s.key !== 'memory').map(s => {
          const h = healthMap[s.key]
          const dotColor = h === 'strong' ? '#10B981' : h === 'needs_work' ? '#F59E0B' : '#EF4444'
          const label = h === 'strong' ? 'Strong' : h === 'needs_work' ? 'Needs work' : 'Thin'
          return (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-xs text-text-sec">{s.title}</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                <span className="text-[11px] font-medium" style={{ color: dotColor }}>{label}</span>
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={onRescore}
        disabled={rescoring}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-text-sec hover:border-gray-400 hover:text-text transition-colors disabled:opacity-40"
      >
        {rescoring ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        Rescore my foundation
      </button>
    </div>
  )
}

const FIELD_LABELS: Record<string, string> = {
  businessDescription: 'Business Description',
  problemSolved: 'Problem Solved',
  transformation: 'Transformation',
  customerWho: 'Ideal Customer',
  customerFrustration: 'Customer Frustration',
  customerTriedBefore: 'Tried Before',
  customerBuyingTrigger: 'Buying Trigger',
  competitors: 'Competitors',
  differentiator: 'Differentiator',
  differentiatorOwn: 'In Your Words',
  toneTraits: 'Brand Voice Traits',
  brandsAdmired: 'Brands Admired',
  neverSoundLike: 'Never Sound Like',
  marketingBudget: 'Marketing Budget',
  channels: 'Channels',
  monthlyGoal: 'Monthly Goal',
}

function UploadCard({ onKnowledgeAdded }: { onKnowledgeAdded: (item: KnowledgeItem) => void }) {
  const [phase, setPhase] = useState<'idle' | 'url-input' | 'processing' | 'confirm'>('idle')
  const [dragOver, setDragOver] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [ingestId, setIngestId] = useState<string | null>(null)
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const runIngest = useCallback(async (type: string, content: string, filename?: string) => {
    setPhase('processing')
    try {
      const res = await fetch('/api/foundation/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content, filename }),
      })
      const data = await res.json()
      if (data.extractionResult) {
        const er: ExtractionResult = data.extractionResult
        setResult(er)
        setIngestId(data.id ?? null)
        const initial: Record<number, boolean> = {}
        er.items.forEach((item, i) => { initial[i] = item.confidence !== 'low' })
        setChecked(initial)
        setPhase('confirm')
        if (data.id) {
          onKnowledgeAdded({
            id: data.id,
            source_type: type,
            source_name: type === 'url' ? content : (filename ?? type),
            extraction_result: er,
            confirmed_fields: null,
            created_at: new Date().toISOString(),
          })
        }
      } else {
        setPhase('idle')
      }
    } catch {
      setPhase('idle')
    }
  }, [onKnowledgeAdded])

  const handleFile = useCallback(async (file: File) => {
    const type = file.name.endsWith('.pdf') ? 'pdf'
      : file.name.endsWith('.docx') || file.name.endsWith('.doc') ? 'docx'
      : file.type.startsWith('image/') ? 'image'
      : 'text'
    const base64 = await fileToBase64(file)
    runIngest(type, base64, file.name)
  }, [runIngest])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  async function handleSave() {
    if (!result) return
    setSaving(true)
    const confirmed: Record<number, boolean> = checked
    const answers: Record<string, unknown> = {}
    result.items.forEach((item, i) => {
      if (confirmed[i]) answers[item.field] = item.value
    })
    if (Object.keys(answers).length > 0) {
      await fetch('/api/foundation/save-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      }).catch(() => {})
    }
    setSaving(false)
    setPhase('idle')
    setResult(null)
    setIngestId(null)
    setUrlValue('')
  }

  const confirmedCount = Object.values(checked).filter(Boolean).length

  if (phase === 'processing') {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-soft mb-3">Uploaded Knowledge</p>
        <div className="flex flex-col items-center justify-center py-6 gap-3">
          <Loader2 size={20} className="animate-spin text-[#3B82F6]" />
          <p className="text-xs text-text-sec">Maya is reading this…</p>
        </div>
      </div>
    )
  }

  if (phase === 'confirm' && result) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-soft">Review Findings</p>
          <button onClick={() => { setPhase('idle'); setResult(null) }} className="text-text-soft hover:text-text">
            <X size={14} />
          </button>
        </div>
        <p className="text-[11px] text-text-sec mb-3 leading-relaxed">{result.summary}</p>
        {result.items.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-text-soft py-2">
            <AlertCircle size={13} /> No Foundation fields found in this content.
          </div>
        ) : (
          <div className="space-y-2 mb-3 max-h-64 overflow-y-auto pr-1">
            {result.items.map((item, i) => (
              <button
                key={i}
                onClick={() => setChecked(prev => ({ ...prev, [i]: !prev[i] }))}
                className="w-full text-left flex items-start gap-2 p-2 rounded-lg hover:bg-surface-muted transition-colors"
              >
                {checked[i]
                  ? <CheckSquare size={14} className="text-[#3B82F6] flex-shrink-0 mt-0.5" />
                  : <Square size={14} className="text-text-soft flex-shrink-0 mt-0.5" />
                }
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-text">
                    {FIELD_LABELS[item.field] ?? item.field}
                    <span className={`ml-1.5 text-[10px] font-normal ${item.confidence === 'high' ? 'text-[#10B981]' : item.confidence === 'medium' ? 'text-[#F59E0B]' : 'text-text-soft'}`}>
                      {item.confidence}
                    </span>
                  </p>
                  <p className="text-[11px] text-text-sec truncate">
                    {Array.isArray(item.value) ? item.value.join(', ') : item.value}
                  </p>
                  {item.question && <p className="text-[10px] text-[#F59E0B] mt-0.5">{item.question}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving || confirmedCount === 0}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ backgroundColor: '#3B82F6' }}
        >
          {saving ? 'Saving…' : `Save ${confirmedCount} item${confirmedCount !== 1 ? 's' : ''}`}
        </button>
        {result.items.length > 0 && (
          <button onClick={() => { setPhase('idle'); setResult(null) }} className="w-full text-center text-xs text-text-soft mt-2 hover:text-text-sec transition-colors">
            Dismiss all
          </button>
        )}
      </div>
    )
  }

  if (phase === 'url-input') {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-soft">Add URL</p>
          <button onClick={() => { setPhase('idle'); setUrlValue('') }} className="text-text-soft hover:text-text"><X size={14} /></button>
        </div>
        <input
          autoFocus
          type="url"
          placeholder="https://yoursite.com"
          value={urlValue}
          onChange={e => setUrlValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && urlValue.trim() && runIngest('url', urlValue.trim())}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#3B82F6] mb-3"
        />
        <button
          onClick={() => urlValue.trim() && runIngest('url', urlValue.trim())}
          disabled={!urlValue.trim()}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: '#3B82F6' }}
        >
          Read this page
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-soft">Uploaded Knowledge</p>
        <InfoTooltip text="Upload supporting materials — brand guides, case studies, past campaigns, website copy — and Maya pulls from them when generating content. More relevant context means more on-brand output." />
      </div>
      <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,.txt"
        className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`rounded-xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-[#3B82F6] bg-blue-50/40' : 'border-border hover:border-[#3B82F6] hover:bg-blue-50/30'
        } group`}
      >
        <CloudUpload size={20} className={`mx-auto mb-2 transition-colors ${dragOver ? 'text-[#3B82F6]' : 'text-text-soft group-hover:text-[#3B82F6]'}`} />
        <p className="text-xs text-text-soft group-hover:text-text-sec transition-colors">Drop a file or click to browse</p>
        <p className="text-[10px] text-text-soft mt-0.5">PDF · DOCX · Image · URL</p>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-xl border border-gray-200 text-text-sec hover:border-gray-400 transition-colors">
          <FileText size={12} /> Upload file
        </button>
        <button onClick={() => setPhase('url-input')}
          className="flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-xl border border-gray-200 text-text-sec hover:border-gray-400 transition-colors">
          <Link2 size={12} /> Add URL
        </button>
      </div>
    </div>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function SuggestionsCard({ suggestions }: { suggestions: string[] }) {
  if (suggestions.length === 0) return null
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Sparkles size={12} className="text-[#3B82F6]" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-soft">Maya&apos;s Suggestions</p>
        </div>
        <InfoTooltip text="Maya reviews your foundation answers and flags sections that are thin or missing detail. Addressing these raises your score and unlocks more autonomous agent behavior across your campaigns." />
      </div>
      <div className="space-y-3">
        {suggestions.map((s, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] flex-shrink-0 mt-1.5" />
            <p className="text-[12px] text-text-sec leading-relaxed">{s}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tab content ────────────────────────────────────────────────────────────────

const SOURCE_TYPE_LABEL: Record<string, string> = {
  pdf: 'PDF', docx: 'DOCX', image: 'Image', url: 'URL', text: 'Text',
}

function KnowledgeTab({
  items, loading, onRemove,
}: {
  items: KnowledgeItem[]
  loading: boolean
  onRemove: (id: string) => void
}) {
  const [removing, setRemoving] = useState<string | null>(null)

  async function handleRemove(id: string) {
    setRemoving(id)
    await fetch(`/api/foundation/knowledge/${id}`, { method: 'DELETE' }).catch(() => {})
    onRemove(id)
    setRemoving(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-text-soft" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-surface-muted flex items-center justify-center mb-5">
          <Upload size={28} className="text-text-soft" />
        </div>
        <h2 className="text-[17px] font-semibold text-text mb-2">Feed Maya your business materials</h2>
        <p className="text-sm text-text-sec leading-relaxed">
          Upload brand guides, competitor screenshots, product docs, past campaigns — Maya reads them and adds what&apos;s relevant to your Foundation.
          Use the <strong>Uploaded Knowledge</strong> panel on the right to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-[860px]">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-text-sec">{items.length} item{items.length !== 1 ? 's' : ''} uploaded · Maya pulls from these when generating content</p>
      </div>
      <div className="space-y-3">
        {items.map(item => {
          const confirmed = item.confirmed_fields ? Object.keys(item.confirmed_fields as Record<string, unknown>).length : 0
          const total = item.extraction_result?.items.length ?? 0
          return (
            <div key={item.id} className="rounded-2xl border border-gray-100 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-surface-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    {item.source_type === 'url' ? <Link2 size={14} className="text-text-soft" />
                      : item.source_type === 'image' ? <Eye size={14} className="text-text-soft" />
                      : <FileText size={14} className="text-text-soft" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[13px] font-semibold text-text truncate">{item.source_name ?? 'Untitled'}</p>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-text-soft bg-surface-muted px-1.5 py-0.5 rounded flex-shrink-0">
                        {SOURCE_TYPE_LABEL[item.source_type] ?? item.source_type}
                      </span>
                    </div>
                    {item.extraction_result?.summary && (
                      <p className="text-[12px] text-text-sec leading-relaxed">{item.extraction_result.summary}</p>
                    )}
                    {total > 0 && (
                      <p className="text-[11px] text-text-soft mt-1">
                        {confirmed > 0 ? `${confirmed} of ${total}` : total} field{total !== 1 ? 's' : ''} extracted
                        {confirmed > 0 && ' · applied to Foundation'}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(item.id)}
                  disabled={removing === item.id}
                  className="text-text-soft hover:text-[#EF4444] transition-colors flex-shrink-0 mt-0.5 disabled:opacity-40"
                >
                  {removing === item.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MemoryStatCard({ stat }: { stat: AgentMemoryStat }) {
  const reviewed = stat.approved + stat.rejected
  const approvalColor = stat.approvalRate === null ? '#9CA3AF'
    : stat.approvalRate >= 70 ? '#10B981'
    : stat.approvalRate >= 40 ? '#F59E0B'
    : '#EF4444'

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-[13px] font-semibold text-text leading-snug">{stat.agentName}</p>
        {stat.approvalRate !== null && (
          <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: approvalColor }}>
            {stat.approvalRate}% approved
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="text-center">
          <p className="text-[18px] font-[500] text-text leading-none">{stat.total}</p>
          <p className="text-[10px] text-text-soft mt-0.5">runs</p>
        </div>
        <div className="w-px h-6 bg-border flex-shrink-0" />
        <div className="text-center">
          <p className="text-[18px] font-[500] leading-none" style={{ color: '#10B981' }}>{stat.approved}</p>
          <p className="text-[10px] text-text-soft mt-0.5">approved</p>
        </div>
        {stat.rejected > 0 && (
          <>
            <div className="w-px h-6 bg-border flex-shrink-0" />
            <div className="text-center">
              <p className="text-[18px] font-[500] leading-none" style={{ color: '#EF4444' }}>{stat.rejected}</p>
              <p className="text-[10px] text-text-soft mt-0.5">rejected</p>
            </div>
          </>
        )}
        {stat.pending > 0 && (
          <>
            <div className="w-px h-6 bg-border flex-shrink-0" />
            <div className="text-center">
              <p className="text-[18px] font-[500] leading-none text-text-soft">{stat.pending}</p>
              <p className="text-[10px] text-text-soft mt-0.5">pending</p>
            </div>
          </>
        )}
      </div>

      {reviewed > 0 && (
        <div className="h-1.5 w-full bg-surface-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${(stat.approved / reviewed) * 100}%`, backgroundColor: approvalColor }}
          />
        </div>
      )}

      {stat.lastRunAt && (
        <p className="text-[11px] text-text-soft mt-2">{formatRelative(stat.lastRunAt)}</p>
      )}
    </div>
  )
}

function MemoryTab({ data, loading }: { data: FoundationMemoryResponse | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-text-soft" />
      </div>
    )
  }

  if (!data?.hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-surface-muted flex items-center justify-center mb-5">
          <Brain size={28} className="text-text-soft" />
        </div>
        <h2 className="text-[17px] font-semibold text-text mb-2">Maya&apos;s memory builds as you work</h2>
        <p className="text-sm text-text-sec leading-relaxed mb-6">
          As you approve and edit agent outputs, Maya learns your preferences and applies them to future runs automatically.
        </p>
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 p-5 text-left">
          <p className="text-xs font-semibold text-text-soft uppercase tracking-wide mb-3">What will appear here</p>
          <ul className="space-y-2">
            {[
              'Approval patterns per agent',
              'Top-performing topics and formats',
              'Best-performing channels',
              'Flagged off-brand outputs',
              'Content that consistently gets edited',
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-text-sec">
                <div className="w-1 h-1 rounded-full bg-text-soft flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[860px]">
      {/* Auto-populated banner */}
      <div className="flex items-center gap-2 mb-5 px-0.5">
        <div className="flex items-center gap-1.5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-full px-3 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
          <span className="text-[11px] font-semibold text-[#166534] uppercase tracking-wide">Auto-populated</span>
        </div>
        <p className="text-xs text-text-soft">Updated as you approve and reject agent outputs · Last 30 days</p>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total outputs', value: data.totalOutputs, color: '#1D4ED8' },
          { label: 'Approved', value: data.totalApproved, color: '#10B981' },
          { label: 'Rejected', value: data.totalRejected, color: '#EF4444' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 text-center">
            <p className="text-[28px] font-[500] leading-none mb-1" style={{ color }}>{value}</p>
            <p className="text-xs text-text-soft">{label}</p>
          </div>
        ))}
      </div>

      {/* Per-agent grid */}
      <div className="grid grid-cols-2 gap-4">
        {data.stats.map(stat => (
          <MemoryStatCard key={stat.agentId} stat={stat} />
        ))}
      </div>
    </div>
  )
}

function ConnectionsEmpty() {
  const agentSectionsMap = useMemo(() => buildAgentSectionsMap(), [])
  return (
    <div className="py-6">
      <div className="text-center max-w-lg mx-auto mb-8">
        <h2 className="text-[17px] font-semibold text-text mb-2">Every agent draws from your Foundation</h2>
        <p className="text-sm text-text-sec leading-relaxed">
          This view shows exactly which Foundation sections power which agents, and how improving each section sharpens specific outputs.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {AGENT_REGISTRY.map(({ id, name, icon: Icon, color }) => {
          const sections = agentSectionsMap[id] ?? []
          return (
            <div key={id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color.bg }}>
                  <span style={{ color: color.fg, display: 'contents' }}>
                    <Icon size={15} className="text-current" />
                  </span>
                </div>
                <p className="text-[13px] font-semibold text-text">{name}</p>
              </div>
              {sections.length > 0 ? (
                <p className="text-[11px] text-text-soft">Reads: {sections.join(', ')}</p>
              ) : (
                <p className="text-[11px] text-text-soft italic">No section connections mapped yet</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Inline section editor ─────────────────────────────────────────────────────

const DOC_LABELS: Record<string, string> = {
  brief: 'Business Brief', icp: 'Ideal Customer Profile',
  positioning: 'Positioning Statement', voice: 'Brand Voice Guide', plan: '30-Day Plan',
}

function SectionEditCard({
  section, draft, onChange, onSave, onCancel, saving, regenProgress,
}: {
  section: SectionDef
  draft: Partial<Answers>
  onChange: (patch: Partial<Answers>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  regenProgress: string | null
}) {
  const Icon = section.icon
  return (
    <div className="bg-white rounded-2xl border-2 border-[#3B82F6] p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-[#BFDBFE] flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-[#1D4ED8]" />
        </div>
        <span className="text-[14px] font-[500] text-text">Editing: {section.title}</span>
      </div>

      {/* Fields */}
      <div className="space-y-3 mb-4">
        {section.editFields.map(field => {
          const val = draft[field.key]

          if (field.type === 'competitors') {
            const comps = (Array.isArray(val) ? val : ['', '', '']) as string[]
            return (
              <div key={field.key}>
                <label className="block text-[11px] font-semibold text-text-soft uppercase tracking-wide mb-1.5">{field.label}</label>
                <div className="space-y-1.5">
                  {[0, 1, 2].map(i => (
                    <input key={i} type="text" value={comps[i] ?? ''} placeholder={`Competitor ${i + 1}`}
                      onChange={e => {
                        const next = [...comps]
                        next[i] = e.target.value
                        onChange({ [field.key]: next } as Partial<Answers>)
                      }}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#3B82F6]"
                    />
                  ))}
                </div>
              </div>
            )
          }

          if (field.type === 'chips') {
            const chips = Array.isArray(val) ? (val as string[]).join(', ') : (val as string ?? '')
            return (
              <div key={field.key}>
                <label className="block text-[11px] font-semibold text-text-soft uppercase tracking-wide mb-1.5">{field.label}</label>
                <input type="text" value={chips} placeholder="e.g. direct, warm, professional"
                  onChange={e => onChange({ [field.key]: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } as Partial<Answers>)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#3B82F6]"
                />
              </div>
            )
          }

          if (field.type === 'text') {
            return (
              <div key={field.key}>
                <label className="block text-[11px] font-semibold text-text-soft uppercase tracking-wide mb-1.5">{field.label}</label>
                <input type="text" value={(val as string) ?? ''}
                  onChange={e => onChange({ [field.key]: e.target.value } as Partial<Answers>)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#3B82F6]"
                />
              </div>
            )
          }

          return (
            <div key={field.key}>
              <label className="block text-[11px] font-semibold text-text-soft uppercase tracking-wide mb-1.5">{field.label}</label>
              <textarea rows={3} value={(val as string) ?? ''}
                onChange={e => onChange({ [field.key]: e.target.value } as Partial<Answers>)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#3B82F6] resize-none leading-relaxed"
              />
            </div>
          )
        })}
      </div>

      {/* Affected docs panel */}
      {section.affectedDocs.length > 0 && (
        <div className="rounded-xl bg-blue-50 border border-[#BFDBFE] px-3 py-2.5 mb-4">
          <p className="text-[11px] font-semibold text-[#1D4ED8] mb-1">Changes here will update:</p>
          <p className="text-[11px] text-[#1D4ED8]">
            {section.affectedDocs.map(d => DOC_LABELS[d] ?? d).join(' · ')}
          </p>
        </div>
      )}

      {regenProgress && (
        <div className="flex items-center gap-2 text-[11px] text-text-soft mb-3">
          <Loader2 size={11} className="animate-spin" /> {regenProgress}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={onSave} disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ backgroundColor: '#3B82F6' }}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button onClick={onCancel} disabled={saving}
          className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-text-sec hover:border-gray-400 transition-colors disabled:opacity-40">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function FoundationHub({
  companyName, answers, score: initialScore, fieldScores, lastUpdated,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('intelligence')
  const [currentScore, setCurrentScore] = useState(initialScore)
  const [rescoring, setRescoring] = useState(false)
  const [lastScored, setLastScored] = useState<string | null>(lastUpdated)
  const [localAnswers, setLocalAnswers] = useState<Answers>(answers)
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<Answers>>({})
  const [editSaving, setEditSaving] = useState(false)
  const [regenProgress, setRegenProgress] = useState<string | null>(null)

  const [memoryData, setMemoryData] = useState<FoundationMemoryResponse | null>(null)
  const [memoryLoading, setMemoryLoading] = useState(false)
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([])
  const [knowledgeLoading, setKnowledgeLoading] = useState(false)
  const [knowledgeFetched, setKnowledgeFetched] = useState(false)

  useEffect(() => {
    if (activeTab !== 'memory' || memoryData) return
    setMemoryLoading(true)
    fetch('/api/foundation/memory')
      .then(r => r.json())
      .then(setMemoryData)
      .catch(() => {})
      .finally(() => setMemoryLoading(false))
  }, [activeTab, memoryData])

  useEffect(() => {
    if (activeTab !== 'knowledge' || knowledgeFetched) return
    setKnowledgeLoading(true)
    setKnowledgeFetched(true)
    fetch('/api/foundation/knowledge')
      .then(r => r.json())
      .then((data: KnowledgeItem[]) => setKnowledgeItems(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setKnowledgeLoading(false))
  }, [activeTab, knowledgeFetched])

  function startEdit(key: SectionKey) {
    setEditDraft({ ...localAnswers })
    setEditingSection(key)
  }

  async function saveEdit(section: SectionDef) {
    setEditSaving(true)
    const merged = { ...localAnswers, ...editDraft }
    try {
      await fetch('/api/foundation/save-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: editDraft }),
      })
      setLocalAnswers(merged)
      setEditingSection(null)

      // Partial regen
      if (section.affectedDocs.length > 0) {
        setRegenProgress(`Updating ${section.affectedDocs.join(', ')}…`)
        await fetch('/api/foundation/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            answers: merged,
            companyName,
            sections: [section.key],
          }),
        }).catch(() => {})
        setRegenProgress(null)
      }
    } finally {
      setEditSaving(false)
    }
  }

  const handleKnowledgeAdded = useCallback((item: KnowledgeItem) => {
    setKnowledgeItems(prev => [item, ...prev])
  }, [])

  const handleKnowledgeRemoved = useCallback((id: string) => {
    setKnowledgeItems(prev => prev.filter(k => k.id !== id))
  }, [])

  const healthMap = useMemo(() => {
    const m = {} as Record<SectionKey, Health>
    for (const s of SECTIONS) m[s.key] = sectionHealth(localAnswers, fieldScores, s.key)
    return m
  }, [localAnswers, fieldScores])

  const suggestions = useMemo(() => deriveSuggestions(localAnswers, healthMap), [localAnswers, healthMap])

  const weakSections = SECTIONS.filter(s => s.key !== 'memory' && healthMap[s.key] !== 'strong')
  const limitedAgentCount = useMemo(() => {
    const names = new Set<string>()
    for (const s of weakSections) {
      for (const a of s.agents) { if (a.warnIfThin) names.add(a.name) }
    }
    return names.size
  }, [weakSections])

  async function handleRescore() {
    setRescoring(true)
    try {
      const res = await fetch('/api/foundation/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: localAnswers }),
      })
      const data = await res.json()
      if (data.overallScore != null) {
        setCurrentScore(data.overallScore)
        setLastScored(new Date().toISOString())
      }
    } finally {
      setRescoring(false)
    }
  }

  const TABS: { id: TabId; label: string; count?: number }[] = [
    { id: 'intelligence', label: 'Intelligence', count: 6 },
    { id: 'knowledge',    label: 'Knowledge',    count: knowledgeItems.length || undefined },
    { id: 'memory',       label: 'Memory',       count: memoryData?.stats.length ?? undefined },
    { id: 'connections',  label: 'Agent connections' },
  ]

  const fillColor = barColor(currentScore)

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-8 pt-6 pb-0">
        <div className="mx-auto max-w-[1240px]">

          {/* Title row */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-soft mb-1">Foundation</p>
              <h1 className="text-[22px] font-[500] tracking-[-0.015em] text-text leading-tight">
                Maya&apos;s understanding of your business
              </h1>
              <p className="text-[13px] text-text-soft mt-1">
                {formatRelative(lastScored)} · 6 sections · {knowledgeItems.length} file{knowledgeItems.length !== 1 ? 's' : ''} uploaded
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 pt-1">
              <button
                onClick={handleRescore}
                disabled={rescoring}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border border-gray-200 text-text-sec hover:border-gray-400 hover:text-text transition-colors disabled:opacity-40"
              >
                {rescoring ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Rescore
              </button>
              <button
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: '#3B82F6' }}
              >
                <Plus size={14} /> Add knowledge
              </button>
            </div>
          </div>

          {/* Strength bar */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[12px] text-text-soft whitespace-nowrap">Foundation strength</span>
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${currentScore}%`, backgroundColor: fillColor }}
              />
            </div>
            <span className="text-[12px] font-[500] whitespace-nowrap" style={{ color: fillColor }}>
              {currentScore} / 100
            </span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-[#3B82F6] text-[#3B82F6]'
                      : 'border-transparent text-text-soft hover:text-text-sec'
                  }`}
                >
                  {tab.label}
                  {tab.count != null && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'bg-surface-muted text-text-soft'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1240px] px-8 py-6">

        {/* Intelligence tab */}
        {activeTab === 'intelligence' && (
          <div className="flex gap-6 items-start">

            {/* Left — section cards */}
            <div className="flex-1 min-w-0">

              {/* Nudge banner */}
              {currentScore < 70 && weakSections.length > 0 && (
                <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-[12px] text-text-sec">
                    <span className="font-semibold text-text">{weakSections.length} sections</span> need attention
                    {limitedAgentCount > 0 ? ` — completing them unlocks better outputs from ${limitedAgentCount} agents.` : '.'}
                  </p>
                  <button className="text-[12px] font-medium text-[#3B82F6] whitespace-nowrap hover:underline">
                    View gaps →
                  </button>
                </div>
              )}

              {/* Section cards */}
              <div className="space-y-3">
                {SECTIONS.map(section => {
                  const Icon = section.icon
                  const health = healthMap[section.key]
                  const preview = sectionPreview(localAnswers, section.key)
                  const isMemory = section.key === 'memory'
                  const isEditing = editingSection === section.key

                  if (isEditing) {
                    return (
                      <SectionEditCard
                        key={section.key}
                        section={section}
                        draft={editDraft}
                        onChange={patch => setEditDraft(prev => ({ ...prev, ...patch }))}
                        onSave={() => saveEdit(section)}
                        onCancel={() => setEditingSection(null)}
                        saving={editSaving}
                        regenProgress={regenProgress}
                      />
                    )
                  }

                  return (
                    <div key={section.key} className="bg-white rounded-2xl border border-gray-100 p-5">
                      {/* Card header */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                            <Icon size={15} className="text-text-sec" />
                          </div>
                          <div className="flex items-center">
                            <span className="text-[14px] font-[500] text-text">{section.title}</span>
                            <HealthPill health={health} isMemory={isMemory} />
                          </div>
                        </div>
                        {section.editable && !editingSection && (
                          <button
                            onClick={() => startEdit(section.key)}
                            className="flex items-center gap-1.5 text-[12px] font-medium text-[#3B82F6] border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
                            <Pencil size={11} /> Edit
                          </button>
                        )}
                      </div>

                      {/* Preview */}
                      <div className="pl-[42px] mb-3">
                        {preview ? (
                          <p className="text-[13px] text-text-sec leading-relaxed">{preview}</p>
                        ) : (
                          <p className="text-[13px] text-text-soft italic leading-relaxed">{section.emptyText}</p>
                        )}
                      </div>

                      {/* Agent tags */}
                      <div className="pl-[42px] flex flex-wrap gap-1.5">
                        {section.agents.map((agent) => (
                          <AgentPill key={agent.id} agent={agent} health={health} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right — sidebar */}
            <div className="w-[280px] flex-shrink-0 space-y-4">
              <StrengthCard score={currentScore} healthMap={healthMap} onRescore={handleRescore} rescoring={rescoring} />
              <UploadCard onKnowledgeAdded={handleKnowledgeAdded} />
              <SuggestionsCard suggestions={suggestions} />
            </div>
          </div>
        )}

        {activeTab === 'knowledge'   && <KnowledgeTab items={knowledgeItems} loading={knowledgeLoading} onRemove={handleKnowledgeRemoved} />}
        {activeTab === 'memory'      && <MemoryTab data={memoryData} loading={memoryLoading} />}
        {activeTab === 'connections' && <ConnectionsEmpty />}
      </div>
    </div>
  )
}
