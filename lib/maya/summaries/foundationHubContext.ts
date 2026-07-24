import type { FoundationMemoryResponse } from '@/lib/foundation/memory'
import { isCommandCenterAgent } from '@/lib/agents/contentPosting'
import { AGENTS } from '@/lib/agents/registry'
import { FIELD_EXPECTATIONS } from '@/lib/foundation/score'
import {
  computeSectionScore,
  FOUNDATION_SECTION_KEY_FIELDS,
  type FoundationScoredSectionKey,
} from '@/lib/foundation/sections'
import { formatVisualFieldsForMaya, FOUNDATION_VISUAL_FIELDS } from '@/lib/foundation/visualFields'
import type { MayaPageContext } from '@/lib/maya/contextTypes'
import { MAYA_VOICE_RULE } from '@/lib/maya/voiceRules'
import { formatActiveFormState, truncateForMaya } from '@/lib/maya/formStateContext'

export type BrandKitColorRef = { role: string; name: string | null; hex: string }

export type FoundationHubTabId = 'intelligence' | 'knowledge' | 'memory' | 'connections'

const SCORED_SECTION_KEYS: FoundationScoredSectionKey[] = [
  'business',
  'customer',
  'position',
  'voice',
  'visual',
  'plan',
]

const FOUNDATION_SECTION_COACHING =
  'Foundation section pills: Strong = scores ≥70. Needs work / Thin = below Strong. Agent tags on a section card show "limited" when that section is not Strong and the agent depends on it — improving empty or low-scored fields removes the limit. Prioritize gaps listed below; use exact form field labels when proposing patches.'

type KnowledgeItem = {
  source_type: string
}

const TAB_LABELS: Record<FoundationHubTabId, string> = {
  intelligence: 'Intelligence',
  knowledge: 'Knowledge',
  memory: 'Memory',
  connections: 'Agent connections',
}

const SECTION_TITLES: Record<string, string> = {
  business: 'Your Business',
  customer: 'Your Customer',
  position: 'Your Position',
  voice: 'Your Voice',
  visual: 'Your Look',
  plan: 'Your 30 Days',
  memory: "Maya's Memory",
}

const YOUR_LOOK_MAYA_RULE =
  'YOUR LOOK COACHING: There are exactly five fields in fixed order. Never invent fields (no "Brand Colors", "logo situation", or hex codes on this form). ' +
  `Order: ${FOUNDATION_VISUAL_FIELDS.map((f, i) => `${i + 1}) "${f.label}"`).join('; ')}. ` +
  'Help one field at a time using the exact label from the form. Field 1 is overall aesthetic; field 4 is palette in words only (no hex on this form).'

function formatBrandKitPaletteLine(colors: BrandKitColorRef[]): string {
  if (colors.length === 0) return 'Brand Kit palette: not set yet'
  return colors
    .map(c => `${c.role} ${c.name?.trim() || c.hex} (${c.hex})`.trim())
    .join('; ')
}

const DOC_LABELS: Record<string, string> = {
  brief: 'Business Brief',
  icp: 'Ideal Customer Profile',
  positioning: 'Positioning Statement',
  voice: 'Brand Voice Guide',
  plan: '30-Day Plan',
}

function summarizeKnowledgeItems(items: KnowledgeItem[]): string {
  if (items.length === 0) return 'No materials uploaded yet'
  const counts: Record<string, number> = {}
  for (const item of items) {
    const type = item.source_type || 'unknown'
    counts[type] = (counts[type] ?? 0) + 1
  }
  const breakdown = Object.entries(counts).map(([type, count]) => `${count} ${type}`).join(', ')
  return `${items.length} document(s): ${breakdown}`
}

function summarizeMemory(data: FoundationMemoryResponse | null | undefined): string {
  if (!data?.hasData) return 'No memory captured yet'
  const parts = [
    `${data.totalOutputs} agent output(s)`,
    `${data.totalApproved} approved`,
  ]
  if (data.lastActivityAt) {
    parts.push(`last activity ${new Date(data.lastActivityAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`)
  }
  return parts.join('; ')
}

function summarizeAgentConnections(): string {
  const agents = Object.values(AGENTS)
  const examples = agents.slice(0, 3).map(agent => {
    const sections = agent.foundationSections
      .map(key => SECTION_TITLES[key] ?? key)
      .join(', ')
    return `${agent.name} → ${sections || '—'}`
  })
  const tail = agents.length > 3 ? `; +${agents.length - 3} more on screen` : ''
  return `${agents.length} agents mapped — ${examples.join('; ')}${tail}`
}

function healthLabel(health: string): string {
  if (health === 'strong') return 'Strong'
  if (health === 'needs_work') return 'Needs work'
  if (health === 'thin') return 'Thin'
  return health
}

function fieldAnswerFilled(key: string, answers: Record<string, unknown>): boolean {
  const val = answers[key]
  if (Array.isArray(val)) return val.filter(Boolean).length > 0
  return Boolean(String(val ?? '').trim())
}

