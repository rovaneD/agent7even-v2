/**
 * List duplicate profiles by email or clerk_user_id.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/list-duplicate-profiles.ts
 *   npx tsx --env-file=.env.local scripts/list-duplicate-profiles.ts user@example.com
 */
import { createClient } from '@supabase/supabase-js'
import { pickCanonicalProfile } from '../lib/profiles/ensureProfile'

const emailFilter = process.argv[2]?.trim()

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  let query = supabase
    .from('profiles')
    .select(
      'id, email, company_name, plan, status, role, clerk_user_id, stripe_customer_id, stripe_subscription_id, ga_measurement_id, zernio_profile_id, created_at',
    )
    .neq('status', 'churned')
    .order('created_at', { ascending: true })

  if (emailFilter) {
    query = query.ilike('email', emailFilter)
  }

  const { data, error } = await query
  if (error) {
    console.error(error)
    process.exit(1)
  }

  const rows = data ?? []
  const byEmail = new Map<string, typeof rows>()
  const byClerk = new Map<string, typeof rows>()

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase()
    if (email) {
      const list = byEmail.get(email) ?? []
      list.push(row)
      byEmail.set(email, list)
    }
    if (row.clerk_user_id) {
      const list = byClerk.get(row.clerk_user_id) ?? []
      list.push(row)
      byClerk.set(row.clerk_user_id, list)
    }
  }

  console.log(`Total profiles scanned: ${rows.length}`)

  let duplicateGroups = 0
  for (const [email, group] of byEmail) {
    if (group.length < 2) continue
    duplicateGroups++
    const canonical = pickCanonicalProfile(group as Parameters<typeof pickCanonicalProfile>[0])
    console.log('\n=== duplicate email ===', email)
    for (const p of group) {
      const tag = p.id === canonical.id ? 'KEEP' : 'MERGE→DELETE'
      console.log(
        JSON.stringify(
          {
            tag,
            id: p.id,
            plan: p.plan,
            clerk_user_id: p.clerk_user_id,
            stripe: Boolean(p.stripe_customer_id),
            ga: p.ga_measurement_id,
            zernio: p.zernio_profile_id,
            created: p.created_at?.slice(0, 19),
          },
          null,
          2,
        ),
      )
    }
  }

  for (const [clerkId, group] of byClerk) {
    if (group.length < 2) continue
    const emails = new Set(group.map(p => p.email?.toLowerCase()).filter(Boolean))
    if (emails.size <= 1 && duplicateGroups > 0) continue
    duplicateGroups++
    const canonical = pickCanonicalProfile(group as Parameters<typeof pickCanonicalProfile>[0])
    console.log('\n=== duplicate clerk_user_id ===', clerkId)
    for (const p of group) {
      const tag = p.id === canonical.id ? 'KEEP' : 'MERGE→DELETE'
      console.log(
        JSON.stringify(
          {
            tag,
            id: p.id,
            email: p.email,
            plan: p.plan,
            stripe: Boolean(p.stripe_customer_id),
            created: p.created_at?.slice(0, 19),
          },
          null,
          2,
        ),
      )
    }
  }

  if (duplicateGroups === 0) {
    console.log('\nNo duplicate groups found.')
  } else {
    console.log(`\n${duplicateGroups} duplicate group(s). Merge with:`)
    console.log('  npx tsx --env-file=.env.local scripts/merge-duplicate-profiles.ts --email <email> --dry-run')
    console.log('  npx tsx --env-file=.env.local scripts/merge-duplicate-profiles.ts --email <email> --execute')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
