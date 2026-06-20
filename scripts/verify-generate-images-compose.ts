/**
 * Verify POST /api/posts/generate-images/compose (handoff §9 steps 5–7).
 * Usage:
 *   npx --yes tsx --env-file=.env.local scripts/verify-generate-images-compose.ts
 */
import { createClient } from '@supabase/supabase-js'
import { appUrl, assertFlagOn, findProfileWithValidClerkJwt, getClerkJwt } from './verify-generate-images-lib'

async function postCompose(jwt: string | null, body: Record<string, unknown>) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (jwt) headers.Authorization = `Bearer ${jwt}`
  const res = await fetch(`${appUrl}/api/posts/generate-images/compose`, {
    method: 'POST',
    redirect: 'manual',
    headers,
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

  if (!assertFlagOn()) process.exit(0)

  console.log('--- unauthenticated (expect 401 or 307 middleware redirect) ---')
  const unauth = await postCompose(null, {})
  console.log(`  HTTP ${unauth.status}`)
  if (unauth.status !== 401 && unauth.status !== 307) {
    console.error('FAIL: expected 401 or 307')
    process.exit(1)
  }
  console.log('  PASS\n')

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  console.log('--- resolving profile with valid Clerk user ---')
  const profile = await findProfileWithValidClerkJwt(sb)
  console.log(`  using: ${profile.company_name ?? profile.id}\n`)

  const jwt = await getClerkJwt(profile.clerk_user_id)

  console.log('--- missing required fields (expect 400) ---')
  const badBody = await postCompose(jwt, {})
  console.log(`  HTTP ${badBody.status}`)
  if (badBody.status !== 400) {
    console.error('FAIL: expected 400')
    process.exit(1)
  }
  console.log('  PASS\n')

  console.log('--- qa not passed (expect 400) ---')
  const qaFail = await postCompose(jwt, {
    briefId: '00000000-0000-0000-0000-000000000001',
    optionIndex: 0,
    storagePath: `${profile.id}/fake.png`,
    mime: 'image/png',
    imageModel: 'google/gemini-2.5-flash-image',
    qa: { passed: false, transcription: null, issues: [], qaMethod: 'vision_readback' },
  })
  console.log(`  HTTP ${qaFail.status}`)
  if (qaFail.status !== 400) {
    console.error('FAIL: expected 400')
    process.exit(1)
  }
  console.log('  PASS\n')

  console.log('--- wrong profile storage path (expect 403) ---')
  const wrongPath = await postCompose(jwt, {
    briefId: '00000000-0000-0000-0000-000000000001',
    optionIndex: 0,
    storagePath: '00000000-0000-0000-0000-000000000000/fake.png',
    mime: 'image/png',
    imageModel: 'google/gemini-2.5-flash-image',
    qa: { passed: true, transcription: null, issues: [], qaMethod: 'vision_readback' },
  })
  console.log(`  HTTP ${wrongPath.status}`)
  if (wrongPath.status !== 403) {
    console.error('FAIL: expected 403')
    process.exit(1)
  }
  console.log('  PASS\n')

  console.log('Compose gate checks passed.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
