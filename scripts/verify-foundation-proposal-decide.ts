/**
 * Locks Foundation proposal approval invariants:
 * - contradicting proposals map to extending layers (schema CHECK)
 * - approval must not commit user_decision before a successful layer insert
 *
 * Run: npm run verify:foundation-proposal-decide
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { layerStateForProposal } from '../lib/foundation/proposals/decideProposal'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(layerStateForProposal('consistent') === 'consistent', 'consistent stays consistent')
assert(layerStateForProposal('extending') === 'extending', 'extending stays extending')
assert(
  layerStateForProposal('contradicting') === 'extending',
  'contradicting must map to extending for foundation_layers CHECK',
)

const source = readFileSync(
  resolve(process.cwd(), 'lib/foundation/proposals/decideProposal.ts'),
  'utf8',
)

// After the reject/defer early return, the approve path must insert the layer
// before the second updateProposalDecision call.
const afterRejectBranch = source.slice(
  source.indexOf("if (input.decision !== 'approved')"),
)
const earlyReturnEnd = afterRejectBranch.indexOf('return updateResult.ok ? { ok: true } : updateResult')
assert(earlyReturnEnd >= 0, 'reject/defer path must return before approve writes')

const approveOnly = afterRejectBranch.slice(earlyReturnEnd)
const layerInsertAt = approveOnly.indexOf(".from('foundation_layers')")
const decisionUpdateAt = approveOnly.indexOf('updateProposalDecision(supabase, input, decidedAt)')

assert(layerInsertAt >= 0, 'approve path must insert foundation_layers')
assert(decisionUpdateAt >= 0, 'approve path must update proposal decision')
assert(
  layerInsertAt < decisionUpdateAt,
  'layer insert must happen before committing user_decision=approved',
)

console.log('verify-foundation-proposal-decide: ok')
