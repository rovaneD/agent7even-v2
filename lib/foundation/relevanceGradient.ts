import { AGENTS, type AgentId, type FoundationSectionKey } from '@/lib/agents/registry'
import {
  computeSectionScore,
  FOUNDATION_SECTION_KEY_FIELDS,
  type FieldScoreLike,
  type FoundationScoredSectionKey,
} from '@/lib/foundation/sections'

/** Matches Foundation Hub section health bands (FoundationHub.tsx). */
export const RELEVANCE_STRONG_THRESHOLD = 70
export const RELEVANCE_NEEDS_WORK_THRESHOLD = 40

export type SectionRelevanceBand = 'strong' | 'needs_work' | 'thin' | 'unscored'

export type AgentRelevanceEvaluation = {
  agentId: AgentId
  sectionBands: Partial<Record<FoundationSectionKey, SectionRelevanceBand>>
  sectionScores: Partial<Record<FoundationSectionKey, number>>
  limitedSections: FoundationSectionKey[]
}

const SCORED_SECTIONS = new Set<string>(Object.keys(FOUNDATION_SECTION_KEY_FIELDS))

const SECTION_LABELS: Record<FoundationSectionKey, string> = {
  business: 'Your Business',
  customer: 'Your Customer',
  position: 'Your Position',
  voice: 'Your Voice',
  visual: 'Your Look',
  plan: 'Your 30 Days',
  memory: "Maya's Memory",
}

export function getSectionRelevanceBand(score: number | null): SectionRelevanceBand {
  if (score === null) return 'unscored'
  if (score >= RELEVANCE_STRONG_THRESHOLD) return 'strong'
  if (score >= RELEVANCE_NEEDS_WORK_THRESHOLD) return 'needs_work'
  return 'thin'
}

export function evaluateAgentFoundationRelevance(
  agentId: AgentId,
  fieldScores: Record<string, FieldScoreLike>,
): AgentRelevanceEvaluation {
  const agent = AGENTS[agentId]
  const sectionBands: Partial<Record<FoundationSectionKey, SectionRelevanceBand>> = {}
  const sectionScores: Partial<Record<FoundationSectionKey, number>> = {}

  for (const key of agent.foundationSections) {
    if (key === 'memory' || !SCORED_SECTIONS.has(key)) continue
    const score = computeSectionScore(fieldScores, key as FoundationScoredSectionKey)
    if (score != null) sectionScores[key] = score
    sectionBands[key] = getSectionRelevanceBand(score)
  }

  const limitedSections = agent.warnIfThinSections.filter(key => {
    const band = sectionBands[key]
    return band === 'needs_work' || band === 'thin' || band === 'unscored'
  })

  return {
    agentId,
    sectionBands,
    sectionScores,
    limitedSections,
  }
}

/** Prompt advisory for graceful degradation when dependency sections are thin. */
export function formatRelevanceGradientAdvisory(
  evaluation: AgentRelevanceEvaluation,
): string | null {
  if (evaluation.limitedSections.length === 0) return null

  const lines = evaluation.limitedSections.map(key => {
    const label = SECTION_LABELS[key]
    const score = evaluation.sectionScores[key]
    const band = evaluation.sectionBands[key]

    if (band === 'unscored' || score == null) {
      return `- ${label}: not scored yet — stay generic; do not invent brand-specific details for this area.`
    }

    const bandLabel = band === 'thin' ? 'thin' : 'needs work'
    return `- ${label}: ${score}% (${bandLabel}) — prefer safe, broadly applicable output over invented specifics.`
  })

  return `## Foundation strength advisory (this agent run)
Maya is working from limited Foundation in:
${lines.join('\n')}

Stay within what Foundation supports. If output would overclaim specificity, keep it general. Do not blame the user — this is preview-quality output that sharpens as Foundation grows.`
}
