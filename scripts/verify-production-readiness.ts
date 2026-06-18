#!/usr/bin/env npx tsx
/**
 * Pre-launch readiness checks for agent7even-v2 on www.agent7even.ai.
 *
 * Usage:
 *   npx tsx scripts/verify-production-readiness.ts
 *   npx tsx scripts/verify-production-readiness.ts --url https://www.agent7even.ai
 *
 * Loads .env.local when present (never prints secret values).
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const args = process.argv.slice(2)
const urlFlag = args.find(a => a.startsWith('--url='))?.split('=')[1]
  ?? (args.includes('--url') ? args[args.indexOf('--url') + 1] : undefined)
const baseUrl = urlFlag ?? 'https://www.agent7even.ai'

type Check = { name: string; ok: boolean; detail: string }

const checks: Check[] = []

function loadDotEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  const raw = readFileSync(path, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

function envCheck(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail })
}

function keyMode(key: string | undefined): 'live' | 'test' | 'missing' {
  if (!key) return 'missing'
  if (key.startsWith('pk_live_') || key.startsWith('sk_live_')) return 'live'
  if (key.startsWith('pk_test_') || key.startsWith('sk_test_')) return 'test'
  return 'missing'
}

async function fetchStatus(path: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`${baseUrl}${path}`, { redirect: 'follow' })
  const body = await res.text()
  return { status: res.status, body }
}

// Live HTTP checks
async function runLiveChecks() {
  const livePaths = ['/privacy', '/terms', '/security', '/data-deletion', '/sign-up', '/pricing']
  for (const path of livePaths) {
    try {
      const { status } = await fetchStatus(path)
      envCheck(`Live ${path}`, status === 200, `HTTP ${status}`)
    } catch (err) {
      envCheck(`Live ${path}`, false, err instanceof Error ? err.message : 'fetch failed')
    }
  }

  try {
    const { body } = await fetchStatus('/sign-up')
    const pkTest = body.includes('pk_test_')
    const pkLive = body.includes('pk_live_')
    envCheck(
      'Production Clerk instance',
      pkLive && !pkTest,
      pkLive ? 'pk_live detected on /sign-up' : 'pk_test still served — switch Clerk Production keys on Vercel',
    )
  } catch {
    /* already logged above */
  }
}

async function main() {
  loadDotEnvLocal()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
  const stripeSk = process.env.STRIPE_SECRET_KEY ?? ''

  envCheck(
    'NEXT_PUBLIC_APP_URL → .ai',
    appUrl.includes('agent7even.ai') && !appUrl.includes('app.agent7even.com'),
    appUrl ? appUrl : '(not set locally — check Vercel Production)',
  )

  envCheck(
    'Clerk publishable key (local/.env.local)',
    keyMode(clerkPk) === 'live',
    clerkPk
      ? `${keyMode(clerkPk) === 'live' ? 'pk_live' : 'pk_test'} configured`
      : '(not set locally — verify Vercel + live sign-up page)',
  )

  envCheck(
    'Stripe secret key (local/.env.local)',
    keyMode(stripeSk) === 'live',
    stripeSk
      ? `${keyMode(stripeSk) === 'live' ? 'sk_live' : 'sk_test'} configured`
      : '(not set locally — verify Vercel Production)',
  )

  const requiredLocal = [
    'CLERK_SECRET_KEY',
    'CLERK_WEBHOOK_SIGNING_SECRET',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_STARTER_MONTHLY_PRICE_ID',
    'STRIPE_GROWTH_MONTHLY_PRICE_ID',
    'STRIPE_PROAGENT_MONTHLY_PRICE_ID',
    'ZERNIO_API_KEY',
    'RESEND_API_KEY',
  ]

  for (const key of requiredLocal) {
    envCheck(`Env: ${key}`, Boolean(process.env[key]), process.env[key] ? 'set' : 'missing in .env.local')
  }

  envCheck(
    'Env: STRIPE_SEAT_PRICE_ID (team seats)',
    Boolean(process.env.STRIPE_SEAT_PRICE_ID),
    process.env.STRIPE_SEAT_PRICE_ID ? 'set' : 'missing — team seat billing disabled until set',
  )

  const legalFiles = [
    'app/privacy/page.tsx',
    'app/terms/page.tsx',
    'app/data-deletion/page.tsx',
  ]
  for (const file of legalFiles) {
    const path = resolve(process.cwd(), file)
    if (!existsSync(path)) continue
    const src = readFileSync(path, 'utf8')
    const hasLegacy = src.includes('app.agent7even.com')
    envCheck(
      `Legal source: ${file}`,
      !hasLegacy,
      hasLegacy ? 'still references app.agent7even.com' : 'uses .ai canonical URLs',
    )
  }

  await runLiveChecks()

  console.log(`\nAgent7even production readiness — ${baseUrl}\n`)
  for (const c of checks) {
    console.log(`${c.ok ? '✓' : '✗'} ${c.name}`)
    console.log(`  ${c.detail}`)
  }
  const failed = checks.filter(c => !c.ok).length
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
  if (failed > 0) {
    console.log('\nSee PRODUCTION_LAUNCH_SESSION.md for dashboard steps (Clerk, Stripe, Zernio DPA).')
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
