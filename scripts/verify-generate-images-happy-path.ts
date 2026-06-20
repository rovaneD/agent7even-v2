/**
 * End-to-end verification: QA-passed image → compose → pending_approval in queue.
 *
 * Usage:
 *   npx --yes tsx --env-file=.env.local scripts/verify-generate-images-happy-path.ts
 *   npx --yes tsx --env-file=.env.local scripts/verify-generate-images-happy-path.ts --live
 *   npx --yes tsx --env-file=.env.local scripts/verify-generate-images-happy-path.ts --full
 *
 * Default: gate + approvals API shape checks (no OpenRouter spend).
 * --live: uses newest post-asset for a valid profile, runs QA + compose (25 credits + API cost).
 * --full: generate 3 options + QA option 0 + compose (slow, highest cost).
 */
import { randomUUID } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  appUrl,
  assertFlagOn,
  findGenerationTestProfile,
  findProfileWithValidClerkJwt,
  getClerkJwt,
} from './verify-generate-images-lib'

const live = process.argv.includes('--live')
const full = process.argv.includes('--full')

async function authPost(path: string, jwt: string, body: Record<string, unknown>) {
  const res = await fetch(`${appUrl}${path}`, {
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
    json = text.slice(0, 300)
  }
  return { status: res.status, json }
}

async function authGet(path: string, jwt: string) {
  const res = await fetch(`${appUrl}${path}`, {
    redirect: 'manual',
    headers: { Authorization: `Bearer ${jwt}` },
  })
  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    json = text.slice(0, 300)
  }
  return { status: res.status, json }
}

async function findProfileWithPostAsset(
  sb: SupabaseClient,
): Promise<{
  profile: { id: string; clerk_user_id: string; company_name: string | null }
  asset: { path: string; mime: string }
} | null> {
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, clerk_user_id, company_name, plan')
    .not('clerk_user_id', 'is', null)
    .not('plan', 'is', null)
    .order('foundation_score', { ascending: false, nullsFirst: false })
    .limit(30)

  if (!profiles?.length) return null

  for (const profile of profiles) {
    if (!profile.clerk_user_id) continue
    try {
      await getClerkJwt(profile.clerk_user_id)
    } catch {
      continue
    }
    const asset = await findLatestPostAsset(sb, profile.id)
    if (asset) {
      return {
        profile: profile as { id: string; clerk_user_id: string; company_name: string | null },
        asset,
      }
    }
  }
  return null
}

