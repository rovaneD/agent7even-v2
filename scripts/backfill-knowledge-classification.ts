/**
 * Backfill source_purpose on foundation_knowledge rows missing classification.
 *
 * Usage:
 *   npx --yes tsx --env-file=.env.local scripts/backfill-knowledge-classification.ts
 *   npx --yes tsx --env-file=.env.local scripts/backfill-knowledge-classification.ts --profile-id=bfa73081-...
 *   npx --yes tsx --env-file=.env.local scripts/backfill-knowledge-classification.ts --dry-run
 */
import { createClient } from '@supabase/supabase-js'
import { classifyKnowledgeSource } from '../lib/foundation/classifyKnowledge'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function parseArgs() {
  const dryRun = process.argv.includes('--dry-run')
  const profileArg = process.argv.find(a => a.startsWith('--profile-id='))
  const profileId = profileArg?.split('=')[1]?.trim() || null
  return { dryRun, profileId }
}

async function main() {
  const { dryRun, profileId } = parseArgs()
  const sb = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )

  let query = sb
    .from('foundation_knowledge')
    .select('id, profile_id, source_type, source_name, raw_content, source_purpose')
    .is('source_purpose', null)
    .order('created_at', { ascending: true })

  if (profileId) query = query.eq('profile_id', profileId)

  const { data: rows, error } = await query
  if (error) throw error

  if (!rows?.length) {
    console.log('No unclassified knowledge rows found.')
    return
  }

  console.log(`Found ${rows.length} row(s) without source_purpose${dryRun ? ' (dry run)' : ''}.`)

  const websiteByProfile = new Map<string, string | null>()
  let updated = 0

  for (const row of rows) {
    const pid = row.profile_id as string
    if (!websiteByProfile.has(pid)) {
      const { data: profile } = await sb
        .from('profiles')
        .select('website_url')
        .eq('id', pid)
        .maybeSingle()
      websiteByProfile.set(pid, (profile?.website_url as string | null) ?? null)
    }

    const classification = await classifyKnowledgeSource(
      (row.raw_content as string | null) ?? '',
      row.source_type as string,
      row.source_name as string,
      websiteByProfile.get(pid) ?? null,
    )

    console.log(
      `- ${row.id.slice(0, 8)}… ${row.source_name}: ${classification.purpose} (${classification.confidence}) — ${classification.reason}`,
    )

    if (dryRun) continue

    const { error: updateError } = await sb
      .from('foundation_knowledge')
      .update({
        source_purpose: classification.purpose,
        purpose_confidence: classification.confidence,
        purpose_reason: classification.reason,
      })
      .eq('id', row.id)

    if (updateError) {
      console.error(`  ✗ update failed: ${updateError.message}`)
      continue
    }
    updated++
  }

  console.log(dryRun ? 'Dry run complete.' : `Updated ${updated}/${rows.length} row(s).`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
