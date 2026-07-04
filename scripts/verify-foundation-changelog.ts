/**
 * Foundation Observer v0.5 checkpoint — read recent changelog rows for a profile.
 *
 * Usage:
 *   npx --yes tsx --env-file=.env.local scripts/verify-foundation-changelog.ts
 *   FOUNDATION_CHANGELOG_PROFILE_ID=<uuid> npx --yes tsx --env-file=.env.local scripts/verify-foundation-changelog.ts
 *   FOUNDATION_CHANGELOG_LIMIT=30 npx --yes tsx --env-file=.env.local scripts/verify-foundation-changelog.ts
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const limit = Math.min(
  Math.max(parseInt(process.env.FOUNDATION_CHANGELOG_LIMIT ?? '20', 10) || 20, 1),
  100,
)

async function resolveProfileId(sb: ReturnType<typeof createClient>): Promise<string> {
  const override = process.env.FOUNDATION_CHANGELOG_PROFILE_ID?.trim()
  if (override) return override

  const { data: profiles, error } = await sb
    .from('profiles')
    .select('id, company_name, foundation_score, created_at')
    .not('foundation_score', 'is', null)
    .order('foundation_score', { ascending: false, nullsFirst: false })
    .limit(20)

  if (error) throw new Error(error.message)
  if (!profiles?.length) throw new Error('No scored profiles found')

  const agent7evenRows = profiles.filter(p => /agent7even/i.test(p.company_name ?? ''))
  const candidates = agent7evenRows.length ? agent7evenRows : profiles

  for (const row of candidates) {
    const { count } = await sb
      .from('agent_outputs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', row.id)
      .eq('status', 'pending_approval')
    if (count && count > 0) return row.id
  }

  const agent7even = candidates.find(p => /agent7even/i.test(p.company_name ?? ''))
  return (agent7even ?? candidates[0]).id
}

async function main() {
  const sb = createClient(url!, key!)
  const profileId = await resolveProfileId(sb)

  const { data: profile } = await sb
    .from('profiles')
    .select('company_name, foundation_score')
    .eq('id', profileId)
    .maybeSingle()

  console.log('=== Foundation Observer changelog checkpoint (v0.5) ===\n')
  console.log(`Profile: ${profile?.company_name ?? profileId}`)
  console.log(`Foundation score: ${profile?.foundation_score ?? '—'}%`)
  console.log(`Limit: ${limit} rows\n`)

  const { data: rows, error } = await sb
    .from('foundation_changelog')
    .select('signal_type, agent_id, source_task_id, content_summary, raw_context, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (error.message.includes('foundation_changelog')) {
      console.error(
        'Table not found — run 32_foundation_changelog.sql in Supabase first.\n',
        error.message,
      )
      process.exit(1)
    }
    throw new Error(error.message)
  }

  const count = rows?.length ?? 0
  console.log(`Rows found: ${count}\n`)

  if (count === 0) {
    console.log(
      'No changelog rows yet. Approve, reject, or edit-then-approve something in the',
      'approval queue, then re-run this script.\n',
    )
    console.log(
      'HUMAN CHECKPOINT — after activity: read each content_summary. Do they read like',
      'real signal about the business, or like noise / raw diffs?',
    )
    return
  }

  for (const [index, row] of (rows ?? []).entries()) {
    const when = new Date(row.created_at as string).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    console.log(`--- ${index + 1}. [${row.signal_type}] ${when} ---`)
    console.log(`Agent: ${row.agent_id ?? '—'}`)
    console.log(`Task:  ${row.source_task_id ?? '—'}`)
    console.log(`Summary: ${row.content_summary}`)
    if (row.raw_context && typeof row.raw_context === 'object') {
      const ctx = row.raw_context as Record<string, unknown>
      const keys = Object.keys(ctx)
      if (keys.length > 0) {
        console.log(`Context keys: ${keys.join(', ')}`)
      }
    }
    console.log('')
  }

  console.log(
    'HUMAN CHECKPOINT — read the summaries above. Do they read like real signal about',
    'the business, or like noise / raw diffs? Fix summarization in',
    'lib/foundation/changelogSummarize.ts before building Guardian on top.',
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
