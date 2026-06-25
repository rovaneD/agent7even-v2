import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isVideoGenerationEnabled } from '@/lib/posts/videoGenerationFlag'
import { assertGenerationFloor } from '@/lib/foundation/sectionStrength'
import { deductCredits, refundCredits } from '@/lib/credits'
import { videoCreditCost } from '@/lib/credits/actionCosts'
import { logProviderError, sanitizeUserFacingError } from '@/lib/agents/sanitizeProviderError'
import { createServiceClient } from '@/lib/supabase/server'
import {
  formatCreativeDirectionBlock,
  getOrComputeCreativeDirection,
} from '@/lib/agents/foundationCreativeDirection'
import { formatPostContextBriefBlock } from '@/lib/agents/imageGeneration/postContextBrief'
import { postGroundingFromForm } from '@/lib/agents/imageGeneration/postGrounding'
import { composeVideoBrief } from '@/lib/agents/videoGeneration/briefComposeVideo'
import { resolveVideoModel } from '@/lib/agents/videoGeneration/videoModelCatalog'
import { submitVideoJob } from '@/lib/agents/videoGeneration/openRouterVideo'

export const maxDuration = 60

type Body = {
  postGoal?: string
  platform?: string
  offer?: string
  audience?: string
  mustInclude?: string
  mustAvoid?: string
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
  const videoCost = videoCreditCost(modelEntry.id, profile.plan as string | null)
  if (videoCost < 0) {
    return NextResponse.json(
      {
        error: 'premium_plan_required',
        message: 'Premium video models are available on ProAgent.',
      },
      { status: 403 },
    )
  }

  const postForm: Record<string, string> = {
    postGoal: body.postGoal ?? '',
    platform: body.platform ?? '',
    offer: body.offer ?? '',
    audience: body.audience ?? '',
    mustInclude: body.mustInclude ?? '',
    mustAvoid: body.mustAvoid ?? '',
  }
  const postContext = postGroundingFromForm(postForm)
  const postContextBlock = formatPostContextBriefBlock(postForm, 'video')

  // ── Step 1: Creative Direction → video brief (no side effects — fail early) ─
  let brief: string
  try {
    const creativeDirection = await getOrComputeCreativeDirection({
      profileId,
      companyName,
    })
    const creativeDirectionBlock = formatCreativeDirectionBlock(creativeDirection, companyName)

    brief = await composeVideoBrief({
      creativeDirectionBlock,
      companyName,
      postContext,
      postContextBlock,
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

  // ── Step 2: Create task before any paid provider side effect ────────────
  const taskInput = {
    profileId,
    postGoal: body.postGoal,
    platform: body.platform ?? null,
    offer: body.offer ?? null,
    audience: body.audience ?? null,
    brief_excerpt: brief.slice(0, 200),
    video_model: modelEntry.openRouterModel,
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
    return NextResponse.json(
      {
        error: 'task_create_failed',
        message: 'We couldn\'t save your video job right now. Please try again in a few minutes.',
      },
      { status: 500 },
    )
  }

  const taskId = task.id as string

  // ── Step 3: Reserve credits before submitting the paid OpenRouter job ───
  try {
    await deductCredits(
      profileId,
      videoCost,
      `Video generation — ${modelEntry.label}`,
      taskId,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'deduct_failed'
    await supabase
      .from('agent_tasks')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', taskId)

    if (msg === 'INSUFFICIENT_CREDITS') {
      return NextResponse.json(
        {
          error: 'insufficient_credits',
          message: `Video generation costs ${videoCost} media credits. Top up your credits to continue.`,
        },
        { status: 402 },
      )
    }
    logProviderError('generate-video deduct-credits', err)
    return NextResponse.json(
      {
        error: 'credit_reservation_failed',
        message: 'We could not reserve credits for this video. Please try again in a few minutes.',
      },
      { status: 500 },
    )
  }

  // ── Step 4: Submit OpenRouter job only after the ledger reservation ──────
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
    await refundCredits(
      profileId,
      videoCost,
      `Video generation — ${modelEntry.label} submit failed refund`,
      taskId,
    ).catch(refundErr => logProviderError('generate-video submit-refund', refundErr))
    await supabase
      .from('agent_tasks')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', taskId)
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

  const { error: jobAttachError } = await supabase
    .from('agent_tasks')
    .update({
      input: {
        ...taskInput,
        video_job_id: jobResult.id,
      },
    })
    .eq('id', taskId)

  if (jobAttachError) {
    logProviderError('generate-video attach-job', jobAttachError)
    await refundCredits(
      profileId,
      videoCost,
      `Video generation — ${modelEntry.label} attach failed refund`,
      taskId,
    ).catch(refundErr => logProviderError('generate-video attach-refund', refundErr))
    await supabase
      .from('agent_tasks')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', taskId)
    return NextResponse.json(
      {
        error: 'task_update_failed',
        message: 'We could not save your video job right now. Please try again in a few minutes.',
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    jobId: jobResult.id,
    taskId,
    model: modelEntry.label,
    status: 'pending',
    message: 'Your video is generating. We\'ll notify you when it\'s ready to review — usually 2–5 minutes.',
  })
}
