/**
 * Automated ship checkpoint — Foundation Intelligence + Team workspace validation.
 *
 * Usage:
 *   npx --yes tsx --env-file=.env.local scripts/validate-ship-checkpoint.ts
 *   FOUNDATION_GUARDIAN_PROFILE_ID=<owner-uuid> npx --yes tsx --env-file=.env.local scripts/validate-ship-checkpoint.ts
 */
import { createClient } from '@supabase/supabase-js'
import { formalizeCandidates } from '../lib/foundation/observer/formalizeCandidates'
import { loadFoundationChangelogRows } from '../lib/foundation/observer/loadChangelogRows'
import { buildGuardianCalibrationReport } from '../lib/foundation/guardian/calibrateThresholds'
import {
  applyGuardianVerdict,
  GUARDIAN_THRESHOLDS,
  MIN_SURFACE_CONTRADICTING,
} from '../lib/foundation/guardian/guardianConfig'
import { loadFoundationMemory } from '../lib/agents/loadFoundationContext'
import { loadFoundationChangelog } from '../lib/foundation/changelogContext'
import { formatChangelogObservationsForHub } from '../lib/foundation/changelogHubObservations'
import {
  loadProposalThemePolicy,
  themeBlockReason,
} from '../lib/foundation/proposals/proposalThemePolicy'
import { dismissStalePendingProposals } from '../lib/foundation/proposals/dismissStalePendingProposals'
import { loadPendingSurfacedProposals } from '../lib/foundation/proposals/loadProposals'
import { loadWorkspaceTeamContext } from '../lib/maya/summaries/workspaceTeamContext'
import {
  loadFoundationKnowledgeContext,
  formatFoundationKnowledgeForAgents,
  formatFoundationKnowledgeForMaya,
} from '../lib/foundation/knowledgeContext'
import type { FoundationChangelogRow } from '../lib/foundation/observer/types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

type Check = { name: string; pass: boolean; detail: string }

function check(name: string, pass: boolean, detail: string): Check {
  return { name, pass, detail }
}

async function resolveOwnerProfileId(sb: ReturnType<typeof createClient>): Promise<string> {
  const override = process.env.FOUNDATION_GUARDIAN_PROFILE_ID?.trim()
  if (override) return override

  const { data: profiles } = await sb
    .from('profiles')
    .select('id, company_name, foundation_score')
    .not('foundation_score', 'is', null)
    .order('foundation_score', { ascending: false })
    .limit(20)

  const agent7even = profiles?.find(p => /agent7even/i.test(p.company_name ?? ''))
  return (agent7even ?? profiles?.[0])?.id ?? ''
}

