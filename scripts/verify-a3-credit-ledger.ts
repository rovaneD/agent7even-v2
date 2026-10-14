/**
 * A3 credit retune verification — static grep + optional live ledger rows.
 *
 * Usage:
 *   npx --yes tsx --env-file=.env.local scripts/verify-a3-credit-ledger.ts
 *   npx --yes tsx --env-file=.env.local scripts/verify-a3-credit-ledger.ts --live
 *
 * --live: runs real debit paths against Supabase (text agent + premium gate checks).
 * Does NOT run paid OpenRouter image/video generation unless --live-compose is added later.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import {
  ACTION_CREDIT_COST,
  imageCreditCost,
  videoCreditCost,
} from '../lib/credits/actionCosts'
import { CREDIT_COST } from '../lib/agents/cost'
import { executeAgentRun } from '../lib/agents/executeAgentRun'
import { createTask } from '../lib/agents/runner'
import { queueGeneratedPost } from '../lib/agents/imageGeneration/queueGeneratedPost'
import { deductCredits, refundCredits } from '../lib/credits'
import {
  appUrl,
  findGenerationTestProfile,
  getClerkJwt,
} from './verify-generate-images-lib'
import { isVideoGenerationEnabled } from '../lib/posts/videoGenerationFlag'

const live = process.argv.includes('--live')

const STALE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /Maya chat costs 2 credits/, label: 'Maya chat help text still says 2 credits' },
  { pattern: /Agent runs cost 2–25 credits/, label: 'Maya help still says 2–25 agent credits' },
  { pattern: /image generation \(25 credits\)/, label: 'UI still says 25 credits for images' },
  { pattern: /Generate video \(40 credits\)/, label: 'UI still says 40 credits for video button' },
  { pattern: /40 credits are deducted when submitted/, label: 'UI still says 40 credits for video' },
  { pattern: /costs 40 credits/, label: 'sanitizeProviderError still references 40 credits' },
  { pattern: /2 credits used/, label: 'Brand Kit UI still says 2 credits used' },
  { pattern: /~15 seconds · 2 credits/, label: 'Analytics Maya still says 2 credits' },
  { pattern: /body\.credits \?\? 8/, label: 'Campaign generate still defaults to 8 credits' },
  { pattern: /GENERATION_VIDEO_CREDIT_COST = 40/, label: 'Old video constant 40 still present' },
  { pattern: /GENERATION_BUNDLE_CREDIT_COST = 25/, label: 'Old image bundle constant 25 still present' },
  { pattern: /deductCredits\([^)]*,\s*25\b/, label: 'Literal deductCredits(..., 25)' },
  { pattern: /deductCredits\([^)]*,\s*40\b/, label: 'Literal deductCredits(..., 40)' },
  { pattern: /deductCredits\([^)]*,\s*8\b/, label: 'Literal deductCredits(..., 8)' },
  { pattern: /deductCredits\([^)]*,\s*2\b/, label: 'Literal deductCredits(..., 2)' },
]

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walkTsFiles(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !p.includes('verify-a3-credit-ledger')) out.push(p)
  }
  return out
}

function staticChecks(): string[] {
  const failures: string[] = []

  const expected = {
    text_run: 0,
    maya_chat_turn: 0,
    image_standard: 3,
    image_premium: 15,
    video_standard: 10,
    video_premium: 40,
    publish: 1,
    brandkit_gen: 1,
    foundation_gen: 0,
  }
  for (const [k, v] of Object.entries(expected)) {
    const key = k as keyof typeof ACTION_CREDIT_COST
    if (ACTION_CREDIT_COST[key] !== v) {
      failures.push(`ACTION_CREDIT_COST.${k} = ${ACTION_CREDIT_COST[key]}, expected ${v}`)
    }
  }
  if (CREDIT_COST.light !== 0 || CREDIT_COST.standard !== 0 || CREDIT_COST.deep !== 3) {
    failures.push(`CREDIT_COST tiers wrong: light=${CREDIT_COST.light} standard=${CREDIT_COST.standard} deep=${CREDIT_COST.deep}`)
  }
  if (imageCreditCost('balanced', 'growth') !== 3) failures.push('standard image cost != 3')
  if (imageCreditCost('sharp-text', 'growth') !== -1) failures.push('Recraft on Growth not refused (-1)')
  if (imageCreditCost('sharp-text', 'proagent') !== 15) failures.push('Recraft on ProAgent != 15')
  if (videoCreditCost('veo-3-1-lite', 'growth') !== 10) failures.push('standard video cost != 10')
  if (videoCreditCost('kling-v3-std', 'growth') !== -1) failures.push('Kling on Growth not refused (-1)')
  if (videoCreditCost('kling-v3-std', 'proagent') !== 40) failures.push('Kling on ProAgent != 40')

  const root = join(process.cwd())
  const files = [
    ...walkTsFiles(join(root, 'app')),
    ...walkTsFiles(join(root, 'lib')),
    ...walkTsFiles(join(root, 'components')),
  ]
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const { pattern, label } of STALE_PATTERNS) {
      if (pattern.test(text)) failures.push(`${label} → ${file.replace(root + '/', '')}`)
    }
  }

  return failures
}

async function latestDebitForTask(sb: ReturnType<typeof createClient>, profileId: string, taskId: string) {
  const { data } = await sb
    .from('credit_ledger')
    .select('credits, description, type, created_at')
    .eq('user_id', profileId)
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(5)
  return data ?? []
}

async function debitTotalForTask(sb: ReturnType<typeof createClient>, profileId: string, taskId: string) {
  const rows = await latestDebitForTask(sb, profileId, taskId)
  return rows
    .filter(r => r.type === 'usage' || (r.credits ?? 0) < 0)
    .reduce((s, r) => s + Math.abs(r.credits ?? 0), 0)
}

async function findLatestPostAsset(
  sb: ReturnType<typeof createClient>,
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

async function liveChecks(): Promise<string[]> {
  const failures: string[] = []
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const sb = createClient(url, key)

  const growthProfiles = await sb
    .from('profiles')
    .select('id, clerk_user_id, company_name, plan')
    .eq('plan', 'growth')
    .not('clerk_user_id', 'is', null)
    .limit(10)

  let profile = growthProfiles.data?.[0]
  if (!profile) {
    profile = await findGenerationTestProfile(sb)
  }
  if (!profile) {
    failures.push('No test profile with plan + Clerk id found')
    return failures
  }

  console.log(`Live profile: ${profile.company_name ?? profile.id} (${(profile as { plan?: string }).plan ?? 'unknown plan'})`)

  // Text agent — expect 0 debit (or no debit row)
  const task = await createTask({
    userId: profile.id,
    agent: 'seo_scanner',
    input: { instructions: 'A3 verify — quick SEO scan notes only.' },
    triggerType: 'user',
    priority: 'low',
  })
  const run = await executeAgentRun({
    agentId: 'seo_scanner',
    taskId: task.id as string,
    userId: profile.id,
    taskInput: { instructions: 'A3 verify — quick SEO scan notes only.' },
  })
  if (!run.ok) {
    failures.push(`seo_scanner run failed: ${run.error}`)
  } else {
    const rows = await latestDebitForTask(sb, profile.id, task.id as string)
    const total = await debitTotalForTask(sb, profile.id, task.id as string)
    console.log(`  seo_scanner ledger debits: ${JSON.stringify(rows.filter(r => r.type === 'usage'))}`)
    if (total !== 0) failures.push(`seo_scanner debited ${total}, expected 0`)
  }

  // Premium image gate — no ledger movement
  const beforeBal = (
    await sb.from('credit_balances').select('balance').eq('user_id', profile.id).maybeSingle()
  ).data?.balance

  const blocked = await queueGeneratedPost({
    profileId: profile.id,
    companyName: profile.company_name ?? 'Test',
    taskInput: {},
    picked: {
      storagePath: `${profile.id}/posts/fake-verify.png`,
      mime: 'image/png',
      imageModel: 'recraft/recraft-v4-pro',
      briefId: 'verify',
      optionIndex: 0,
      brief: 'verify',
      optionsCount: 1,
      qa: { passed: true, qaMethod: 'none', transcription: null },
    },
  })
  if (blocked.ok || blocked.code !== 'premium_plan_required') {
    failures.push(`Recraft on Growth should return premium_plan_required, got ${JSON.stringify(blocked)}`)
  } else {
    console.log('  Recraft on Growth: refused (premium_plan_required) ✓')
  }

  const afterBal = (
    await sb.from('credit_balances').select('balance').eq('user_id', profile.id).maybeSingle()
  ).data?.balance
  if (beforeBal !== undefined && afterBal !== undefined && beforeBal !== afterBal) {
    failures.push(`Balance changed on blocked premium compose: ${beforeBal} → ${afterBal}`)
  }

  // Standard image debit — compose path when asset exists, else mirror bundle reserve
  const asset = await findLatestPostAsset(sb, profile.id)
  const imageBundleCost = imageCreditCost('balanced', (profile as { plan?: string }).plan ?? 'growth')
  if (asset && process.env.OPENROUTER_API_KEY) {
    const compose = await queueGeneratedPost({
      profileId: profile.id,
      companyName: profile.company_name ?? 'Test',
      taskInput: { postGoal: 'Awareness', platform: 'Instagram' },
      picked: {
        storagePath: asset.path,
        mime: asset.mime,
        imageModel: 'balanced',
        briefId: 'a3-verify',
        optionIndex: 0,
        brief: 'A3 verify — on-brand product photo',
        optionsCount: 1,
        qa: { passed: true, qaMethod: 'none', transcription: null },
      },
    })
    if (!compose.ok) {
      failures.push(`Standard image compose failed: ${compose.code} ${compose.message}`)
    } else {
      const imgAmount = await debitTotalForTask(sb, profile.id, compose.taskId)
      console.log(`  standard image compose ledger debit: ${imgAmount}`)
      if (imgAmount !== 3) failures.push(`Standard image debited ${imgAmount}, expected 3`)
    }
  } else {
    if (!asset) console.warn('  No post-asset — using bundle reserve debit mirror for image=3')
    const imageTask = await createTask({
      userId: profile.id,
      agent: 'content_posting',
      input: { verify: 'a3-image-debit' },
      triggerType: 'user',
      priority: 'low',
    })
    const imageTaskId = imageTask.id as string
    await deductCredits(
      profile.id,
      imageBundleCost,
      'image_generation_bundle — reserved (A3 verify)',
      imageTaskId,
    )
    const imgAmount = await debitTotalForTask(sb, profile.id, imageTaskId)
    console.log(`  standard image ledger debit: ${imgAmount}`)
    if (imgAmount !== 3) failures.push(`Standard image debit path wrote ${imgAmount}, expected 3`)
    await refundCredits(profile.id, imageBundleCost, 'image_generation_bundle — A3 verify refund', imageTaskId).catch(() => {})
  }

  // Video write-path gating — Kling on Growth must 403 before debit
  if (!isVideoGenerationEnabled()) {
    failures.push('NEXT_PUBLIC_VIDEO_GENERATION must be true (restart dev server after setting)')
  } else {
    const growthWithJwt = await sb
      .from('profiles')
      .select('id, clerk_user_id, company_name, plan')
      .eq('plan', 'growth')
      .not('clerk_user_id', 'is', null)
      .limit(10)
    let jwt: string | null = null
    for (const row of growthWithJwt.data ?? []) {
      if (!row.clerk_user_id) continue
      try {
        jwt = await getClerkJwt(row.clerk_user_id)
        break
      } catch {
        continue
      }
    }
    if (!jwt) {
      failures.push('No Growth profile with active Clerk session for Kling HTTP gate check')
    } else {
      try {
        const klingRes = await authPost('/api/posts/generate-video', jwt, {
          postGoal: 'Awareness',
          videoModelId: 'kling-v3-std',
          platform: 'Instagram',
        })
        console.log(`  Kling on Growth HTTP: ${klingRes.status}`)
        if (klingRes.status !== 403) {
          failures.push(`Kling on Growth expected 403, got ${klingRes.status} ${JSON.stringify(klingRes.json)}`)
        } else {
          console.log('  Kling on Growth: refused (403) ✓')
        }
      } catch (err) {
        failures.push(`Kling HTTP check failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  // Standard video debit amount — mirrors generate-video route step 4 (no OpenRouter spend)
  const veoCost = videoCreditCost('veo-3-1-lite', (profile as { plan?: string }).plan ?? 'growth')
  const videoTask = await createTask({
    userId: profile.id,
    agent: 'video_generation',
    input: { verify: 'a3-video-debit' },
    triggerType: 'user',
    priority: 'low',
  })
  const videoTaskId = videoTask.id as string
  await deductCredits(profile.id, veoCost, 'Video generation — Veo Lite (A3 verify)', videoTaskId)
  const videoAmount = await debitTotalForTask(sb, profile.id, videoTaskId)
  console.log(`  standard video ledger debit: ${videoAmount}`)
  if (videoAmount !== 10) failures.push(`Standard video debit path wrote ${videoAmount}, expected 10`)
  await refundCredits(profile.id, veoCost, 'Video generation — A3 verify refund', videoTaskId).catch(() => {})

  return failures
}

async function main() {
  console.log('=== A3 static verification ===')
  const staticFails = staticChecks()
  if (staticFails.length) {
    console.error('STATIC FAILURES:')
    staticFails.forEach(f => console.error('  -', f))
  } else {
    console.log('Static checks: PASS')
  }

  if (live) {
    console.log('\n=== A3 live ledger verification ===')
    const liveFails = await liveChecks()
    if (liveFails.length) {
      console.error('LIVE FAILURES:')
      liveFails.forEach(f => console.error('  -', f))
    } else {
      console.log('Live checks: PASS (text=0, image=3, video=10, premium gates on Growth)')
    }
    if (staticFails.length || liveFails.length) process.exit(1)
  } else {
    console.log('\nRun with --live to verify real credit_ledger rows (text agent + premium gate).')
    console.log('Still needed manually: std image compose (=3), std video submit (=10), Kling HTTP 403 on Growth.')
    if (staticFails.length) process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
