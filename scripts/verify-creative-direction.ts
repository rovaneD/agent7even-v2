/**
 * Step 2 checkpoint — translate Foundation to CreativeDirection in isolation.
 *
 * Usage:
 *   npx --yes tsx --env-file=.env.local scripts/verify-creative-direction.ts
 *   CREATIVE_DIRECTION_PROFILE_ID=<uuid> npx --yes tsx --env-file=.env.local scripts/verify-creative-direction.ts
 *   DEBUG_CREATIVE_DIRECTION_INPUT=1 npx --yes tsx --env-file=.env.local scripts/verify-creative-direction.ts
 */
import { createClient } from '@supabase/supabase-js'
import { translateFoundationToCreativeDirection } from '../lib/agents/foundationCreativeDirection'
import { listThinGatedSections } from '../lib/agents/foundationCreativeDirection/buildInput'
import { loadFieldScores } from '../lib/foundation/sectionStrength'

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

process.env.NEXT_PUBLIC_SUPABASE_URL = url
process.env.SUPABASE_SERVICE_ROLE_KEY = key

const GENERIC_SMELLS: { pattern: RegExp; label: string; skipInMustNot?: boolean }[] = [
  { pattern: /small business(es)?\s+(everywhere|owners?\s+who\s+want\s+to\s+grow)/i, label: 'generic small-business opener' },
  { pattern: /leading provider/i, label: 'leading provider cliché' },
  { pattern: /\b(synergy|leverage|best-in-class)\b/i, label: 'corporate jargon' },
  { pattern: /\bgrow your business\b/i, label: 'grow your business filler' },
]

function smellCheck(text: string, field: string, skipPatterns = false): string[] {
  if (skipPatterns) return []
  const hits: string[] = []
  for (const { pattern, label } of GENERIC_SMELLS) {
    if (pattern.test(text)) hits.push(`${field}: ${label}`)
  }
  return hits
}

function printHumanSummary(dir: Awaited<ReturnType<typeof translateFoundationToCreativeDirection>>) {
  console.log('\n--- Human-readable summary ---\n')
  console.log('VOICE')
  console.log(`  ${dir.voiceProfile.voiceSummary}`)
  console.log(`  Do: ${dir.voiceProfile.toneDo.join(' · ')}`)
  console.log(`  Don't: ${dir.voiceProfile.toneDont.join(' · ') || '(none)'}`)
  console.log('\nCUSTOMER PAIN')
  console.log(`  ${dir.customerPain}`)
  console.log('\nHEADLINE ANGLES')
  dir.headlineAngles.forEach((a, i) => console.log(`  ${i + 1}. ${a}`))
  console.log('\nPRODUCT')
  console.log(`  Category: ${dir.product.category}`)
  console.log(`  Key nouns: ${dir.product.keyNouns.join(', ')}`)
  console.log(`  Must not depict: ${dir.product.mustNotDepict.join(', ') || '(none)'}`)
  console.log('\nVISUAL DIRECTION')
  console.log(`  Aesthetic: ${dir.visualDirection.aesthetic}`)
  console.log(`  Lighting: ${dir.visualDirection.lighting}`)
  console.log(`  Casting: ${dir.visualDirection.casting}`)
  console.log(`  Palette: ${dir.visualDirection.paletteWords.join(', ') || '(none)'}`)
  console.log(`  Forbidden: ${dir.visualDirection.forbiddenVisuals.join(', ') || '(none)'}`)
  if (dir.weakSignals?.length) {
    console.log('\nWEAK SIGNALS')
    dir.weakSignals.forEach(s => console.log(`  - ${s}`))
  }
}

async function resolveProfile(sb: ReturnType<typeof createClient>) {
  const override = process.env.CREATIVE_DIRECTION_PROFILE_ID?.trim()
  if (override) {
    const { data, error } = await sb
      .from('profiles')
      .select('id, company_name, foundation_score')
      .eq('id', override)
      .single()
    if (error || !data) throw new Error(`Profile not found: ${override}`)
    return data
  }

  const { data: profiles, error } = await sb
    .from('profiles')
    .select('id, company_name, foundation_score')
    .not('foundation_score', 'is', null)
    .order('foundation_score', { ascending: false, nullsFirst: false })
    .limit(10)

  if (error) throw new Error(error.message)
  if (!profiles?.length) throw new Error('No scored profiles found')

  const agent7even = profiles.find(p =>
    /agent7even/i.test(p.company_name ?? ''),
  )
  return agent7even ?? profiles[0]
}

async function main() {
  const sb = createClient(url!, key!)

  console.log('=== Creative Direction checkpoint (Step 2) ===\n')
  const profile = await resolveProfile(sb)
  console.log(`Profile: ${profile.company_name ?? profile.id}`)
  console.log(`Foundation score: ${profile.foundation_score ?? '—'}%`)
  console.log(`Model: ${process.env.CREATIVE_DIRECTION_MODEL ?? 'anthropic/claude-sonnet-4'}\n`)

  const fieldScores = await loadFieldScores(profile.id)
  const thin = listThinGatedSections(fieldScores)
  if (thin.length) {
    console.log(`Thin gated sections (70–84%): ${thin.map(t => `${t.section} ${t.score}%`).join(', ')}`)
  }

  console.log('\nTranslating Foundation → CreativeDirection…\n')
  const dir = await translateFoundationToCreativeDirection({
    profileId: profile.id,
    companyName: profile.company_name ?? 'Business',
  })

  console.log('--- JSON ---\n')
  console.log(JSON.stringify(dir, null, 2))

  printHumanSummary(dir)

  const smellTargets = [
    dir.customerPain,
    dir.voiceProfile.voiceSummary,
    ...dir.headlineAngles,
    dir.product.category,
  ].join('\n')

  const smells = smellCheck(smellTargets, 'output')

  const isAgent7even = /agent7even/i.test(profile.company_name ?? '')
  if (isAgent7even) {
    const blob = [
      dir.customerPain,
      dir.product.category,
      dir.product.keyNouns.join(' '),
      dir.voiceProfile.voiceSummary,
    ].join(' ')
    if (!/marketing platform|agent7even|maya/i.test(blob)) {
      smells.push('Agent7even profile: output never mentions marketing platform / Maya / Agent7even')
    }
  }

  console.log('\n--- Automated smell checks ---')
  if (smells.length === 0) {
    console.log('PASS — no generic-smell hits on core fields')
  } else {
    console.log('FAIL — review before Step 3:')
    smells.forEach(s => console.log(`  · ${s}`))
  }

  console.log(`
HUMAN CHECKPOINT — read the JSON above:
[ ] customerPain names YOUR customer, not "small businesses everywhere"
[ ] headlineAngles sound like YOUR positioning, not template SaaS
[ ] product.keyNouns include things you would actually show in a post
[ ] visualDirection matches Your Look fields (if filled)
[ ] weakSignals reflect real thin spots you know about
[ ] Nothing reads like it could apply to any random B2B startup

If 4+ boxes checked → GO to Step 3
If mostly generic → fix Foundation answers, re-run this script
`)

  if (smells.length > 0) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