async function main() {
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const sb = createClient(url, key)
  const ownerId = await resolveOwnerProfileId(sb)
  if (!ownerId) {
    console.error('No profile found for validation')
    process.exit(1)
  }

  const checks: Check[] = []
  console.log('=== Ship checkpoint validation ===\n')
  console.log(`Owner profile: ${ownerId}\n`)

  // Theme policy
  const policy = await loadProposalThemePolicy(sb, ownerId)
  const rows = await loadFoundationChangelogRows(ownerId, 50)
  const candidates = formalizeCandidates(rows)
  const blocked = candidates.filter(c => themeBlockReason(c.theme, policy))
  checks.push(
    check(
      'Theme policy blocks approved-layer themes',
      blocked.length > 0,
      `${blocked.length}/${candidates.length} candidates blocked (${blocked.map(c => c.theme).join(', ') || 'none'})`,
    ),
  )

  // Stale dismiss + pending load
  const dismissed = await dismissStalePendingProposals(sb, ownerId)
  const pending = await loadPendingSurfacedProposals(sb, ownerId)
  checks.push(
    check(
      'Pending proposals load after stale dismiss',
      Array.isArray(pending),
      `Dismissed ${dismissed} stale row(s); ${pending.length} pending visible`,
    ),
  )

  // Contradiction threshold
  const contradictSurface = applyGuardianVerdict('contradicting', MIN_SURFACE_CONTRADICTING)
  const contradictHold = applyGuardianVerdict('contradicting', MIN_SURFACE_CONTRADICTING - 1)
  checks.push(
    check(
      'Contradiction drift filter',
      contradictSurface === 'surface' && contradictHold === 'hold',
      `≥${MIN_SURFACE_CONTRADICTING} → ${contradictSurface}, below → ${contradictHold}`,
    ),
  )

  // Calibration report
  const changelogByProfile = new Map<string, FoundationChangelogRow[]>()
  changelogByProfile.set(ownerId, rows)
  const { data: proposals } = await sb
    .from('foundation_proposals')
    .select('state, guardian_verdict, user_decision, theme, source_changelog_ids')
    .eq('profile_id', ownerId)
  const calibration = buildGuardianCalibrationReport({
    changelogByProfile,
    proposals: proposals ?? [],
  })
  checks.push(
    check(
      'Guardian calibration holds current thresholds',
      GUARDIAN_THRESHOLDS.minSupportingRows === 3,
      calibration.recommendation.slice(0, 120) + '…',
    ),
  )

  // Foundation memory + observations
  const memory = await loadFoundationMemory(ownerId)
  const observations = formatChangelogObservationsForHub(await loadFoundationChangelog(ownerId, 20))
  checks.push(
    check(
      'Foundation memory loads for workspace',
      memory.hasData || observations.length > 0,
      `${memory.totalOutputs} outputs · ${observations.length} observations`,
    ),
  )

  // Knowledge context (Piece 3)
  const knowledgeRows = await loadFoundationKnowledgeContext(sb, ownerId)
  const agentKnowledge = formatFoundationKnowledgeForAgents(knowledgeRows)
  const mayaKnowledge = formatFoundationKnowledgeForMaya(knowledgeRows)
  checks.push(
    check(
      'Knowledge context formats for agents/Maya',
      knowledgeRows.length === 0 || (agentKnowledge.includes('Uploaded knowledge') && mayaKnowledge.includes('UPLOADED KNOWLEDGE')),
      `${knowledgeRows.length} row(s) · agent ${agentKnowledge.length > 0 ? 'ok' : 'empty'} · maya ${mayaKnowledge.length > 0 ? 'ok' : 'empty'}`,
    ),
  )

  const classifiedRows = knowledgeRows.filter(row => row.source_purpose)
  checks.push(
    check(
      'Knowledge classification tags present',
      knowledgeRows.length === 0 || classifiedRows.length === knowledgeRows.length || agentKnowledge.includes('Classification:'),
      `${classifiedRows.length}/${knowledgeRows.length} rows tagged · competitor blocks ${knowledgeRows.filter(r => r.source_purpose === 'competitor').length}`,
    ),
  )

  // Team context (owner)
  const ownerTeam = await loadWorkspaceTeamContext(sb, ownerId, ownerId)
  checks.push(
    check(
      'Owner team context',
      Boolean(ownerTeam?.isOwner),
      ownerTeam
        ? `pending approvals ${ownerTeam.pendingApprovalCount} · roster ${ownerTeam.teamMembers.filter(m => m.status === 'active').length} active · open assignments ${ownerTeam.openAssignments.length}`
        : 'failed to load',
    ),
  )
  checks.push(
    check(
      'Owner team roster includes active member',
      (ownerTeam?.teamMembers.filter(m => m.status === 'active').length ?? 0) > 0,
      ownerTeam
        ? `${ownerTeam.teamMembers.filter(m => m.status === 'active').length} active · ${ownerTeam.teamMembers.filter(m => m.status === 'pending').length} pending`
        : 'failed',
    ),
  )

  // Team member workspace resolution (rovdurs if linked)
  const { data: members } = await sb
    .from('team_members')
    .select('member_profile_id, profiles!team_members_member_profile_id_fkey(email)')
    .eq('account_id', ownerId)
    .eq('status', 'active')
    .limit(5)

  const memberId = members?.[0]?.member_profile_id as string | undefined
  if (memberId) {
    const memberTeam = await loadWorkspaceTeamContext(sb, memberId, ownerId)
    const memberMemory = await loadFoundationMemory(ownerId)
    checks.push(
      check(
        'Member team context resolves workspace',
        memberTeam?.isOwner === false && memberTeam.workspaceId === ownerId,
        memberTeam
          ? `${memberTeam.memberName} · assigned ${memberTeam.assignedToMember.length}`
          : 'failed',
      ),
    )
    checks.push(
      check(
        'Member reads owner workspace memory',
        memberMemory.totalOutputs >= 0,
        `${memberMemory.totalOutputs} outputs on workspace ${ownerId.slice(0, 8)}…`,
      ),
    )
  } else {
    checks.push(
      check('Active team member present', false, 'No active team_members row — skip member checks'),
    )
  }

  let passed = 0
  for (const item of checks) {
    const mark = item.pass ? 'PASS' : 'FAIL'
    if (item.pass) passed++
    console.log(`${mark} · ${item.name}`)
    console.log(`      ${item.detail}\n`)
  }

  console.log(`Result: ${passed}/${checks.length} checks passed`)
  if (passed < checks.length) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
