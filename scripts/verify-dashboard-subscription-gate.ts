/**
 * Lock in: the subscription gate is not only the dashboard home page.
 * Deep links under /dashboard and the ungated text-generation APIs must use
 * loadMayaProductAccess (same decision as mayaAccessAfterProfile).
 *
 * Usage: npx --yes tsx scripts/verify-dashboard-subscription-gate.ts
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

function fail(message: string): never {
  console.error(`FAIL · ${message}`)
  process.exit(1)
}

const root = resolve(process.cwd())

function source(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8')
}

const layout = source('app/dashboard/layout.tsx')
if (!layout.includes('loadMayaProductAccess')) {
  fail('dashboard layout must call loadMayaProductAccess')
}
if (!layout.includes("entry.access === 'start-trial'")) {
  fail('dashboard layout must redirect when access is start-trial')
}
if (!layout.includes('startTrialPath()')) {
  fail('dashboard layout must redirect to startTrialPath()')
}
if (!layout.includes('ensureProfileForClerkUser')) {
  fail('dashboard layout must create a missing profile before the gate so checkout recovery can link it')
}

const home = source('app/dashboard/page.tsx')
if (!home.includes('loadMayaProductAccess')) {
  fail('dashboard home must keep using loadMayaProductAccess')
}

for (const rel of [
  'app/api/maya/chat/route.ts',
  'app/api/campaigns/generate/route.ts',
  'app/api/inbox/draft-reply/route.ts',
]) {
  const src = source(rel)
  const handlerAt = src.indexOf('export async function POST')
  if (handlerAt < 0) fail(`${rel} is missing POST`)
  const handler = src.slice(handlerAt)
  if (!handler.includes('loadMayaProductAccess')) {
    fail(`${rel} must call loadMayaProductAccess before provider work`)
  }
  if (!handler.includes("productAccess.access === 'start-trial'")) {
    fail(`${rel} must reject start-trial access`)
  }
  const gateAt = handler.indexOf('loadMayaProductAccess')
  const providerAt = Math.min(
    ...['openRouterComplete(', 'streamText(', 'generateText(']
      .map(token => {
        const at = handler.indexOf(token)
        return at === -1 ? Number.POSITIVE_INFINITY : at
      }),
  )
  if (gateAt > providerAt) {
    fail(`${rel} checks subscription after the model call`)
  }
}

const helper = source('lib/auth/mayaAccessAfterProfile.ts')
if (!helper.includes('export async function loadMayaProductAccess')) {
  fail('loadMayaProductAccess must live next to mayaAccessAfterProfile')
}
if (!helper.includes('mayaAccessAfterProfile(')) {
  fail('loadMayaProductAccess must delegate to mayaAccessAfterProfile')
}

console.log('verify-dashboard-subscription-gate: ok')
