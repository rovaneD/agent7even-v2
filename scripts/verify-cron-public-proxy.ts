/**
 * Lock in: Vercel cron routes must skip Clerk auth.protect() at the proxy layer.
 * Handlers still require Authorization: Bearer CRON_SECRET.
 *
 * Usage: npx --yes tsx scripts/verify-cron-public-proxy.ts
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

function fail(message: string): never {
  console.error(`FAIL · ${message}`)
  process.exit(1)
}

const root = resolve(process.cwd())
const proxySrc = readFileSync(resolve(root, 'proxy.ts'), 'utf8')

const matcherBlock = proxySrc.match(
  /const isPublicRoute = createRouteMatcher\(\[([\s\S]*?)\]\)/,
)
if (!matcherBlock) fail('could not find isPublicRoute matcher in proxy.ts')

const publicRoutes = matcherBlock[1]
if (!publicRoutes.includes("'/api/cron(.*)'") && !publicRoutes.includes('"/api/cron(.*)"')) {
  fail('proxy.ts isPublicRoute must include /api/cron(.*)')
}
if (
  !publicRoutes.includes("'/api/digest/generate'") &&
  !publicRoutes.includes('"/api/digest/generate"')
) {
  fail('proxy.ts isPublicRoute must include /api/digest/generate')
}
if (!proxySrc.includes('await auth.protect()')) {
  fail('proxy.ts must still call auth.protect() for non-public routes')
}

const cronRoutes = [
  'app/api/cron/allocate-credits/route.ts',
  'app/api/cron/calculate-engagement/route.ts',
  'app/api/cron/morning-digest/route.ts',
  'app/api/cron/nudge-inactive/route.ts',
  'app/api/cron/refresh-pricing/route.ts',
  'app/api/cron/run-scheduled-agents/route.ts',
]

for (const rel of cronRoutes) {
  const src = readFileSync(resolve(root, rel), 'utf8')
  if (!src.includes('CRON_SECRET')) {
    fail(`${rel} must still check CRON_SECRET after the proxy exemption`)
  }
  if (!src.includes('Bearer')) {
    fail(`${rel} must compare the Authorization bearer to CRON_SECRET`)
  }
}

const digestSrc = readFileSync(resolve(root, 'app/api/digest/generate/route.ts'), 'utf8')
if (!digestSrc.includes('CRON_SECRET')) {
  fail('app/api/digest/generate/route.ts must still accept the cron bearer')
}
if (!digestSrc.includes('getWorkspaceSessionFromRequest')) {
  fail('app/api/digest/generate/route.ts must still require a workspace session for non-cron callers')
}

console.log('PASS · /api/cron(.*) and /api/digest/generate are public at proxy')
console.log('PASS · cron handlers and digest generate still enforce CRON_SECRET / session auth')
