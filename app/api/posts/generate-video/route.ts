import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isVideoGenerationEnabled } from '@/lib/posts/videoGenerationFlag'
import { assertGenerationFloor } from '@/lib/foundation/sectionStrength'
import { deductCredits } from '@/lib/credits'
import { logProviderError, sanitizeUserFacingError } from '@/lib/agents/sanitizeProviderError'
import { createServiceClient } from '@/lib/supabase/server'
import { buildFoundationSnapshotMarkdown } from '@/lib/agents/imageGeneration/foundationSnapshot'
import { composeVideoBrief } from '@/lib/agents/videoGeneration/briefComposeVideo'
import { resolveVideoModel } from '@/lib/agents/videoGeneration/videoModelCatalog'
import { submitVideoJob } from '@/lib/agents/videoGeneration/openRouterVideo'

export const maxDuration = 60

export const GENERATION_VIDEO_CREDIT_COST = 40

type Body = {
  postGoal?: string
  platform?: string
  offer?: string
  audience?: string
  sceneDirection?: string
  videoModelId?: string
}

export async function POST(req: Request) {
  if (!isVideoGenerationEnabled()) {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 404 })
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, plan, company_name')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (!profile.plan) {
    return NextResponse.json({ error: 'active_plan_required' }, { status: 403 })
  }

  // Foundation floor gate — same 70% floor as image generation
  const floor = await assertGenerationFloor(profile.id)
  if (!floor.ok) {
    return NextResponse.json(
      {
        error: 'foundation_floor',
        reason: floor.reason,
        section: floor.section,
        score: floor.score,
        floor: floor.floor,
        route: floor.route,
        message: floor.message,
        weakField: floor.weakField ?? null,
      },
      { status: 403 },
    )
  }

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    body = {}
  }

  if (!body.postGoal?.trim()) {
    return NextResponse.json(
      {
        error: 'post_goal_required',
        message: 'Choose a post goal before generating a video.',
      },
      { status: 422 },
    )
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'openrouter_not_configured' }, { status: 503 })
  }

  const profileId = profile.id as string
  const companyName = (profile.company_name as string | null) ?? 'your business'
  const modelEntry = resolveVideoModel(body.videoModelId)

  // ── Step 1: Compose brief (no side effects — fail early) ─────────────────
  let brief: string
  try {
    const foundationMarkdown = await buildFoundationSnapshotMarkdown(profileId, companyName)
    brief = await composeVideoBrief({
      foundationMarkdown,
      companyName,
      postGoal: body.postGoal,
      platform: body.platform,
      offer: body.offer,
      audience: body.audience,
      sceneDirection: body.sceneDirection,
    })
  } catch (err) {
    logProviderError('generate-video brief-compose', err)
    return NextResponse.json(
      {
        error: 'brief_failed',
        message: sanitizeUserFacingError(
          err instanceof Error ? err.message : 'brief_failed',
          'video_generation',
        ),
      },
      { status: 502 },
    )
  }

  // ── Step 2: Submit OpenRouter job (before task creation or credit deduction) ──
  let jobResult: { id: string; status: string }
  try {
    jobResult = await submitVideoJob({
      model: modelEntry.openRouterModel,
      prompt: brief,
      aspectRatio: modelEntry.aspectRatio,
      duration: modelEntry.durationSeconds,
    })
  } catch (err) {
    logProviderError('generate-video submit', err)
    return NextResponse.json(
      {
        error: 'submit_failed',
        message: sanitizeUserFacingError(
          err instanceof Error ? err.message : 'video_submit_failed',
          'video_generation',
        ),
      },
      { status: 502 },
    )
  }

  // ── Step 3: Create agent_task record (job already submitted) ─────────────
  const taskInput = {
    profileId,
    postGoal: body.postGoal,
    platform: body.platform ?? null,
    offer: body.offer ?? null,
    audience: body.audience ?? null,
    brief_excerpt: brief.slice(0, 200),
    video_model: modelEntry.openRouterModel,
    video_job_id: jobResult.id,
  }

  const { data: task, error: taskError } = await supabase
    .from('agent_tasks')
    .insert({
      user_id:          profileId,
      agent:            'video_generation',
      job_type:         'video_generate',
      input:            taskInput,
      status:           'running',
      started_at:       new Date().toISOString(),
      trigger_type:     'user',
      priority:         'normal',
      requires_approval: true,
    })
    .select('id')
    .single()

  if (taskError || !task) {
    logProviderError('generate-video task-create', taskError)
    // Job was submitted — log for manual reconciliation but don't surface internals
    return NextResponse.json(
      {
        error: 'task_create_failed',
        message: 'We couldn\'t save your video job right now. Please try again in a few minutes.',
      },
      { status: 500 },
    )
  }

  const taskId = task.id as string

  // ── Step 4: Deduct credits (after task exists so ledger row is linked) ───
  try {
    await deductCredits(
      profileId,
      GENERATION_VIDEO_CREDIT_COST,
      `Video generation — ${modelEntry.label}`,
      taskId,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'deduct_failed'
    if (msg === 'INSUFFICIENT_CREDITS') {
      // Mark task failed and surface a clear error
      await supabase
        .from('agent_tasks')
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', taskId)
      return NextResponse.json(
        {
          error: 'insufficient_credits',
          message: `Video generation costs ${GENERATION_VIDEO_CREDIT_COST} credits. Top up your credits to continue.`,
        },
        { status: 402 },
      )
    }
    logProviderError('generate-video deduct-credits', err)
    // Non-credit error — task running, video job submitted; credit issue logged
  }

  return NextResponse.json({
    jobId: jobResult.id,
    taskId,
    model: modelEntry.label,
    status: 'pending',
    message: 'Your video is generating. We\'ll notify you when it\'s ready to review — usually 2–5 minutes.',
  })
}
