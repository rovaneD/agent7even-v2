/**
 * Foundation Guardian v0 checkpoint — list verified proposals for a profile.
 *
 * Usage:
 *   npx --yes tsx --env-file=.env.local scripts/verify-foundation-guardian.ts
 *   FOUNDATION_GUARDIAN_PROFILE_ID=<uuid> npx --yes tsx --env-file=.env.local scripts/verify-foundation-guardian.ts
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const limit = Math.min(
  Math.max(parseInt(process.env.FOUNDATION_GUARDIAN_LIMIT ?? '20', 10) || 20, 1),
  100,
)

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
    .select('company_name, foundation_score')
    .eq('id', profileId)
    .maybeSingle()

  console.log('=== Foundation Guardian checkpoint (v0) ===\n')
  console.log(`Profile: ${profile?.company_name ?? profileId}`)
  console.log(`Foundation score: ${profile?.foundation_score ?? '—'}%`)
  console.log(`Limit: ${limit} proposals\n`)

  const { data: rows, error } = await sb
    .from('foundation_proposals')
    .select(
      'state, guardian_verdict, proposal_title, proposal_body, phase1_excerpt, signal_summary, theme, rationale, source_changelog_ids, created_at',
    )
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (error.message.includes('foundation_proposals')) {
      console.error(
        'Table not found — run 33_foundation_proposals.sql in Supabase first.\n',
        error.message,
      )
      process.exit(1)
    }
    throw new Error(error.message)
  }

  const count = rows?.length ?? 0
  console.log(`Proposals found: ${count}\n`)

  if (count === 0) {
    console.log(
      'No proposals yet. Ensure foundation_changelog has rows, then run:',
      'npx --yes tsx --env-file=.env.local scripts/run-foundation-guardian.ts\n',
    )
    console.log(
      'HUMAN CHECKPOINT — proposals should feel like real business evolution, not noise.',
    )
    return
  }

  const surfaced = (rows ?? []).filter(r => r.guardian_verdict === 'surface').length
  const held = (rows ?? []).filter(r => r.guardian_verdict === 'hold').length
  const internal = (rows ?? []).filter(r => r.guardian_verdict === 'reject_internal').length

  console.log(`Verdicts: surface=${surfaced} · hold=${held} · reject_internal=${internal}\n`)

  for (const [index, row] of (rows ?? []).entries()) {
    const when = new Date(row.created_at as string).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    console.log(`--- ${index + 1}. [${row.state}] ${row.guardian_verdict} · ${when} ---`)
    console.log(`Title: ${row.proposal_title}`)
    console.log(`Theme: ${row.theme ?? '—'}`)
    console.log(`Signal: ${row.signal_summary}`)
    console.log(`Body: ${row.proposal_body}`)
    if (row.phase1_excerpt) console.log(`Phase 1 check: ${row.phase1_excerpt}`)
    if (row.rationale) console.log(`Rationale: ${row.rationale}`)
    const ids = row.source_changelog_ids as string[] | null
    console.log(`Changelog rows: ${ids?.length ?? 0}`)
    console.log('')
  }

  console.log(
    'HUMAN CHECKPOINT — contradicting proposals must never show guardian_verdict=surface.',
    'Tune thresholds in lib/foundation/guardian/guardianConfig.ts after review.',
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
