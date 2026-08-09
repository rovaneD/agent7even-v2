/**
 * Static guard: runAgent must fail closed when agent_outputs insert fails,
 * and Foundation Hub/wizard saves must not report success on a failed profile write.
 *
 * Usage:
 *   npx tsx scripts/verify-runagent-output-persist.ts
 *   npm run verify:runagent-output-persist
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

function assertContains(source: string, needle: string, label: string) {
  if (!source.includes(needle)) {
    throw new Error(`Missing expected pattern in ${label}: ${needle}`)
  }
}

function assertOrdered(source: string, earlier: string, later: string, label: string) {
  const a = source.indexOf(earlier)
  const b = source.indexOf(later)
  if (a < 0 || b < 0) {
    throw new Error(`${label} missing sequence markers`)
  }
  if (!(a < b)) {
    throw new Error(`${label} must order "${earlier}" before "${later}"`)
  }
}

function main() {
  const root = resolve(__dirname, '..')
  const runner = readFileSync(resolve(root, 'lib/agents/runner.ts'), 'utf8')
  const saveAnswers = readFileSync(
    resolve(root, 'app/api/foundation/save-answers/route.ts'),
    'utf8',
  )
  const saveStep = readFileSync(
    resolve(root, 'app/api/foundation/save-step/route.ts'),
    'utf8',
  )
  const saveExa = readFileSync(
    resolve(root, 'app/api/foundation/save-exa-confirm/route.ts'),
    'utf8',
  )

  assertContains(runner, "from('agent_outputs').insert", 'runAgent')
  assertContains(runner, 'agent_outputs_insert_failed', 'runAgent')
  assertContains(runner, "updateTaskStatus(taskId, 'failed')", 'runAgent')
  assertContains(runner, 'output persist failed — refund', 'runAgent')

  const insertIdx = runner.indexOf("from('agent_outputs').insert")
  const failThrowIdx = runner.indexOf('agent_outputs_insert_failed')
  const completedIdx = runner.indexOf("status:        'completed'")
  if (insertIdx < 0 || failThrowIdx < 0 || completedIdx < 0) {
    throw new Error('runAgent missing insert / fail / complete sequence')
  }
  if (!(insertIdx < failThrowIdx && failThrowIdx < completedIdx)) {
    throw new Error('runAgent must throw on insert failure before marking completed')
  }

  for (const [src, label] of [
    [saveAnswers, 'save-answers'],
    [saveStep, 'save-step'],
    [saveExa, 'save-exa-confirm'],
  ] as const) {
    assertContains(src, 'updateError', label)
    assertContains(src, "error: 'save_failed'", label)
    assertOrdered(src, 'const { error: updateError }', "error: 'save_failed'", label)
  }

  // Hub / wizard success responses must come after the checked update.
  assertOrdered(saveAnswers, "error: 'save_failed'", 'success: true', 'save-answers')
  assertOrdered(saveStep, "error: 'save_failed'", 'return NextResponse.json({ success: true })', 'save-step')
  assertOrdered(saveExa, "error: 'save_failed'", 'ok: true', 'save-exa-confirm')

  console.log('verify-runagent-output-persist: ok')
}

main()
