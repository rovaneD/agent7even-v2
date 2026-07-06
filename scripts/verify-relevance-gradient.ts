/**
 * Verify per-agent Foundation relevance gradient advisories.
 *
 * Usage:
 *   npx --yes tsx --env-file=.env.local scripts/verify-relevance-gradient.ts
 *   FOUNDATION_GUARDIAN_PROFILE_ID=<uuid> npx --yes tsx --env-file=.env.local scripts/verify-relevance-gradient.ts
 */
import { AGENTS } from '../lib/agents/registry'
import { loadFieldScores } from '../lib/foundation/sectionStrength'
import {
  evaluateAgentFoundationRelevance,
  formatRelevanceGradientAdvisory,
} from '../lib/foundation/relevanceGradient'

const profileId =
  process.env.FOUNDATION_GUARDIAN_PROFILE_ID?.trim() ??
  process.env.FOUNDATION_VERIFY_PROFILE_ID?.trim()

if (!profileId) {
  console.error('Set FOUNDATION_GUARDIAN_PROFILE_ID or FOUNDATION_VERIFY_PROFILE_ID')
  process.exit(1)
}

async function main() {
  const fieldScores = await loadFieldScores(profileId)
  console.log('=== Foundation relevance gradient ===\n')
  console.log(`Profile: ${profileId}`)
  console.log(`Scored fields: ${Object.keys(fieldScores).length}\n`)

  for (const agent of Object.values(AGENTS)) {
    const evaluation = evaluateAgentFoundationRelevance(agent.id, fieldScores)
    const advisory = formatRelevanceGradientAdvisory(evaluation)
    const limited =
      evaluation.limitedSections.length === 0
        ? 'none'
        : evaluation.limitedSections
            .map(key => {
              const score = evaluation.sectionScores[key]
              const band = evaluation.sectionBands[key]
              return score != null ? `${key} ${score}% (${band})` : `${key} (unscored)`
            })
            .join(', ')

    console.log(`${agent.name} (${agent.id})`)
    console.log(`  warnIfThin limited: ${limited}`)
    console.log(`  advisory injected: ${advisory ? 'yes' : 'no'}`)
    if (advisory) {
      console.log('  ---')
      console.log(
        advisory
          .split('\n')
          .map(line => `  ${line}`)
          .join('\n'),
      )
    }
    console.log('')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
