export type FoundationChangelogRow = {
  id: string
  signal_type: 'approved' | 'rejected' | 'edited'
  agent_id: string | null
  content_summary: string
  created_at: string
}

/** Observer → Guardian wire format */
export type ObserverCandidate = {
  theme: string
  statement: string
  supporting_summaries: string[]
  suggested_layer_hint: string
  changelog_ids: string[]
}

export type GuardianState = 'consistent' | 'extending' | 'contradicting'
export type GuardianVerdict = 'surface' | 'hold' | 'reject_internal'

export type GuardianEvaluation = {
  state: GuardianState
  proposal_title: string
  proposal_body: string
  phase1_excerpt: string
  rationale: string
}

export type GuardianBatchResult = {
  profileId: string
  candidatesFormalized: number
  proposalsPersisted: number
  skippedDuplicate: number
  dryRun: boolean
}
