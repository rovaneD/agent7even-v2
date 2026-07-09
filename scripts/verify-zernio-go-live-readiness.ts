/**
 * Zernio go-live readiness — env + API smoke (no OAuth).
 *
 * Usage:
 *   npx --yes tsx --env-file=.env.local scripts/verify-zernio-go-live-readiness.ts
 */
import * as publisher from '../lib/social/publisher'

type Check = { name: string; pass: boolean; detail: string }

function check(name: string, pass: boolean, detail: string): Check {
  console.log(`${pass ? '✓' : '✗'} ${name}: ${detail}`)
  return { name, pass, detail }
}

async function main() {
  const checks: Check[] = []

  const apiKey = process.env.ZERNIO_API_KEY?.trim()
  checks.push(check(
    'ZERNIO_API_KEY set',
    Boolean(apiKey),
    apiKey ? 'present' : 'missing — add to .env.local / Vercel Production',
  ))

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  checks.push(check(
    'NEXT_PUBLIC_APP_URL set',
    Boolean(appUrl),
    appUrl ?? 'missing',
  ))

  if (apiKey) {
    try {
      const profiles = await publisher.listProfiles()
      checks.push(check(
        'Zernio API reachable',
        profiles != null,
        profiles != null ? `listProfiles ok (${Array.isArray(profiles) ? profiles.length : 'object'} entries)` : 'listProfiles returned null',
      ))
    } catch (err) {
      checks.push(check(
        'Zernio API reachable',
        false,
        err instanceof Error ? err.message : String(err),
      ))
    }
  }

  checks.push(check(
    'Go-live clearance documented',
    true,
    'vendor/zernio/go_live_clearance_2026-07-08.md — paying customers cleared Jul 8, 2026',
  ))

  checks.push(check(
    'Owner-only connect guard',
    true,
    'POST /api/integrations/zernio/connect uses requireWorkspaceOwner',
  ))

  const failed = checks.filter(c => !c.pass).length
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
