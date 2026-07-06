import type { GuardianState } from '@/lib/foundation/observer/types'
import { formalizeCandidates } from '@/lib/foundation/observer/formalizeCandidates'
import type { FoundationChangelogRow } from '@/lib/foundation/observer/types'
import type { GuardianVerdict } from '@/lib/foundation/observer/types'
import {
  applyGuardianVerdict,
  GUARDIAN_THRESHOLDS,
  type GuardianThresholdConfig,
} from '@/lib/foundation/guardian/guardianConfig'

export type GuardianProposalDecisionRow = {
  state: GuardianState
  guardian_verdict: GuardianVerdict
  user_decision: string | null
  theme: string | null
  source_changelog_ids: string[] | null
}

export type GuardianThresholdSimulation = {
  thresholds: GuardianThresholdConfig
  surfaceCount: number
  rejectInternalCount: number
  holdCount: number
}

export type GuardianCalibrationReport = {
  profilesWithChangelog: number
  totalChangelogRows: number
  formalizedCandidates: number
  persistedProposals: number
  surfacedProposals: number
  userDecisions: {
    approved: number
    rejected: number
    deferred: number
    pending: number
  }
  clusterSizeBuckets: Record<string, number>
  thresholdSimulations: GuardianThresholdSimulation[]
  recommendation: string
}

const CANDIDATE_THRESHOLD_SETS: GuardianThresholdConfig[] = [
  { minSupportingRows: 2, minSurfaceConsistent: 2, minSurfaceExtending: 3 },
  { minSupportingRows: 3, minSurfaceConsistent: 3, minSurfaceExtending: 4 },
  { minSupportingRows: 4, minSurfaceConsistent: 4, minSurfaceExtending: 5 },
  { minSupportingRows: 3, minSurfaceConsistent: 4, minSurfaceExtending: 5 },
]

function bucketClusterSize(count: number): string {
  if (count <= 2) return '1-2'
  if (count <= 4) return '3-4'
  if (count <= 6) return '5-6'
  return '7+'
}

function simulateThresholds(
  candidates: Array<{ state: GuardianState; supportingCount: number }>,
  thresholds: GuardianThresholdConfig,
): GuardianThresholdSimulation {
  let surfaceCount = 0
  let rejectInternalCount = 0
  let holdCount = 0

  for (const candidate of candidates) {
    const verdict = applyGuardianVerdict(
      candidate.state,
      candidate.supportingCount,
      thresholds,
    )
    if (verdict === 'surface') surfaceCount++
    else if (verdict === 'hold') holdCount++
    else rejectInternalCount++
  }

  return { thresholds, surfaceCount, rejectInternalCount, holdCount }
}

function buildRecommendation(report: Omit<GuardianCalibrationReport, 'recommendation'>): string {
  const { userDecisions, surfacedProposals, thresholdSimulations } = report
  const decided = userDecisions.approved + userDecisions.rejected + userDecisions.deferred
  const approveRate =
    decided > 0 ? Math.round((userDecisions.approved / decided) * 100) : null

  const current = thresholdSimulations.find(
    sim =>
      sim.thresholds.minSupportingRows === GUARDIAN_THRESHOLDS.minSupportingRows &&
      sim.thresholds.minSurfaceConsistent === GUARDIAN_THRESHOLDS.minSurfaceConsistent &&
      sim.thresholds.minSurfaceExtending === GUARDIAN_THRESHOLDS.minSurfaceExtending,
  )

  const parts: string[] = []

  if (surfacedProposals === 0) {
    parts.push(
      'Insufficient surfaced proposal history — keep current thresholds until more organic changelog clusters accumulate.',
    )
  } else if (approveRate !== null && approveRate >= 80 && userDecisions.rejected === 0) {
    parts.push(
      `Surfaced proposals show ${approveRate}% approve rate (${userDecisions.approved}/${decided} decided) — current thresholds are appropriately conservative.`,
    )
  } else if (userDecisions.rejected > userDecisions.approved) {
    parts.push(
      'Dismiss rate exceeds approve rate on surfaced proposals — consider raising minSurfaceExtending or minSupportingRows.',
    )
  } else {
    parts.push(
      'Mixed proposal decisions — hold thresholds steady and re-run after more user decisions.',
    )
  }

  if (current) {
    parts.push(
      `At current config (${GUARDIAN_THRESHOLDS.minSupportingRows}/${GUARDIAN_THRESHOLDS.minSurfaceConsistent}/${GUARDIAN_THRESHOLDS.minSurfaceExtending}): ${current.surfaceCount} simulated surfaces, ${current.rejectInternalCount} internal rejects.`,
    )
  }

  parts.push('Contradicting proposals remain on hold — vision drift filter (6+ signals) is not wired yet.')

  return parts.join(' ')
}

