/**
 * Verify POST /api/posts/generate-images (handoff §9 step 2).
 * Usage:
 *   npx --yes tsx --env-file=.env.local scripts/verify-generate-images-route.ts
 *   npx --yes tsx --env-file=.env.local scripts/verify-generate-images-route.ts --live
 *
 * Default: gate + auth checks only (no OpenRouter spend).
 * --live: full generate (3 images) for strongest-scored profile — slow + costs credits/API.
 */
import { createClient } from '@supabase/supabase-js'
import { createClerkClient } from '@clerk/backend'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const live = process.argv.includes('--live')

async function getClerkJwt(clerkUserId: string): Promise<string> {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })
  const { data: sessions } = await clerk.sessions.getSessionList({
    userId: clerkUserId,
    status: 'active',
    limit: 1,
  })
  const sessionId = sessions[0]?.id ?? (await clerk.sessions.createSession({ userId: clerkUserId })).id
  const res = await fetch(`https://api.clerk.com/v1/sessions/${sessionId}/tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(`Clerk token mint failed: ${res.status}`)
  return ((await res.json()) as { jwt: string }).jwt
}

async function postGenerate(jwt: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${appUrl}/api/posts/generate-images`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    json = text.slice(0, 200)
  }
  return { status: res.status, json }
}

async function main() {
  if (!process.env.CLERK_SECRET_KEY) {
    console.error('CLERK_SECRET_KEY required')
    process.exit(1)
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const flagOn = process.env.NEXT_PUBLIC_IMAGE_GENERATION === 'true'
  console.log(`NEXT_PUBLIC_IMAGE_GENERATION=${flagOn}`)
  console.log(`mode: ${live ? 'live (3 images)' : 'gate-only'}\n`)

  if (!flagOn) {
    console.log('SKIP: set NEXT_PUBLIC_IMAGE_GENERATION=true in .env.local and restart dev server for route tests.')
    process.exit(0)
  }

  const { data: profiles } = await sb
    .from('profiles')
    .select('id, clerk_user_id, company_name, foundation_score')
    .not('clerk_user_id', 'is', null)
    .order('foundation_score', { ascending: true, nullsFirst: true })
    .limit(5)

  const weakest = profiles?.[0]
  const strongest = profiles?.[profiles.length - 1]
  if (!weakest?.clerk_user_id || !strongest?.clerk_user_id) {
    console.error('Need profiles with clerk_user_id')
    process.exit(1)
  }

  const weakJwt = await getClerkJwt(weakest.clerk_user_id)
  const weakRes = await postGenerate(weakJwt)
  console.log('--- blocked profile (expect 403 foundation_floor) ---')
  console.log(`  HTTP ${weakRes.status}`)
  console.log(`  body: ${JSON.stringify(weakRes.json, null, 2)}`)
  if (weakRes.status !== 403) {
    console.error('FAIL: expected 403 for weak profile')
    process.exit(1)
  }
  console.log('  PASS\n')

  if (!live) {
    console.log('Gate-only checks passed. Run with --live for full 3-image generation (OpenRouter cost).')
    return
  }

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY required for --live')
    process.exit(1)
  }

  const strongJwt = await getClerkJwt(strongest.clerk_user_id)
  console.log(`--- live generate: ${strongest.company_name ?? strongest.id} ---`)
  const t0 = Date.now()
  const strongRes = await postGenerate(strongJwt, { sceneDirection: 'Verify run — professional SaaS post for small business owners.' })
  console.log(`  HTTP ${strongRes.status} (${Math.round((Date.now() - t0) / 1000)}s)`)
  console.log(`  body: ${JSON.stringify(strongRes.json, null, 2)}`)
  if (strongRes.status !== 200) {
    console.error('FAIL: expected 200 for live generate')
    process.exit(1)
  }
  const body = strongRes.json as { options?: unknown[] }
  if (!Array.isArray(body.options) || body.options.length < 1) {
    console.error('FAIL: expected options array')
    process.exit(1)
  }
  console.log(`  PASS — ${body.options.length} option(s)`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
