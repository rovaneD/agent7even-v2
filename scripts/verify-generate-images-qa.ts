/**
 * Verify POST /api/posts/generate-images/qa (handoff §9 step 4).
 * Usage:
 *   npx --yes tsx --env-file=.env.local scripts/verify-generate-images-qa.ts
 *   npx --yes tsx --env-file=.env.local scripts/verify-generate-images-qa.ts --storage-path <profileId>/...
 *
 * Default: auth + invalid path checks only (no vision spend).
 */
import { createClient } from '@supabase/supabase-js'
import { appUrl, assertFlagOn, findProfileWithValidClerkJwt, getClerkJwt } from './verify-generate-images-lib'

const storagePathArg = process.argv.find((_, i, a) => a[i - 1] === '--storage-path')

async function postQa(jwt: string, body: Record<string, unknown>) {
  const res = await fetch(`${appUrl}/api/posts/generate-images/qa`, {
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

  if (!assertFlagOn()) process.exit(0)

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  console.log('--- resolving profile with valid Clerk user ---')
  const profile = await findProfileWithValidClerkJwt(sb)
  console.log(`  using: ${profile.company_name ?? profile.id}\n`)

  const jwt = await getClerkJwt(profile.clerk_user_id)

  console.log('--- missing storagePath (expect 400) ---')
  const badBody = await postQa(jwt, {})
  console.log(`  HTTP ${badBody.status}`)
  if (badBody.status !== 400) {
    console.error('FAIL: expected 400')
    process.exit(1)
  }
  console.log('  PASS\n')

  console.log('--- wrong profile path (expect 403) ---')
  const wrongPath = await postQa(jwt, { storagePath: '00000000-0000-0000-0000-000000000000/fake.png' })
  console.log(`  HTTP ${wrongPath.status}`)
  if (wrongPath.status !== 403) {
    console.error('FAIL: expected 403')
    process.exit(1)
  }
  console.log('  PASS\n')

  if (storagePathArg) {
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY required for live QA')
      process.exit(1)
    }
    console.log(`--- live QA: ${storagePathArg} ---`)
    const t0 = Date.now()
    const live = await postQa(jwt, { storagePath: storagePathArg })
    console.log(`  HTTP ${live.status} (${Math.round((Date.now() - t0) / 1000)}s)`)
    console.log(`  body: ${JSON.stringify(live.json, null, 2)}`)
    if (live.status !== 200 && live.status !== 422) {
      console.error('FAIL: expected 200 (pass) or 422 (fail)')
      process.exit(1)
    }
    console.log('  PASS')
    return
  }

  console.log('Gate checks passed. Pass --storage-path <profileId>/... for live vision QA.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
