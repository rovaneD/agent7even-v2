import { createClient } from '@supabase/supabase-js'

const email = process.argv[2]
if (!email) {
  console.error('Usage: npx tsx --env-file=.env.local scripts/check-foundation-competitors.ts <email>')
  process.exit(1)
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, company_name, foundation_answers, competitors')
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(error)
    process.exit(1)
  }

  if (!profile) {
    console.error(`No profile found for ${email}`)
    process.exit(1)
  }

  const answers = (profile.foundation_answers ?? {}) as Record<string, unknown>
  console.log(JSON.stringify({
    profileId: profile.id,
    email: profile.email,
    company: profile.company_name,
    foundationAnswersType: Array.isArray(answers.competitors) ? 'array' : typeof answers.competitors,
    foundationAnswersCompetitors: answers.competitors ?? null,
    legacyCompetitorsColumn: profile.competitors ?? null,
  }, null, 2))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
