import type { FoundationMemoryResponse } from '@/lib/foundation/memory'
import { AGENTS } from '@/lib/agents/registry'
import { formatVisualFieldsForMaya, FOUNDATION_VISUAL_FIELDS } from '@/lib/foundation/visualFields'
import type { MayaPageContext } from '@/lib/maya/contextTypes'
import { MAYA_VOICE_RULE } from '@/lib/maya/voiceRules'
import { formatActiveFormState, truncateForMaya } from '@/lib/maya/formStateContext'

export type FoundationHubTabId = 'intelligence' | 'knowledge' | 'memory' | 'connections'

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
  'YOUR LOOK COACHING: There are exactly five fields in fixed order. Never invent fields (no "Brand Colors", "logo situation", or hex codes). ' +
  `Order: ${FOUNDATION_VISUAL_FIELDS.map((f, i) => `${i + 1}) "${f.label}"`).join('; ')}. ` +
  'Help one field at a time using the exact label from the form. Field 1 is overall aesthetic; field 4 is palette in words only.'

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

function buildFoundationHubTabState(input: {
  activeTab: FoundationHubTabId
  score: number
  sectionHealth: Record<string, string>
  editingSection: string | null
  regenProgress: string | null
  weakSections: string[]
  knowledgeItems: KnowledgeItem[]
  memoryData: FoundationMemoryResponse | null | undefined
}): string {
  switch (input.activeTab) {
    case 'intelligence': {
      const parts = [`Foundation score ${input.score}%`]
      const thinOrWeak = Object.entries(input.sectionHealth)
        .filter(([key, health]) => key !== 'memory' && health !== 'strong')
        .map(([key, health]) => `${SECTION_TITLES[key] ?? key}: ${health}`)
      if (thinOrWeak.length) parts.push(`Field scores: ${thinOrWeak.join('; ')}`)
      if (input.weakSections.length) {
        parts.push(`Needs work: ${input.weakSections.slice(0, 3).join(', ')}`)
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
  if (input.weakSections.length) {
    metrics.push(`Needs work: ${input.weakSections.join(', ')}`)
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

  let affordance =
    `${MAYA_VOICE_RULE} User manages Foundation intelligence, knowledge uploads, agent memory, and connections. Lead with CURRENTLY VIEWING before page summary.`

  if (input.websiteUrl?.trim()) {
    affordance +=
      ' Website URL is editable under Your Business (and in Settings). Never substitute a different TLD — use the saved website exactly.'
  }

  if (coachingVisual) {
    affordance += ` ${YOUR_LOOK_MAYA_RULE}`
  }

  if (input.editingSection === 'visual') {
    affordance +=
      ' User is editing Your Look now — suggest copy for the next empty field only, using the exact field label shown above.'
  }

  if (input.editingSectionForm) {
    const filled = input.editingSectionForm.fields
      .filter(f => f.value.trim())
      .map(f => `${f.label}: ${truncateForMaya(f.value)}`)
    const empty = input.editingSectionForm.fields
      .filter(f => !f.value.trim())
      .map(f => f.label)

    return {
      page: 'FOUNDATION PAGE',
      dataSource: 'live',
      company: input.companyName || undefined,
      activeView: {
        label: `${input.editingSectionForm.sectionTitle} edit form`,
        state: formatActiveFormState(filled, empty),
      },
      metrics,
      affordance:
        `${affordance} The user has a section edit form on screen. Use visible field values — do not re-ask for fields already shown in the form.`,
    }
  }

  return {
    page: 'FOUNDATION PAGE',
    dataSource: 'live',
    company: input.companyName || undefined,
    activeView: {
      label: TAB_LABELS[input.activeTab],
      state: buildFoundationHubTabState(input),
    },
    metrics,
    affordance,
  }
}