async function findLatestPostAsset(
  sb: SupabaseClient,
  profileId: string,
): Promise<{ path: string; mime: string } | null> {
  const { data, error } = await sb.storage.from('post-assets').list(profileId, {
    limit: 100,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (error || !data?.length) return null

  for (const row of data) {
    if (!row.name || row.name.endsWith('/')) continue
    const path = `${profileId}/${row.name}`
    const mime = row.metadata?.mimetype as string | undefined
    if (mime?.startsWith('image/')) return { path, mime }
    if (/\.(png|jpe?g|webp)$/i.test(row.name)) {
      return {
        path,
        mime: row.name.endsWith('.png')
          ? 'image/png'
          : row.name.endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg',
      }
    }
  }
  return null
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

  console.log('--- profile + JWT ---')
  let profile = full
    ? await findGenerationTestProfile(sb)
    : await findProfileWithValidClerkJwt(sb)
  console.log(`  profile: ${profile.company_name ?? profile.id}`)
  let jwt = await getClerkJwt(profile.clerk_user_id)
  console.log('  JWT minted\n')

  console.log('--- approvals API reachable (authenticated) ---')
  const approvals = await authGet('/api/agents/approvals', jwt)
  console.log(`  HTTP ${approvals.status}`)
  if (approvals.status !== 200) {
    console.error('FAIL: expected approvals API 200')
    console.error(JSON.stringify(approvals.json, null, 2))
    process.exit(1)
  }
  const tasks = (approvals.json as { tasks?: unknown[] })?.tasks ?? []
  console.log(`  pending tasks: ${tasks.length}`)
  console.log('  PASS\n')

  if (!live && !full) {
    console.log('Gate + approvals API checks passed.')
    console.log('Run with --live to QA + compose using the newest post-asset (costs credits + OpenRouter).')
    console.log('Run with --full to generate 3 options first (slow, highest cost).')
    console.log('Manual UI: Agents → Single post → Generate → Pick → QA pass → Submit for approval.')
    return
  }

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY required for --live / --full')
    process.exit(1)
  }

  let asset: { path: string; mime: string } | null = null
  let briefId = randomUUID()
  let optionIndex = 0
  let brief = 'Verification run — professional social post for small business owners.'
  let imageModel = 'google/gemini-2.5-flash-image'
  let optionsCount = 3

  if (full) {
    console.log(`--- foundation floor: ALLOWED (${profile.company_name ?? profile.id}) ---`)
    console.log('--- generate 3 options (may take 30–120s) ---')
    const t0 = Date.now()
    const genRes = await authPost('/api/posts/generate-images', jwt, {
      sceneDirection: 'Happy path verification — professional Instagram post for small business owners.',
    })
    console.log(`  HTTP ${genRes.status} (${Math.round((Date.now() - t0) / 1000)}s)`)
    if (genRes.status !== 200) {
      console.error(JSON.stringify(genRes.json, null, 2))
      process.exit(1)
    }
    const gen = genRes.json as {
      briefId?: string
      options?: Array<{ index: number; storagePath: string; mime: string; brief: string; model: string }>
    }
    const opt = gen.options?.[0]
    if (!gen.briefId || !opt) {
      console.error('FAIL: generate returned no options')
      process.exit(1)
    }
    briefId = gen.briefId
    optionIndex = opt.index
    brief = opt.brief
    imageModel = opt.model
    optionsCount = gen.options?.length ?? 3
    asset = { path: opt.storagePath, mime: opt.mime }
    console.log(`  option 0: ${asset.path}\n`)
  } else {
    const found = await findProfileWithPostAsset(sb)
    if (!found) {
      console.error('FAIL: no post-assets on any valid profile — run with --full or generate in UI first')
      process.exit(1)
    }
    profile = found.profile
    asset = found.asset
    console.log(`--- using post-asset from ${profile.company_name ?? profile.id} ---`)
    console.log(`  ${asset.path}\n`)
    jwt = await getClerkJwt(profile.clerk_user_id)
  }

  if (!asset) {
    console.error('FAIL: no asset to verify')
    process.exit(1)
  }
  console.log(`--- live QA: ${asset.path} ---`)
  const qaRes = await authPost('/api/posts/generate-images/qa', jwt, { storagePath: asset.path })
  console.log(`  HTTP ${qaRes.status}`)
  console.log(`  body: ${JSON.stringify(qaRes.json, null, 2)}`)
  if (qaRes.status !== 200 && qaRes.status !== 422) {
    console.error('FAIL: expected QA 200 or 422')
    process.exit(1)
  }
  const qa = (qaRes.json as { qa?: { passed: boolean; transcription?: string | null; issues?: unknown[]; qaMethod: string } }).qa
  if (!qa) {
    console.error('FAIL: missing qa in response')
    process.exit(1)
  }
  if (!qa.passed) {
    console.log('  SKIP compose — QA failed on stored asset (pick another or regenerate in UI)')
    process.exit(0)
  }
  console.log('  QA PASS\n')

  const briefIdFinal = briefId
  console.log('--- live compose ---')
  const composeRes = await authPost('/api/posts/generate-images/compose', jwt, {
    briefId: briefIdFinal,
    optionIndex,
    brief,
    storagePath: asset.path,
    mime: asset.mime,
    imageModel,
    optionsCount,
    qa,
    platform: 'Instagram',
    postGoal: 'Awareness',
    instructions: 'Verification compose run from verify-generate-images-happy-path.ts',
    priority: 'normal',
  })
  console.log(`  HTTP ${composeRes.status}`)
  console.log(`  body: ${JSON.stringify(composeRes.json, null, 2)}`)
  if (composeRes.status !== 200) {
    console.error('FAIL: expected compose 200')
    process.exit(1)
  }

  const { taskId, outputId } = composeRes.json as { taskId?: string; outputId?: string }
  if (!taskId || !outputId) {
    console.error('FAIL: missing taskId/outputId')
    process.exit(1)
  }

  const { data: output } = await sb
    .from('agent_outputs')
    .select('id, status, content, task_id')
    .eq('id', outputId)
    .single()

  console.log('\n--- DB: agent_outputs ---')
  console.log(`  status: ${output?.status}`)
  const content = output?.content as Record<string, unknown> | undefined
  console.log(`  media_storage_path: ${content?.media_storage_path ?? '(missing)'}`)
  console.log(`  generated.qa_passed: ${(content?.generated as Record<string, unknown> | undefined)?.qa_passed}`)
  if (output?.status !== 'pending_approval') {
    console.error('FAIL: expected pending_approval')
    process.exit(1)
  }
  if (content?.media_storage_path !== asset.path) {
    console.error('FAIL: media path mismatch')
    process.exit(1)
  }
  console.log('  PASS\n')

  const approvalsAfter = await authGet('/api/agents/approvals', jwt)
  const listed = ((approvalsAfter.json as { tasks?: Array<{ id: string }> }).tasks ?? []).some(
    t => t.id === taskId,
  )
  console.log('--- approvals queue contains task ---')
  console.log(`  listed: ${listed}`)
  if (!listed) {
    console.error('FAIL: task not in approvals API response')
    process.exit(1)
  }
  console.log('  PASS\n')

  console.log(`=== Happy path passed — review in UI: ${appUrl}/dashboard/agents/approvals?task=${taskId} ===`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
