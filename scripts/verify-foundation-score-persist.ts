/**
 * Locks Foundation rescore persistence invariants:
 * - replace field scores via upsert-then-prune (never delete-all then insert)
 * - runFoundationScore must not write client-supplied foundation_answers
 * - save-exa-confirm must refuse completed Foundations
 *
 * Run: npm run verify:foundation-score-persist
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { staleFoundationFieldKeys } from '../lib/foundation/persistFoundationFieldScores'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(
  JSON.stringify(staleFoundationFieldKeys(['a', 'b', 'c'], ['a', 'c'])) === JSON.stringify(['b']),
  'stale keys should be previous-only',
)
assert(
  staleFoundationFieldKeys(['a'], ['a', 'b']).length === 0,
  'no stale keys when previous ⊆ current',
)
assert(
  staleFoundationFieldKeys([], ['a']).length === 0,
  'empty previous yields no stale keys',
)

const persistSource = readFileSync(
  resolve(process.cwd(), 'lib/foundation/persistFoundationFieldScores.ts'),
  'utf8',
)
assert(
  persistSource.includes(".upsert(rows, { onConflict: 'user_id,field_key' })"),
  'replacement must upsert on user_id,field_key before pruning',
)
assert(
  persistSource.includes(".in('field_key', staleKeys)"),
  'prune must target only stale field keys',
)
const deleteIdx = persistSource.indexOf('.delete()')
assert(deleteIdx >= 0, 'prune path must delete stale keys')
const afterDelete = persistSource.slice(deleteIdx, deleteIdx + 180)
assert(
  afterDelete.includes(".in('field_key', staleKeys)"),
  'delete must be scoped to stale field keys, not all user scores',
)

const scoreSource = readFileSync(
  resolve(process.cwd(), 'lib/foundation/runFoundationScore.ts'),
  'utf8',
)
assert(
  scoreSource.includes('replaceFoundationFieldScores'),
  'runFoundationScore must use replaceFoundationFieldScores',
)
assert(
  !scoreSource.includes(".delete().eq('user_id', profile.id)"),
  'runFoundationScore must not wipe all field scores before insert',
)
assert(
  !scoreSource.includes('foundation_answers: answers'),
  'runFoundationScore must not overwrite foundation_answers from the score payload',
)

const exaConfirm = readFileSync(
  resolve(process.cwd(), 'app/api/foundation/save-exa-confirm/route.ts'),
  'utf8',
)
assert(
  exaConfirm.includes('foundation_complete'),
  'save-exa-confirm must load foundation_complete',
)
assert(
  exaConfirm.includes("if (profile.foundation_complete)"),
  'save-exa-confirm must skip when Foundation is already complete',
)
assert(
  exaConfirm.includes(".neq('foundation_complete', true)"),
  'save-exa-confirm updates must race-guard against concurrent completion',
)

const editor = readFileSync(
  resolve(process.cwd(), 'app/dashboard/foundation/FoundationEditor.tsx'),
  'utf8',
)
const rescoreAt = editor.indexOf('async function handleRescore()')
assert(rescoreAt >= 0, 'FoundationEditor must define handleRescore')
const rescoreBody = editor.slice(rescoreAt, rescoreAt + 1200)
const saveAt = rescoreBody.indexOf("/api/foundation/save-answers")
const scoreAt = rescoreBody.indexOf("/api/foundation/score")
assert(saveAt >= 0, 'Editor rescore must persist via save-answers')
assert(scoreAt >= 0, 'Editor rescore must call score')
assert(saveAt < scoreAt, 'Editor must save answers before scoring')

console.log('verify-foundation-score-persist: ok')
