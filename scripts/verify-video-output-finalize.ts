/**
 * Static guard: video completion must fail closed when agent_outputs insert fails.
 *
 * Usage:
 *   npx tsx scripts/verify-video-output-finalize.ts
 *   npm run verify:video-output-finalize
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

function assertContains(source: string, needle: string, label: string) {
  if (!source.includes(needle)) {
    throw new Error(`Missing expected pattern in ${label}: ${needle}`)
  }
}

function assertNotContains(source: string, needle: string, label: string) {
  if (source.includes(needle)) {
    throw new Error(`Forbidden pattern still present in ${label}: ${needle}`)
  }
}

function main() {
  const root = resolve(__dirname, '..')
  const helper = readFileSync(
    resolve(root, 'lib/agents/videoGeneration/finalizeVideoOutput.ts'),
    'utf8',
  )
  const webhook = readFileSync(
    resolve(root, 'app/api/webhooks/openrouter-video/route.ts'),
    'utf8',
  )
  const reconcile = readFileSync(
    resolve(root, 'app/api/posts/reconcile-video/route.ts'),
    'utf8',
  )

  assertContains(helper, "status: 'pending_approval'", 'finalizeVideoOutput')
  assertContains(helper, ".eq('status', 'running')", 'finalizeVideoOutput')
  assertContains(helper, 'Output insert:', 'finalizeVideoOutput')
  // Completed write must come after a checked insert failure return.
  const insertIdx = helper.indexOf("from('agent_outputs').insert")
  const failReturnIdx = helper.indexOf("return { ok: false, error: `Output insert:")
  const completeIdx = helper.indexOf("status: 'completed'")
  if (insertIdx < 0 || failReturnIdx < 0 || completeIdx < 0) {
    throw new Error('finalizeVideoOutput missing insert / fail / complete sequence')
  }
  if (!(insertIdx < failReturnIdx && failReturnIdx < completeIdx)) {
    throw new Error('finalizeVideoOutput must fail closed on insert before marking completed')
  }

  assertContains(webhook, 'finalizeVideoOutput', 'openrouter-video webhook')
  assertContains(webhook, 'if (!finalized.ok)', 'openrouter-video webhook')
  assertNotContains(
    webhook,
    "console.error('[openrouter-video] agent_outputs insert failed:'",
    'openrouter-video webhook',
  )

  assertContains(reconcile, 'finalizeVideoOutput', 'reconcile-video')
  assertContains(reconcile, 'if (!finalized.ok) throw new Error(finalized.error)', 'reconcile-video')

  console.log('verify-video-output-finalize: ok')
}

main()
