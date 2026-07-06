/**
 * Verify Foundation proposal theme policy — approved layers + reject cooldown.
 *
 * Usage:
 *   npx --yes tsx --env-file=.env.local scripts/verify-foundation-theme-policy.ts
 *   FOUNDATION_GUARDIAN_PROFILE_ID=<uuid> npx --yes tsx --env-file=.env.local scripts/verify-foundation-theme-policy.ts
 */
import { createClient } from '@supabase/supabase-js'
import { formalizeCandidates } from '../lib/foundation/observer/formalizeCandidates'
import { loadFoundationChangelogRows } from '../lib/foundation/observer/loadChangelogRows'
import {
  loadProposalThemePolicy,
  themeBlockReason,
} from '../lib/foundation/proposals/proposalThemePolicy'
import {
  PROPOSAL_DEFER_COOLDOWN_DAYS,
  PROPOSAL_REJECT_COOLDOWN_DAYS,
} from '../lib/foundation/guardian/guardianConfig'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

async function resolveProfileId(sb: ReturnType<typeof createClient>): Promise<string> {
  const override = process.env.FOUNDATION_GUARDIAN_PROFILE_ID?.trim()
  if (override) return override

  const { data: profiles, error } = await sb
    .from('profiles')
    .select('id, company_name, foundation_score')
    .not('foundation_score', 'is', null)
    .order('foundation_score', { ascending: false, nullsFirst: false })
    .limit(20)

  if (error) throw new Error(error.message)
  if (!profiles?.length) throw new Error('No scored profiles found')

  const agent7even = profiles.find(p => /agent7even/i.test(p.company_name ?? ''))
  return (agent7even ?? profiles[0]).id
}

async function main() {
  const sb = createClient(url!, key!)
  const profileId = await resolveProfileId(sb)

  const { data: profile } = await sb
    .from('profiles')
    .select('company_name')
    .eq('id', profileId)
    .maybeSingle()

  console.log('=== Foundation theme policy ===\n')
  console.log(`Profile: ${profile?.company_name ?? profileId}`)
  console.log(`Reject cooldown: ${PROPOSAL_REJECT_COOLDOWN_DAYS} days`)
  console.log(`Defer cooldown:  ${PROPOSAL_DEFER_COOLDOWN_DAYS} days\n`)

  const policy = await loadProposalThemePolicy(sb, profileId)
  console.log('Approved layer themes:')
  if (policy.approvedThemes.size === 0) console.log('  (none)')
  else for (const theme of policy.approvedThemes) console.log(`  - ${theme}`)

  console.log('Rejected themes in cooldown:')
  if (policy.rejectedThemesInCooldown.size === 0) console.log('  (none)')
  else for (const theme of policy.rejectedThemesInCooldown) console.log(`  - ${theme}`)

  console.log('\nDeferred themes in cooldown:')
  if (policy.deferredThemesInCooldown.size === 0) console.log('  (none)')
  else for (const theme of policy.deferredThemesInCooldown) console.log(`  - ${theme}`)

  const rows = await loadFoundationChangelogRows(profileId, 50)
  const candidates = formalizeCandidates(rows)

  console.log(`\nFormalized candidates: ${candidates.length}\n`)
  let wouldBlock = 0
  for (const candidate of candidates) {
    const block = themeBlockReason(candidate.theme, policy)
    if (block) wouldBlock++
    console.log(
      `${candidate.theme} → ${block ?? 'eligible (new changelog sig still required)'}`,
    )
  }

  console.log(`\nWould block by theme policy: ${wouldBlock}/${candidates.length}`)
  console.log(
    'Note: Guardian batch also skips duplicate source_changelog_ids before theme checks.',
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