function limitedAgentNames(sectionKey: FoundationScoredSectionKey, health: string): string[] {
  if (health === 'strong') return []
  return Object.values(AGENTS)
    .filter(agent => isCommandCenterAgent(agent.id) && agent.warnIfThinSections.includes(sectionKey))
    .map(agent => agent.name)
}

function describeFieldGap(
  fieldKey: string,
  answers: Record<string, unknown>,
  fieldScores?: Record<string, { score: number; feedback: string | null }>,
): string | null {
  const label = FIELD_EXPECTATIONS[fieldKey]?.label ?? fieldKey
  const row = fieldScores?.[fieldKey]
  const filled = fieldAnswerFilled(fieldKey, answers)

  if (row && row.score < 70) {
    const feedback = row.feedback ? ` — ${truncateForMaya(row.feedback)}` : ''
    return `${label} (${row.score}/100${feedback})`
  }
  if (!filled) return `${label} (empty)`
  if (!row && filled) return `${label} (filled, unscored)`
  return null
}

function buildSectionGapDetail(
  sectionKey: FoundationScoredSectionKey,
  health: string,
  answers: Record<string, unknown>,
  fieldScores?: Record<string, { score: number; feedback: string | null }>,
): string {
  const title = SECTION_TITLES[sectionKey] ?? sectionKey
  const sectionScore = fieldScores ? computeSectionScore(fieldScores, sectionKey) : null
  const scorePart = sectionScore != null ? `, section score ${sectionScore}%` : ''
  const gaps = FOUNDATION_SECTION_KEY_FIELDS[sectionKey]
    .map(key => describeFieldGap(key, answers, fieldScores))
    .filter((line): line is string => Boolean(line))
  const limited = limitedAgentNames(sectionKey, health)
  const parts = [`${title}: ${healthLabel(health)}${scorePart}`]
  if (gaps.length) parts.push(`Gaps: ${gaps.join('; ')}`)
  if (limited.length) {
    parts.push(`Agents marked "limited" on this card until Strong: ${limited.join(', ')}`)
  }
  return parts.join('. ')
}

function buildSectionGapMetrics(
  sectionHealth: Record<string, string>,
  answers: Record<string, unknown>,
  fieldScores?: Record<string, { score: number; feedback: string | null }>,
): string[] {
  return SCORED_SECTION_KEYS
    .filter(key => {
      const health = sectionHealth[key]
      return health && health !== 'strong'
    })
    .map(key => buildSectionGapDetail(key, sectionHealth[key]!, answers, fieldScores))
}

function buildEditingSectionActiveState(input: {
  editingSection: string
  editingSectionForm: { sectionTitle: string; fields: { label: string; value: string }[] }
  sectionHealth: Record<string, string>
  answers?: Record<string, unknown>
  fieldScores?: Record<string, { score: number; feedback: string | null }>
}): string {
  const filled = input.editingSectionForm.fields
    .filter(field => field.value.trim())
    .map(field => `${field.label}: ${truncateForMaya(field.value)}`)
  const empty = input.editingSectionForm.fields
    .filter(field => !field.value.trim())
    .map(field => field.label)
  const formState = formatActiveFormState(filled, empty)

  const sectionKey = input.editingSection as FoundationScoredSectionKey
  if (!SCORED_SECTION_KEYS.includes(sectionKey)) return formState

  const health = input.sectionHealth[sectionKey] ?? 'thin'
  const gapDetail = buildSectionGapDetail(
    sectionKey,
    health,
    input.answers ?? {},
    input.fieldScores,
  )
  return `${gapDetail}\n\n${formState}`
}

function buildFoundationHubTabState(input: {
  activeTab: FoundationHubTabId
  score: number
  sectionHealth: Record<string, string>
  editingSection: string | null
  regenProgress: string | null
  weakSections: string[]
  knowledgeItems: KnowledgeItem[]
  memoryData: FoundationMemoryResponse | null | undefined
  answers?: Record<string, unknown>
  fieldScores?: Record<string, { score: number; feedback: string | null }>
}): string {
  switch (input.activeTab) {
    case 'intelligence': {
      const parts = [`Foundation score ${input.score}%`]
      if (input.weakSections.length) {
        parts.push(`${input.weakSections.length} sections need attention`)
      }
      if (input.editingSection) {
        parts.push(`Editing ${SECTION_TITLES[input.editingSection] ?? input.editingSection}`)
      }
      if (input.regenProgress) parts.push(input.regenProgress)
      const docKeys = ['brief', 'icp', 'positioning', 'voice', 'plan'] as const
      parts.push(
        `Documents on screen: ${docKeys.map(k => DOC_LABELS[k]).join(', ')} (regenerate from section edits)`,
      )
      return parts.join('; ')
    }
    case 'knowledge':
      return summarizeKnowledgeItems(input.knowledgeItems)
    case 'memory':
      return summarizeMemory(input.memoryData)
    case 'connections':
      return summarizeAgentConnections()
  }
}

