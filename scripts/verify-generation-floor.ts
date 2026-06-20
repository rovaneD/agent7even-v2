/**
 * Verify assertGenerationFloor against live profiles (no browser session needed).
 * Usage: npx tsx --env-file=.env.local scripts/verify-generation-floor.ts
 */
import { createClient } from '@supabase/supabase-js'
import {
  assertGenerationFloor,
  GENERATION_SECTION_FLOOR,
  loadFieldScores,
} from '../lib/foundation/sectionStrength'
import { getSectionScore } from '../lib/foundation/sectionStrength'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// sectionStrength uses createServiceClient from Next — patch env for script context
process.env.NEXT_PUBLIC_SUPABASE_URL = url
process.env.SUPABASE_SERVICE_ROLE_KEY = key

async function main() {
  const supabase = createClient(url, key)

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, company_name, foundation_score, clerk_user_id')
    .not('foundation_complete', 'is', null)
    .order('foundation_score', { ascending: false, nullsFirst: false })
    .limit(5)

  if (error) {
    console.error('profiles error:', error.message)
    process.exit(1)
  }

  console.log('=== generation floor verification ===')
  console.log(`floor threshold: ${GENERATION_SECTION_FLOOR}%`)
  console.log(`profiles sampled: ${profiles?.length ?? 0}\n`)

  if (!profiles?.length) {
    console.log('No profiles found.')
    return
  }

  for (const profile of profiles) {
    const fieldScores = await loadFieldScores(profile.id)
    const fieldCount = Object.keys(fieldScores).length
    const customer = getSectionScore(fieldScores, 'customer')
    const position = getSectionScore(fieldScores, 'position')
    const voice = getSectionScore(fieldScores, 'voice')
    const result = await assertGenerationFloor(profile.id)

    console.log(`--- ${profile.company_name ?? profile.id} (global ${profile.foundation_score ?? '—'}%) ---`)
    console.log(`  field_scores rows: ${fieldCount}`)
    console.log(`  sections: customer=${customer ?? 'null'} position=${position ?? 'null'} voice=${voice ?? 'null'}`)
    if (result.ok) {
      console.log(`  assertGenerationFloor: ALLOWED`, result.scores)
    } else {
      console.log(`  assertGenerationFloor: BLOCKED reason=${result.reason} section=${result.section} score=${result.score}`)
      console.log(`  message: ${result.message}`)
    }
    console.log('')
  }

  // Unauthenticated HTTP shape (middleware, not route handler)
  console.log('=== HTTP without session (curl as documented) ===')
  const res = await fetch('http://localhost:3000/api/foundation/generation-floor', {
    redirect: 'manual',
  })
  console.log(`  status: ${res.status}`)
  const loc = res.headers.get('location')
  if (loc) console.log(`  location: ${loc}`)
  console.log('  note: Clerk middleware redirects to /sign-in — use browser session cookie or this script for gate logic.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
