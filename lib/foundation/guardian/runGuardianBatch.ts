import { generateText } from 'ai'
import { openrouter } from '@/lib/ai/client'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveWorkspaceProfileId } from '@/lib/profiles/workspaceProfile'
import { formalizeCandidates } from '@/lib/foundation/observer/formalizeCandidates'
import { loadFoundationChangelogRows } from '@/lib/foundation/observer/loadChangelogRows'
import type { GuardianBatchResult } from '@/lib/foundation/observer/types'
import { applyGuardianVerdict, GUARDIAN_MODEL } from '@/lib/foundation/guardian/guardianConfig'
import {
  buildGuardianSystemPrompt,
  buildGuardianUserMessage,
  parseGuardianEvaluation,
} from '@/lib/foundation/guardian/evaluateCandidate'
import { loadPhase1Bundle } from '@/lib/foundation/guardian/loadPhase1Bundle'
import {
  loadProposalThemePolicy,
  themeBlockReason,
} from '@/lib/foundation/proposals/proposalThemePolicy'

export type RunGuardianBatchOptions = {
  actorProfileId: string
  dryRun?: boolean
  skipExisting?: boolean
  changelogLimit?: number
}

function changelogIdSignature(ids: string[]): string {
  return [...ids].sort().join(',')
}

async function loadExistingSignatures(profileId: string): Promise<Set<string>> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('foundation_proposals')
    .select('source_changelog_ids')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(100)

  const sigs = new Set<string>()
  for (const row of data ?? []) {
    const ids = row.source_changelog_ids as string[] | null
    if (ids?.length) sigs.add(changelogIdSignature(ids))
  }
  return sigs
}

export async function runGuardianBatch(
  opts: RunGuardianBatchOptions,
): Promise<GuardianBatchResult> {
  const supabase = createServiceClient()
  const profileId = await resolveWorkspaceProfileId(supabase, opts.actorProfileId)
  const dryRun = opts.dryRun ?? false
  const skipExisting = opts.skipExisting ?? true

  const [rows, phase1Bundle, existingSigs, themePolicy] = await Promise.all([
    loadFoundationChangelogRows(profileId, opts.changelogLimit ?? 50),
    loadPhase1Bundle(profileId),
    skipExisting ? loadExistingSignatures(profileId) : Promise.resolve(new Set<string>()),
    loadProposalThemePolicy(supabase, profileId),
  ])

  const candidates = formalizeCandidates(rows)
  const system = buildGuardianSystemPrompt(phase1Bundle)

  let proposalsPersisted = 0
  let skippedDuplicate = 0
  let skippedThemeBlocked = 0

  for (const candidate of candidates) {
    const sig = changelogIdSignature(candidate.changelog_ids)
    if (existingSigs.has(sig)) {
      skippedDuplicate++
      continue
    }

    if (themeBlockReason(candidate.theme, themePolicy)) {
      skippedThemeBlocked++
      continue
    }

    const { text } = await generateText({
      model: openrouter(GUARDIAN_MODEL),
      system,
      messages: [{ role: 'user', content: buildGuardianUserMessage(candidate) }],
      maxOutputTokens: 800,
    })

    let evaluation
    try {
      evaluation = parseGuardianEvaluation(text)
    } catch (err) {
      console.error('[foundation-guardian] parse failed:', err, text.slice(0, 300))
      continue
    }

    const verdict = applyGuardianVerdict(
      evaluation.state,
      candidate.changelog_ids.length,
    )

    if (dryRun) {
      console.log('[foundation-guardian dry-run]', {
        theme: candidate.theme,
        state: evaluation.state,
        verdict,
        title: evaluation.proposal_title,
      })
      proposalsPersisted++
      existingSigs.add(sig)
      continue
    }

    const { error } = await supabase.from('foundation_proposals').insert({
      profile_id: profileId,
      state: evaluation.state,
      guardian_verdict: verdict,
      proposal_title: evaluation.proposal_title,
      proposal_body: evaluation.proposal_body,
      phase1_excerpt: evaluation.phase1_excerpt || null,
      signal_summary: candidate.statement,
      source_changelog_ids: candidate.changelog_ids,
      theme: candidate.theme,
      rationale: evaluation.rationale || null,
    })

    if (error) {
      if (error.message.includes('foundation_proposals')) {
        throw new Error(
          'foundation_proposals table missing — run 33_foundation_proposals.sql in Supabase first.',
        )
      }
      console.error('[foundation-guardian] insert failed:', error.message)
      continue
    }

    proposalsPersisted++
    existingSigs.add(sig)
  }

  return {
    profileId,
    candidatesFormalized: candidates.length,
    proposalsPersisted,
    skippedDuplicate,
    skippedThemeBlocked,
    dryRun,
  }
}
