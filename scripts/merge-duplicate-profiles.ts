/**
 * Merge duplicate profile rows into the canonical billing row.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/merge-duplicate-profiles.ts --email you@company.com --dry-run
 *   npx tsx --env-file=.env.local scripts/merge-duplicate-profiles.ts --email you@company.com --execute
 *   npx tsx --env-file=.env.local scripts/merge-duplicate-profiles.ts --keep <uuid> --orphan <uuid> --execute
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { pickCanonicalProfile } from '../lib/profiles/ensureProfile'

const USER_ID_TABLES = [
  'agent_constraints',
  'agent_outputs',
  'agent_schedules',
  'agent_tasks',
  'brand_answers',
  'brand_documents',
  'brand_kit_assets',
  'brand_kit_colors',
  'brand_kit_fonts',
  'brand_kit_sections',
  'campaigns',
  'creative_asset_folders',
  'creative_assets',
  'credit_balances',
  'credit_ledger',
  'credit_topups',
  'daily_digests',
  'foundation_documents',
  'foundation_field_scores',
  'maya_sessions',
  'orchestration_sessions',
  'project_inquiries',
  'notifications',
  'orders',
  'support_tickets',
  'client_activity_log',
  'admin_notes',
  'zernio_api_usage',
] as const

const PROFILE_ID_TABLES = [
  'foundation_knowledge',
  'foundation_changelog',
  'foundation_proposals',
  'analytics_briefings',
] as const

const PROFILE_COALESCE_FIELDS = [
  'clerk_user_id',
  'full_name',
  'avatar_url',
  'company_name',
  'ga_refresh_token',
  'ga_measurement_id',
  'ga_oauth_email',
  'ga_connected',
  'zernio_profile_id',
  'zernio_profile_ids',
  'zernio_connected_platforms',
  'instagram_handle',
  'meta_ad_account_id',
  'foundation_answers',
  'foundation_complete',
  'foundation_step',
  'foundation_score',
  'site_snapshot',
  'site_snapshot_enabled',
  'site_snapshot_generated_at',
  'site_snapshot_source_url',
] as const

type ProfileRow = Record<string, unknown> & {
  id: string
  email: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: string | null
  created_at: string
}

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  return {
    email: get('--email'),
    keepId: get('--keep'),
    orphanId: get('--orphan'),
    dryRun: args.includes('--dry-run') || !args.includes('--execute'),
  }
}

async function loadGroup(
  supabase: SupabaseClient,
  email?: string,
  keepId?: string,
  orphanId?: string,
): Promise<{ canonical: ProfileRow; orphans: ProfileRow[] }> {
  if (keepId && orphanId) {
    const { data, error } = await supabase.from('profiles').select('*').in('id', [keepId, orphanId])
    if (error || !data || data.length !== 2) {
      throw new Error('Could not load --keep and --orphan profiles')
    }
    const canonical = data.find(p => p.id === keepId) as ProfileRow
    const orphan = data.find(p => p.id === orphanId) as ProfileRow
    return { canonical, orphans: [orphan] }
  }

  if (!email) throw new Error('Pass --email <address> or --keep + --orphan')

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('email', email)
    .neq('status', 'churned')
    .order('created_at', { ascending: true })

  if (error) throw error
  const rows = (data ?? []) as ProfileRow[]
  if (rows.length < 2) {
    throw new Error(`Only ${rows.length} profile(s) for ${email} — nothing to merge`)
  }

  const canonical = pickCanonicalProfile(rows) as ProfileRow
  const orphans = rows.filter(p => p.id !== canonical.id)
  return { canonical, orphans }
}

function buildCoalescePatch(canonical: ProfileRow, orphan: ProfileRow) {
  const patch: Record<string, unknown> = {}
  for (const field of PROFILE_COALESCE_FIELDS) {
    const current = canonical[field]
    const incoming = orphan[field]
    if ((current === null || current === undefined || current === '' || (Array.isArray(current) && current.length === 0))
      && incoming !== null && incoming !== undefined && incoming !== '') {
      patch[field] = incoming
    }
  }
  return patch
}

async function reassignUserId(
  supabase: SupabaseClient,
  table: string,
  orphanId: string,
  canonicalId: string,
  dryRun: boolean,
) {
  const { count, error: countError } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', orphanId)

  if (countError) return
  if (!count) return

  console.log(`  ${table}.user_id: ${count} row(s)`)
  if (dryRun) return

  const { error } = await supabase.from(table).update({ user_id: canonicalId }).eq('user_id', orphanId)
  if (error) throw new Error(`${table}.user_id update failed: ${error.message}`)
}

async function reassignProfileId(
  supabase: SupabaseClient,
  table: string,
  orphanId: string,
  canonicalId: string,
  dryRun: boolean,
) {
  const { count, error: countError } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', orphanId)

  if (countError) return
  if (!count) return

  console.log(`  ${table}.profile_id: ${count} row(s)`)
  if (dryRun) return

  const { error } = await supabase.from(table).update({ profile_id: canonicalId }).eq('profile_id', orphanId)
  if (error) throw new Error(`${table}.profile_id update failed: ${error.message}`)
}

async function mergeCreditBalance(
  supabase: SupabaseClient,
  canonicalId: string,
  orphanId: string,
  dryRun: boolean,
) {
  const [{ data: canonicalBal }, { data: orphanBal }] = await Promise.all([
    supabase.from('credit_balances').select('balance').eq('user_id', canonicalId).maybeSingle(),
    supabase.from('credit_balances').select('balance').eq('user_id', orphanId).maybeSingle(),
  ])

  const orphanAmount = orphanBal?.balance ?? 0
  if (!orphanAmount) return

  const next = (canonicalBal?.balance ?? 0) + orphanAmount
  console.log(`  credit_balances: add ${orphanAmount} → ${next}`)
  if (dryRun) return

  if (canonicalBal) {
    await supabase.from('credit_balances').update({ balance: next }).eq('user_id', canonicalId)
  } else {
    await supabase.from('credit_balances').insert({ user_id: canonicalId, balance: next })
  }
}

async function main() {
  const { email, keepId, orphanId, dryRun } = parseArgs()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { canonical, orphans } = await loadGroup(supabase, email, keepId, orphanId)

  console.log(dryRun ? '\nDRY RUN — no writes\n' : '\nEXECUTING MERGE\n')
  console.log('KEEP', canonical.id, canonical.email, canonical.plan, canonical.stripe_customer_id)

  for (const orphan of orphans) {
    console.log('\nORPHAN', orphan.id, orphan.email, orphan.plan, orphan.stripe_customer_id)

    if (orphan.stripe_customer_id || orphan.stripe_subscription_id) {
      console.warn('  WARNING: orphan has Stripe IDs — verify manually before deleting')
    }

    const patch = buildCoalescePatch(canonical, orphan)
    if (Object.keys(patch).length > 0) {
      console.log('  coalesce onto canonical:', Object.keys(patch).join(', '))
      if (!dryRun) {
        await supabase.from('profiles').update(patch).eq('id', canonical.id)
      }
    }

    for (const table of USER_ID_TABLES) {
      await reassignUserId(supabase, table, orphan.id, canonical.id, dryRun)
    }

    for (const table of PROFILE_ID_TABLES) {
      await reassignProfileId(supabase, table, orphan.id, canonical.id, dryRun)
    }

    await mergeCreditBalance(supabase, canonical.id, orphan.id, dryRun)

    console.log('  team_members.account_id / member_profile_id')
    if (!dryRun) {
      await supabase.from('team_members').update({ account_id: canonical.id }).eq('account_id', orphan.id)
      await supabase.from('team_members').update({ member_profile_id: canonical.id }).eq('member_profile_id', orphan.id)
    }

    console.log('  notifications.sender_id')
    if (!dryRun) {
      await supabase.from('notifications').update({ sender_id: canonical.id }).eq('sender_id', orphan.id)
    }

    console.log('  DELETE orphan profile')
    if (!dryRun) {
      const { error } = await supabase.from('profiles').delete().eq('id', orphan.id)
      if (error) throw new Error(`Delete orphan failed: ${error.message}`)
    }
  }

  console.log(dryRun ? '\nDry run complete. Re-run with --execute to apply.' : '\nMerge complete.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
