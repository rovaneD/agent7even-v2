export type KnowledgeSourcePurpose =
  | 'own_business'
  | 'competitor'
  | 'market_reference'
  | 'customer_voice'
  | 'unknown'

export type KnowledgePurposeConfidence = 'high' | 'medium' | 'low'

export type KnowledgeClassification = {
  purpose: KnowledgeSourcePurpose
  confidence: KnowledgePurposeConfidence
  reason: string
}

export const KNOWLEDGE_SOURCE_PURPOSES: KnowledgeSourcePurpose[] = [
  'own_business',
  'competitor',
  'market_reference',
  'customer_voice',
  'unknown',
]

export const KNOWLEDGE_PURPOSE_LABELS: Record<KnowledgeSourcePurpose, string> = {
  own_business: 'Your business',
  competitor: 'Competitor reference',
  market_reference: 'Market / industry',
  customer_voice: 'Customer voice',
  unknown: 'Unclassified',
}

export const KNOWLEDGE_PURPOSE_AGENT_NOTE: Record<KnowledgeSourcePurpose, string> = {
  own_business: 'Reference about the client’s own business — may enrich output.',
  competitor: 'COMPETITOR REFERENCE ONLY — never state as the client’s identity, voice, or positioning.',
  market_reference: 'Industry/market context — not the client’s stated identity.',
  customer_voice: 'Customer/testimonial language — illustrative only, not brand voice definition.',
  unknown: 'Unclassified reference — treat as enrichment only, not Phase 1 identity.',
}

export function normalizeKnowledgePurpose(value: unknown): KnowledgeSourcePurpose | null {
  if (typeof value !== 'string') return null
  return KNOWLEDGE_SOURCE_PURPOSES.includes(value as KnowledgeSourcePurpose)
    ? (value as KnowledgeSourcePurpose)
    : null
}

export function isCompetitorPurpose(purpose: string | null | undefined): boolean {
  return purpose === 'competitor'
}

export const KNOWLEDGE_PURPOSE_BADGE_CLASS: Record<KnowledgeSourcePurpose, string> = {
  own_business: 'text-[#166534] bg-[#DCFCE7] border-[#BBF7D0]',
  competitor: 'text-[#991B1B] bg-[#FEF2F2] border-[#FECACA]',
  market_reference: 'text-[#92400E] bg-[#FFFBEB] border-[#FDE68A]',
  customer_voice: 'text-[#1E40AF] bg-[#EFF6FF] border-[#BFDBFE]',
  unknown: 'text-text-soft bg-surface-muted border-gray-200',
}
