/**
 * Empirical Guardian threshold calibration (foundation_intelligence_vision.md Build #6).
 *
 * Surveys foundation_changelog + foundation_proposals and simulates surface rates
 * at candidate threshold sets. Does not auto-mutate guardianConfig — human reviews output.
 *
 * Usage:
 *   npx --yes tsx --env-file=.env.local scripts/calibrate-guardian-thresholds.ts
 */
import { createClient } from '@supabase/supabase-js'
import type { FoundationChangelogRow } from '../lib/foundation/observer/types'
import {
  buildGuardianCalibrationReport,
  formatGuardianThresholdLabel,
  GUARDIAN_THRESHOLDS,
  type GuardianProposalDecisionRow,
} from '../lib/foundation/guardian/calibrateThresholds'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const sb = createClient(url, key)

  const { data: changelogRows, error: changelogError } = await sb
    .from('foundation_changelog')
    .select('id, profile_id, signal_type, agent_id, content_summary, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (changelogError) {
    if (changelogError.message.includes('foundation_changelog')) {
      console.error('foundation_changelog missing — run 32_foundation_changelog.sql first.')
      process.exit(1)
    }
    throw new Error(changelogError.message)
  }

  const changelogByProfile = new Map<string, FoundationChangelogRow[]>()
  for (const row of changelogRows ?? []) {
    const profileId = row.profile_id as string
    const list = changelogByProfile.get(profileId) ?? []
    list.push({
      id: row.id as string,
      signal_type: row.signal_type as FoundationChangelogRow['signal_type'],
      agent_id: (row.agent_id as string | null) ?? null,
      content_summary: row.content_summary as string,
      created_at: row.created_at as string,
    })
    changelogByProfile.set(profileId, list)
  }

  const { data: proposalRows, error: proposalError } = await sb
    .from('foundation_proposals')
    .select('state, guardian_verdict, user_decision, theme, source_changelog_ids, profile_id, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (proposalError) {
    if (proposalError.message.includes('foundation_proposals')) {
      console.error('foundation_proposals missing — run 33_foundation_proposals.sql first.')
      process.exit(1)
    }
    throw new Error(proposalError.message)
  }

  const proposals = (proposalRows ?? []) as Array<
    GuardianProposalDecisionRow & { profile_id?: string; created_at?: string }
  >

  const report = buildGuardianCalibrationReport({
    changelogByProfile,
    proposals,
  })

  console.log('=== Guardian threshold calibration report ===\n')
  console.log(`Profiles with changelog: ${report.profilesWithChangelog}`)
  console.log(`Changelog rows sampled:   ${report.totalChangelogRows}`)
  console.log(`Formalized candidates:  ${report.formalizedCandidates}`)
  console.log(`Persisted proposals:    ${report.persistedProposals}`)
  console.log(`Surfaced (verdict):     ${report.surfacedProposals}`)
  console.log(
    `User decisions: approved=${report.userDecisions.approved} · rejected=${report.userDecisions.rejected} · deferred=${report.userDecisions.deferred} · pending=${report.userDecisions.pending}`,
  )

  console.log('\n--- Cluster size distribution ---')
  for (const [bucket, count] of Object.entries(report.clusterSizeBuckets).sort()) {
    console.log(`  ${bucket} rows: ${count}`)
  }

  console.log('\n--- Threshold simulations ---')
  for (const sim of report.thresholdSimulations) {
    const current =
      sim.thresholds.minSupportingRows === GUARDIAN_THRESHOLDS.minSupportingRows &&
      sim.thresholds.minSurfaceConsistent === GUARDIAN_THRESHOLDS.minSurfaceConsistent &&
      sim.thresholds.minSurfaceExtending === GUARDIAN_THRESHOLDS.minSurfaceExtending
        ? ' ← current'
        : ''
    console.log(
      `  ${formatGuardianThresholdLabel(sim.thresholds)} → surface ${sim.surfaceCount} · hold ${sim.holdCount} · reject_internal ${sim.rejectInternalCount}${current}`,
    )
  }

  console.log('\n--- Recommendation ---')
  console.log(report.recommendation)
  console.log(
    '\nTo apply changes: edit GUARDIAN_THRESHOLDS in lib/foundation/guardian/guardianConfig.ts after review.',
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
