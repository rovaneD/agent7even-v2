import type { GuardianState } from '@/lib/foundation/observer/types'

export type FoundationProposalDecision = 'pending' | 'approved' | 'rejected' | 'deferred'

export type SurfacedFoundationProposal = {
  id: string
  state: GuardianState
  proposalTitle: string
  proposalBody: string
  phase1Excerpt: string | null
  signalSummary: string
  theme: string | null
  rationale: string | null
  createdAt: string
  userDecision: FoundationProposalDecision
}

export const PROPOSAL_STATE_LABELS: Record<GuardianState, string> = {
  consistent: 'Aligns with your Foundation',
  extending: 'Extends your Foundation',
  contradicting: 'Needs your review',
}
