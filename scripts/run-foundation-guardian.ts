/**
 * Run Foundation Guardian batch — formalize changelog clusters and verify vs Phase 1.
 *
 * Usage:
 *   npx --yes tsx --env-file=.env.local scripts/run-foundation-guardian.ts
 *   FOUNDATION_GUARDIAN_PROFILE_ID=<uuid> npx --yes tsx --env-file=.env.local scripts/run-foundation-guardian.ts
 *   FOUNDATION_GUARDIAN_DRY_RUN=1 npx --yes tsx --env-file=.env.local scripts/run-foundation-guardian.ts
 */
import { createClient } from '@supabase/supabase-js'
import { runGuardianBatch } from '../lib/foundation/guardian/runGuardianBatch'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

if (!process.env.OPENROUTER_API_KEY) {
  console.error('Missing OPENROUTER_API_KEY')
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
  const dryRun = process.env.FOUNDATION_GUARDIAN_DRY_RUN === '1'

  const { data: profile } = await sb
    .from('profiles')
    .select('company_name')
    .eq('id', profileId)
    .maybeSingle()

  console.log('=== Foundation Guardian batch (v0) ===\n')
  console.log(`Profile: ${profile?.company_name ?? profileId}`)
  console.log(`Dry run: ${dryRun ? 'yes' : 'no'}\n`)

  const result = await runGuardianBatch({
    actorProfileId: profileId,
    dryRun,
    skipExisting: true,
  })

  console.log('Candidates formalized:', result.candidatesFormalized)
  console.log('Proposals persisted:  ', result.proposalsPersisted)
  console.log('Skipped (duplicate):  ', result.skippedDuplicate)
  console.log('\nNext: npx --yes tsx --env-file=.env.local scripts/verify-foundation-guardian.ts')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