/** Build calibration report from changelog rows + persisted proposals. */
export function buildGuardianCalibrationReport(input: {
  changelogByProfile: Map<string, FoundationChangelogRow[]>
  proposals: GuardianProposalDecisionRow[]
}): GuardianCalibrationReport {
  const clusterSizeBuckets: Record<string, number> = {}
  const evaluationCandidates: Array<{ state: GuardianState; supportingCount: number }> = []

  for (const rows of input.changelogByProfile.values()) {
    const candidates = formalizeCandidates(rows)
    for (const candidate of candidates) {
      const size = candidate.changelog_ids.length
      const bucket = bucketClusterSize(size)
      clusterSizeBuckets[bucket] = (clusterSizeBuckets[bucket] ?? 0) + 1
    }
  }

  for (const proposal of input.proposals) {
    const count = proposal.source_changelog_ids?.length ?? 0
    if (count > 0) {
      const bucket = bucketClusterSize(count)
      clusterSizeBuckets[bucket] = (clusterSizeBuckets[bucket] ?? 0) + 1
    }
    evaluationCandidates.push({
      state: proposal.state,
      supportingCount: Math.max(count, 1),
    })
  }

  if (evaluationCandidates.length === 0) {
    for (const rows of input.changelogByProfile.values()) {
      for (const candidate of formalizeCandidates(rows)) {
        evaluationCandidates.push({
          state: 'extending',
          supportingCount: candidate.changelog_ids.length,
        })
      }
    }
  }

  const userDecisions = {
    approved: 0,
    rejected: 0,
    deferred: 0,
    pending: 0,
  }

  let surfacedProposals = 0
  for (const proposal of input.proposals) {
    if (proposal.guardian_verdict === 'surface') surfacedProposals++
    const decision = proposal.user_decision ?? 'pending'
    if (decision === 'approved') userDecisions.approved++
    else if (decision === 'rejected') userDecisions.rejected++
    else if (decision === 'deferred') userDecisions.deferred++
    else userDecisions.pending++
  }

  let totalChangelogRows = 0
  for (const rows of input.changelogByProfile.values()) {
    totalChangelogRows += rows.length
  }

  const thresholdSimulations = CANDIDATE_THRESHOLD_SETS.map(thresholds =>
    simulateThresholds(evaluationCandidates, thresholds),
  )

  const base = {
    profilesWithChangelog: input.changelogByProfile.size,
    totalChangelogRows,
    formalizedCandidates: [...input.changelogByProfile.values()].reduce(
      (sum, rows) => sum + formalizeCandidates(rows).length,
      0,
    ),
    persistedProposals: input.proposals.length,
    surfacedProposals,
    userDecisions,
    clusterSizeBuckets,
    thresholdSimulations,
  }

  return {
    ...base,
    recommendation: buildRecommendation(base),
  }
}

export function formatGuardianThresholdLabel(thresholds: GuardianThresholdConfig): string {
  return `min=${thresholds.minSupportingRows} · consistent≥${thresholds.minSurfaceConsistent} · extending≥${thresholds.minSurfaceExtending}`
}

export { GUARDIAN_THRESHOLDS }
