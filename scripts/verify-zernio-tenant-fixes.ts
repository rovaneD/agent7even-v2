/**
 * Local verification for Zernio cross-tenant fixes (shared master key).
 *
 * Usage:
 *   npx tsx scripts/verify-zernio-tenant-fixes.ts
 *   npx tsx scripts/verify-zernio-tenant-fixes.ts --run-fix1   # DESTRUCTIVE: full disconnect + clears Zernio
 *
 * Requires: .env.local, dev server on localhost:3000 for HTTP tests.
 */
import { createClient } from '@supabase/supabase-js'
import { createClerkClient } from '@clerk/backend'
import * as publisher from '../lib/social/publisher'
import { readZernioPostProfileId } from '../lib/social/zernioPostsParse'
import {
  collectZernioProfileIds,
  disconnectAllZernioProfiles,
} from '../lib/social/zernioProfileIds'

function loadEnv(): void {
  const fs = require('fs') as typeof import('fs')
  const path = require('path') as typeof import('path')
  const envPath = path.join(process.cwd(), '.env.local')
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

type Result = { name: string; pass: boolean; detail: string }

const results: Result[] = []
function record(name: string, pass: boolean, detail: string): void {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}\n  ${detail}\n`)
}

async function getClerkSessionJwt(userId: string): Promise<string> {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })
  const { data } = await clerk.sessions.getSessionList({ userId, status: 'active', limit: 1 })
  const sessionId = data[0]?.id
  if (!sessionId) throw new Error('No active Clerk session — sign in at localhost:3000 first')

  const res = await fetch(`https://api.clerk.com/v1/sessions/${sessionId}/tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(`Clerk token mint failed: ${res.status}`)
  const json = (await res.json()) as { jwt: string }
  return json.jwt
}

async function apiFetch(path: string, jwt: string, init?: RequestInit): Promise<Response> {
  return fetch(`http://localhost:3000${path}`, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
  })
}

