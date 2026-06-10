import type { FoundationMemoryResponse } from '@/lib/foundation/memory'
import { AGENTS } from '@/lib/agents/registry'
import type { MayaPageContext } from '@/lib/maya/contextTypes'
import { MAYA_VOICE_RULE } from '@/lib/maya/voiceRules'

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
  plan: 'Your 30 Days',
  memory: "Maya's Memory",
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
  activeTab: FoundationHubTabId
  score: number
  sectionHealth: Record<string, string>
  editingSection: string | null
  regenProgress: string | null
  knowledgeItems: KnowledgeItem[]
  memoryData: FoundationMemoryResponse | null | undefined
  weakSections: string[]
}): MayaPageContext {
  const healthLine = Object.entries(input.sectionHealth)
    .map(([k, h]) => `${SECTION_TITLES[k] ?? k}: ${h}`)
    .join('; ')

  return {
    page: 'FOUNDATION PAGE',
    dataSource: 'live',
    company: input.companyName || undefined,
    activeView: {
      label: TAB_LABELS[input.activeTab],
      state: buildFoundationHubTabState(input),
    },
    metrics: [
      `Foundation score: ${input.score}%`,
      `Section health: ${healthLine}`,
      `Knowledge sources: ${input.knowledgeItems.length}`,
      ...(input.memoryData?.totalOutputs != null
        ? [`Agent memory outputs: ${input.memoryData.totalOutputs}`]
        : []),
      ...(input.weakSections.length ? [`Needs work: ${input.weakSections.join(', ')}`] : []),
    ],
    affordance: `${MAYA_VOICE_RULE} User manages Foundation intelligence, knowledge uploads, agent memory, and connections. Lead with CURRENTLY VIEWING before page summary.`,
  }
}
