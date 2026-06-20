/**
 * Full verification: gate logic + authenticated HTTP (matches verify-zernio-tenant-fixes.ts).
 * Usage: npx --yes tsx --env-file=.env.local scripts/verify-generation-floor-http.ts
 */
import { createClient } from '@supabase/supabase-js'
import { createClerkClient } from '@clerk/backend'
import {
  assertGenerationFloor,
  GENERATION_SECTION_FLOOR,
} from '../lib/foundation/sectionStrength'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const clerkSecret = process.env.CLERK_SECRET_KEY
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

async function getClerkSessionJwt(clerkUserId: string): Promise<string> {
  if (!clerkSecret) throw new Error('CLERK_SECRET_KEY not set')
  const clerk = createClerkClient({ secretKey: clerkSecret })

  const { data: existing } = await clerk.sessions.getSessionList({
    userId: clerkUserId,
    status: 'active',
    limit: 1,
  })
  let sessionId = existing[0]?.id

  if (!sessionId) {
    const session = await clerk.sessions.createSession({ userId: clerkUserId })
    sessionId = session.id
  }

  const res = await fetch(`https://api.clerk.com/v1/sessions/${sessionId}/tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clerkSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(`Clerk token mint failed: ${res.status}`)
  const json = (await res.json()) as { jwt: string }
  return json.jwt
}

async function apiGet(path: string, jwt: string) {
  const res = await fetch(`${appUrl}${path}`, {
    redirect: 'manual',
    headers: { Authorization: `Bearer ${jwt}` },
  })
  const text = await res.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    body = text.slice(0, 300)
  }
  return { status: res.status, body }
}

async function main() {
  const supabase = createClient(url!, serviceKey!)

  console.log('=== 1) Script gate logic (assertGenerationFloor) ===\n')
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, company_name, foundation_score, clerk_user_id')
    .not('clerk_user_id', 'is', null)
    .order('foundation_score', { ascending: false, nullsFirst: false })
    .limit(3)

  if (!profiles?.length) {
    console.error('No profiles with clerk_user_id')
    process.exit(1)
  }

  for (const p of profiles) {
    const result = await assertGenerationFloor(p.id)
    console.log(
      `${p.company_name ?? p.id} (global ${p.foundation_score ?? '—'}%):`,
      result.ok
        ? `ALLOWED ${JSON.stringify(result.scores)}`
        : `BLOCKED ${result.reason} section=${result.section} score=${result.score}`,
    )
  }

  console.log('\n=== 2) Unauthenticated curl (expect 307 → sign-in) ===\n')
  const unauth = await fetch(`${appUrl}/api/foundation/generation-floor`, { redirect: 'manual' })
  console.log(`  status: ${unauth.status}`)
  console.log(`  location: ${unauth.headers.get('location') ?? '(none)'}`)
  if (unauth.status !== 307) {
    console.error(`  FAIL: expected 307, got ${unauth.status}`)
    process.exit(1)
  }
  console.log('  PASS')

  if (!clerkSecret) {
    console.log('\n  SKIP authenticated HTTP — CLERK_SECRET_KEY not set')
    return
  }

  console.log('\n=== 3) Authenticated HTTP (Authorization: Bearer — same as verify-zernio) ===\n')

  for (const label of ['strongest-scored', 'weakest-of-sample'] as const) {
    const profile =
      label === 'strongest-scored' ? profiles[0] : profiles[profiles.length - 1]
    if (!profile?.clerk_user_id) continue

    const gate = await assertGenerationFloor(profile.id)
    const jwt = await getClerkSessionJwt(profile.clerk_user_id)
    const http = await apiGet('/api/foundation/generation-floor', jwt)

    console.log(`--- ${label}: ${profile.company_name ?? profile.id} ---`)
    console.log(`  gate: ${gate.ok ? 'ALLOWED' : `BLOCKED (${gate.reason})`}`)
    console.log(`  HTTP: ${http.status}`)
    console.log(`  body: ${JSON.stringify(http.body, null, 2)}`)

    const expectedStatus = gate.ok ? 200 : 403
    if (http.status !== expectedStatus) {
      console.error(`  FAIL: expected HTTP ${expectedStatus}, got ${http.status}`)
      process.exit(1)
    }
    const body = http.body as { allowed?: boolean }
    if (gate.ok && body.allowed !== true) {
      console.error('  FAIL: expected allowed:true')
      process.exit(1)
    }
    if (!gate.ok && body.allowed !== false) {
      console.error('  FAIL: expected allowed:false')
      process.exit(1)
    }
    console.log('  PASS\n')
  }

  console.log('=== All verifications passed ===')
  console.log(`floor threshold: ${GENERATION_SECTION_FLOOR}%`)
  console.log('Auth note: this repo accepts Clerk JWT via Authorization: Bearer (see verify-zernio-tenant-fixes.ts).')
  console.log('Browser curl: copy Cookie header OR use Bearer token from an active session.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
