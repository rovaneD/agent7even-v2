/**
 * Locks Foundation generate funding invariants:
 * - platform-funded only before foundation_complete
 * - /api/foundation/generate requires subscription gate + chargeCredits wiring
 *
 * Run: npm run verify:foundation-generate-funding
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { shouldChargeFoundationGenerationCredits } from '../lib/foundation/generationFunding'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(
  shouldChargeFoundationGenerationCredits(false) === false,
  'incomplete Foundation must remain platform-funded',
)
assert(
  shouldChargeFoundationGenerationCredits(null) === false,
  'null foundation_complete must remain platform-funded',
)
assert(
  shouldChargeFoundationGenerationCredits(undefined) === false,
  'undefined foundation_complete must remain platform-funded',
)
assert(
  shouldChargeFoundationGenerationCredits(true) === true,
  'completed Foundation regenerates must charge credits',
)

const routeSource = readFileSync(
  resolve(process.cwd(), 'app/api/foundation/generate/route.ts'),
  'utf8',
)
assert(
  routeSource.includes('ensurePaidSubscriptionForClerkUser'),
  'generate route must gate on paid/trial subscription',
)
assert(
  routeSource.includes('shouldChargeFoundationGenerationCredits'),
  'generate route must decide chargeCredits from foundation_complete',
)
assert(
  routeSource.includes('chargeCredits'),
  'generate route must pass chargeCredits into runFoundationGeneration',
)
assert(
  routeSource.includes('foundation_complete'),
  'generate route must load foundation_complete',
)

const genSource = readFileSync(
  resolve(process.cwd(), 'lib/foundation/runFoundationGeneration.ts'),
  'utf8',
)
assert(
  genSource.includes('chargeCredits?: boolean') || genSource.includes('chargeCredits = false'),
  'runFoundationGeneration must accept chargeCredits',
)
assert(
  /chargeCredits,\s*\}/.test(genSource) || genSource.includes('chargeCredits,'),
  'runFoundationGeneration must forward chargeCredits to runAgent',
)
assert(
  !genSource.includes('chargeCredits: false'),
  'runFoundationGeneration must not hardcode chargeCredits: false',
)

console.log('verify-foundation-generate-funding: ok')