export function buildFoundationHubMayaContext(input: {
  companyName: string
  websiteUrl?: string | null
  activeTab: FoundationHubTabId
  score: number
  sectionHealth: Record<string, string>
  editingSection: string | null
  editingSectionForm?: { sectionTitle: string; fields: { label: string; value: string }[] } | null
  regenProgress: string | null
  knowledgeItems: KnowledgeItem[]
  memoryData: FoundationMemoryResponse | null | undefined
  weakSections: string[]
  answers?: Record<string, unknown>
  fieldScores?: Record<string, { score: number; feedback: string | null }>
  brandKitColors?: BrandKitColorRef[]
}): MayaPageContext {
  const healthLine = Object.entries(input.sectionHealth)
    .map(([k, h]) => `${SECTION_TITLES[k] ?? k}: ${h}`)
    .join('; ')

  const metrics: string[] = [
    `Foundation score: ${input.score}%`,
    `Section health: ${healthLine}`,
    `Knowledge sources: ${input.knowledgeItems.length}`,
  ]

  if (input.websiteUrl?.trim()) {
    metrics.push(`Website: ${input.websiteUrl.trim()} (canonical — use this exact domain in forms and advice)`)
  }

  if (input.memoryData?.totalOutputs != null) {
    metrics.push(`Agent memory outputs: ${input.memoryData.totalOutputs}`)
  }

  if (input.activeTab === 'intelligence' && input.answers) {
    metrics.push(...buildSectionGapMetrics(input.sectionHealth, input.answers, input.fieldScores))
  }

  const coachingVisual =
    input.editingSection === 'visual' ||
    input.weakSections.includes('Your Look') ||
    input.sectionHealth.visual === 'needs_work' ||
    input.sectionHealth.visual === 'thin'

  if (coachingVisual && input.answers) {
    metrics.push('Your Look fields (exact form order):')
    metrics.push(...formatVisualFieldsForMaya(input.answers, input.fieldScores))
  }

  if (coachingVisual && input.brandKitColors && input.brandKitColors.length > 0) {
    metrics.push(`Brand Kit palette (authoritative): ${formatBrandKitPaletteLine(input.brandKitColors)}`)
  }

  let affordance =
    `${MAYA_VOICE_RULE} User manages Foundation intelligence, knowledge uploads, agent memory, and connections. Lead with CURRENTLY VIEWING before page summary. ${FOUNDATION_SECTION_COACHING}`

  if (input.websiteUrl?.trim()) {
    affordance +=
      ' Website URL is editable under Your Business (and in Settings). Never substitute a different TLD — use the saved website exactly.'
  }

  if (coachingVisual) {
    affordance += ` ${YOUR_LOOK_MAYA_RULE}`
    if (input.brandKitColors && input.brandKitColors.length > 0) {
      affordance +=
        ' Brand Kit already has a locked color palette (see metrics). Never ask the user what their brand colors are — translate that palette into descriptive words for Field 4 "Colors in words (no hex)". Hex codes stay in Brand Kit; this Foundation field is words-only.'
    }
  }

  if (input.editingSection === 'visual') {
    affordance +=
      ' User is editing Your Look now — suggest copy for the next empty field only, using the exact field label shown above.'
  }

  if (input.activeTab === 'intelligence' && !input.editingSection) {
    affordance +=
      ' User is on the Foundation Intelligence overview (section cards visible). Weak sections and limited agents are listed in metrics. When they agree to improved copy, propose a maya-form-patch block — Apply writes directly to Foundation and re-scores. Do not tell them to open a section and paste manually.'
  }

  if (input.editingSectionForm && input.editingSection) {
    const activeState = buildEditingSectionActiveState({
      editingSection: input.editingSection,
      editingSectionForm: input.editingSectionForm,
      sectionHealth: input.sectionHealth,
      answers: input.answers,
      fieldScores: input.fieldScores,
    })

    return {
      page: 'FOUNDATION PAGE',
      dataSource: 'live',
      company: input.companyName || undefined,
      activeView: {
        label: `${input.editingSectionForm.sectionTitle} edit form`,
        state: activeState,
      },
      metrics,
      affordance:
        `${affordance} The user has a section edit form on screen. You can see why this section is not Strong, which agents are limited, and which fields are empty or low-scored — use that context proactively. Do not re-ask for fields already filled on the form. When they agree to a suggested value, propose it with a maya-form-patch block so they can click Apply — Apply saves to Foundation immediately (they do not need to click Save changes). Do not imply you already wrote it into the form.`,
    }
  }

  return {
    page: 'FOUNDATION PAGE',
    dataSource: 'live',
    company: input.companyName || undefined,
    activeView: {
      label: TAB_LABELS[input.activeTab],
      state: buildFoundationHubTabState({
        ...input,
        answers: input.answers,
        fieldScores: input.fieldScores,
      }),
    },
    metrics,
    affordance,
  }
}