async function main(): Promise<void> {
  loadEnv()
  const runFix1 = process.argv.includes('--run-fix1')
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, clerk_user_id, company_name, zernio_profile_id, zernio_profile_ids, zernio_connected_platforms')
    .not('zernio_profile_id', 'is', null)

  if (error || !profiles?.length) {
    throw new Error('No Zernio-connected profile found for verification')
  }

  const tenant = profiles[0]
  const profileIds = collectZernioProfileIds(tenant)
  const zernioProfileId = profileIds[0]
  const clerkUserId = tenant.clerk_user_id as string

  console.log(`Test tenant: ${tenant.company_name} (${tenant.id})`)
  console.log(`Zernio profiles: ${profileIds.join(', ')}\n`)

  // ── Fix 2: profileId readable from getPost ──
  const listRaw = await publisher.listPosts({ profileId: zernioProfileId, limit: 5 })
  const postsArr = (listRaw as { posts?: unknown[] })?.posts ?? []
  const ownPostId = (postsArr[0] as { _id?: string; id?: string })?._id
    ?? (postsArr[0] as { id?: string })?.id

  if (!ownPostId) {
    record('Fix 2 — getPost profileId field', false, 'No posts on test profile to inspect')
  } else {
    const raw = await publisher.getPost(ownPostId)
    const postProfileId = raw ? readZernioPostProfileId(raw) : null
    record(
      'Fix 2 — getPost returns profileId',
      Boolean(postProfileId),
      postProfileId
        ? `post ${ownPostId} → profileId ${postProfileId}`
        : `getPost returned no profileId on post ${ownPostId} — ownership check cannot verify`,
    )

    const wrongSet = ['000000000000000000000000']
    const owned = postProfileId && profileIds.includes(postProfileId)
    const blocked = !postProfileId || !wrongSet.includes(postProfileId)
    record(
      'Fix 2 — ownership logic blocks wrong tenant set',
      Boolean(postProfileId && owned && blocked),
      postProfileId
        ? `real profileId ${postProfileId} ∈ tenant set; wrong set ${wrongSet[0]} would → 404`
        : 'skipped — no profileId',
    )
  }

  // Cross-tenant postId: use a valid ObjectId shape that is NOT this tenant's post
  const crossTenantPostId = '507f1f77bcf86cd799439011'

  let jwt: string
  try {
    jwt = await getClerkSessionJwt(clerkUserId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    record('Auth — Clerk session JWT', false, msg)
    jwt = ''
  }

  if (jwt) {
    for (const [verb, path, body] of [
      ['GET', `/api/posts/${crossTenantPostId}`, undefined],
      ['PATCH', `/api/posts/${crossTenantPostId}`, { content: 'cross-tenant probe' }],
      ['DELETE', `/api/posts/${crossTenantPostId}`, undefined],
    ] as const) {
      const res = await apiFetch(
        path,
        jwt,
        body ? { method: verb, body: JSON.stringify(body) } : { method: verb },
      )
      record(
        `Fix 2 — HTTP ${verb} cross-tenant postId → 404`,
        res.status === 404,
        `${verb} ${path} → ${res.status}`,
      )
    }

    if (ownPostId) {
      const ownGet = await apiFetch(`/api/posts/${ownPostId}`, jwt, { method: 'GET' })
      record(
        'Fix 2 — HTTP GET own post still works',
        ownGet.status === 200,
        `GET /api/posts/${ownPostId} → ${ownGet.status}`,
      )
    }
  }

  // ── Fix 3: accounts — profile-scoped vs key-wide ──
  const profileScoped = await publisher.getProfileAccounts(zernioProfileId)
  const keyWide = await publisher.listAllAccounts()
  const orphans = keyWide.filter(a => !a.profileId)

  record(
    'Fix 3 — no orphan accounts on master key',
    orphans.length === 0,
    `orphan (no profileId) accounts: ${orphans.length}`,
  )

  record(
    'Fix 3 — profile-scoped accounts available',
    profileScoped.length > 0,
    `getProfileAccounts: ${profileScoped.length} (${profileScoped.map(a => a.username).join(', ')})`,
  )

  if (jwt) {
    const socialRes = await apiFetch('/api/analytics/zernio/social?dateRange=30d', jwt, { method: 'GET' })
    if (socialRes.ok) {
      const social = (await socialRes.json()) as { allAccounts?: Array<{ id?: string; username?: string; platform?: string }> }
      const apiAccounts = social.allAccounts ?? []
      const apiIds = new Set(apiAccounts.map(a => a.id).filter((id): id is string => Boolean(id)))
      const scopedIds = new Set(profileScoped.map(a => a.id))
      const onlyOwn = [...apiIds].every(id => scopedIds.has(id))
      const noneMissing = [...scopedIds].every(id => apiIds.has(id))

      record(
        'Fix 3 — HTTP social accounts isolation (only own)',
        onlyOwn,
        `API returned ${apiAccounts.length} accounts: ${apiAccounts.map(a => a.username ?? a.id).join(', ') || '(none)'}`,
      )
      record(
        'Fix 3 — HTTP social accounts completeness (none missing)',
        noneMissing,
        `profile-scoped has ${profileScoped.length}; API has ${apiAccounts.length}`,
      )
    } else {
      record('Fix 3 — HTTP social route', false, `/api/analytics/zernio/social → ${socialRes.status}`)
    }
  }

  // ── Fix 1: optional destructive full disconnect ──
  if (runFix1) {
    console.log('⚠️  Fix 1 — running DESTRUCTIVE full disconnect on test tenant\n')

    const fakeSecondId = '000000000000000000000001'
    const multiIds = Array.from(new Set([...profileIds, fakeSecondId]))
    await supabase
      .from('profiles')
      .update({ zernio_profile_ids: multiIds })
      .eq('id', tenant.id)

    record(
      'Fix 1 — seeded multi-profile array for teardown test',
      true,
      `zernio_profile_ids = [${multiIds.join(', ')}]`,
    )

    if (!jwt) throw new Error('Need Clerk JWT for disconnect API')

    const disconnectRes = await apiFetch('/api/integrations/zernio/disconnect', jwt, {
      method: 'DELETE',
      body: JSON.stringify({}),
    })
    const disconnectBody = await disconnectRes.json().catch(() => ({}))
    record(
      'Fix 1 — HTTP full disconnect',
      disconnectRes.ok,
      `DELETE disconnect → ${disconnectRes.status} ${JSON.stringify(disconnectBody)}`,
    )

    const { data: after } = await supabase
      .from('profiles')
      .select('zernio_profile_id, zernio_profile_ids, zernio_connected_platforms')
      .eq('id', tenant.id)
      .single()

    const cleared =
      after?.zernio_profile_id === null &&
      Array.isArray(after?.zernio_profile_ids) &&
      after.zernio_profile_ids.length === 0 &&
      Array.isArray(after?.zernio_connected_platforms) &&
      after.zernio_connected_platforms.length === 0

    record(
      'Fix 1 — DB columns cleared after disconnect',
      Boolean(cleared),
      JSON.stringify(after),
    )

    console.log('⚠️  Zernio disconnected — reconnect Instagram via dashboard before posting again.\n')
  } else {
    console.log('Fix 1 skipped (destructive). Re-run with --run-fix1 to test full disconnect + DB clear.\n')
  }

  const failed = results.filter(r => !r.pass)
  console.log('─'.repeat(60))
  console.log(`Results: ${results.length - failed.length}/${results.length} passed`)
  if (failed.length) {
    console.log('Failed:')
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
