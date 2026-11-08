/**
 * A product-ad check or redo must not replace a still it did not remake,
 * and must not rewind a task that has already started filming.
 *
 * Usage: npx tsx scripts/verify-product-ad-review.ts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  applyStillChecks,
  mergeProductRedo,
  requestedStillKeys,
  type ReviewTask,
} from '../lib/agents/videoGeneration/productAdReview'

function fail(message: string): never {
  console.error(`FAIL · ${message}`)
  process.exit(1)
}

function assert(cond: unknown, message: string) {
  if (!cond) fail(message)
}

const base: ReviewTask = {
  stage: 'review',
  stills: { hero: 'ws/hero-a.png', lifestyle: 'ws/life-a.png', wetGlass: 'ws/wet-a.png' },
  checks: { hero: { passed: false, issues: ['old label'] }, lifestyle: { passed: true, issues: [] } },
  redosLeft: 2,
}

const fresh: ReviewTask = {
  ...base,
  stills: { ...base.stills, lifestyle: 'ws/life-b.png' },
  checks: { lifestyle: { passed: true, issues: [] } },
  redosLeft: 1,
}

const checked = applyStillChecks(
  base,
  fresh,
  ['hero', 'lifestyle'],
  [{ passed: false, issues: ['old label'] }, { passed: false, issues: ['stale lifestyle'] }],
)
assert(checked, 'a review task accepts check results')
assert(checked!.checks.hero?.passed === false, 'a still that did not change keeps its verdict')
assert(checked!.checks.lifestyle?.passed === true, 'a remade still keeps the verdict stored with the new picture')
assert(checked!.checks.lifestyle?.issues.length === 0, 'a remade still does not inherit the failure of the picture that was replaced')
const cleared = applyStillChecks(
  base,
  { ...fresh, checks: {} },
  ['lifestyle'],
  [{ passed: false, issues: ['stale lifestyle'] }],
)
assert(cleared?.checks.lifestyle === undefined, 'a remade still with no stored verdict does not gain the old picture\'s failure')
assert(checked!.input.stills.lifestyle === 'ws/life-b.png', 'saving a check keeps the remade still')
assert(checked!.input.redosLeft === 1, 'saving a check keeps the redo count from the fresh task')

const filming: ReviewTask = { ...fresh, stage: 'rendering' }
assert(applyStillChecks(base, filming, ['hero'], [{ passed: false, issues: ['x'] }]) === null, 'a check does not write once filming has started')

const merged = mergeProductRedo(base, fresh, 'hero', { still: 'ws/hero-b.png', wetGlass: 'ws/wet-b.png' }, false)
assert(merged.ok, 'a redo merges onto the fresh task')
if (merged.ok) {
  assert(merged.input.stills.hero === 'ws/hero-b.png', 'the remade label shot is saved')
  assert(merged.input.stills.wetGlass === 'ws/wet-b.png', 'a new label shot remakes the wet glass made from it')
  assert(merged.input.stills.lifestyle === 'ws/life-b.png', 'a redo keeps a different still that finished while this one was generating')
  assert(merged.input.redosLeft === 0, 'the redo count comes from the fresh task, not the stale snapshot')
  assert(merged.input.checks?.hero === undefined && merged.input.checks?.wetGlass === undefined, 'the remade stills drop their old verdicts')
}

const replaced = mergeProductRedo(base, { ...fresh, stills: { ...fresh.stills, hero: 'ws/hero-user.png' } }, 'hero', { still: 'ws/hero-auto.png' }, true)
assert(!replaced.ok && replaced.reason === 'replaced', 'an automatic remake does not replace a still the user already remade')

const late = mergeProductRedo(base, filming, 'hero', { still: 'ws/hero-b.png' }, false)
assert(!late.ok && late.reason === 'wrong_stage', 'a redo does not rewind a task that has started filming')

const broke = mergeProductRedo({ ...base, redosLeft: 0 }, { ...fresh, redosLeft: 0 }, 'hero', { still: 'ws/hero-b.png' }, false)
assert(!broke.ok && broke.reason === 'no_redos', 'a redo that lost the race does not drive the count below zero')

assert(
  requestedStillKeys(['nope', 'hero'], base.stills).join() === 'hero',
  'a check only accepts known stills that exist on the task',
)

const route = readFileSync(resolve(process.cwd(), 'app/api/posts/video-product/route.ts'), 'utf8')
assert(route.includes('applyStillChecks'), 'the check route saves verdicts through applyStillChecks')
assert(route.includes('mergeProductRedo'), 'the redo route saves through mergeProductRedo')
assert(route.includes('reviewStillGuards'), 'review writes are conditional on the stills they were merged onto')
assert(!route.includes('?? input'), 'a failed re-read must not fall back to the stale task and overwrite it')

const panel = readFileSync(resolve(process.cwd(), 'components/agents/contentPosting/video/ProductAdPanel.tsx'), 'utf8')
assert(
  panel.includes('disabled={stills.redosLeft <= 0 || busy !== null || checking || !!job}'),
  'Redo stays disabled while a check is in flight',
)
assert(panel.includes('if (!first.ok || !first.checks) return'), 'a conflicting check does not start an automatic remake')

console.log('ok · product-ad review writes keep the stills they did not remake')
