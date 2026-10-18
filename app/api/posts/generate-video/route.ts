import { NextResponse } from 'next/server'
import { resolvePostsWorkspace } from '@/lib/profiles/resolvePostsWorkspace'
import { isVideoGenerationEnabled } from '@/lib/posts/videoGenerationFlag'
import { assertGenerationFloor } from '@/lib/foundation/sectionStrength'
import { deductCredits } from '@/lib/credits'
import { logProviderError, sanitizeUserFacingError } from '@/lib/agents/sanitizeProviderError'
import { createServiceClient } from '@/lib/supabase/server'
import { hasPlatformAccess } from '@/lib/plans'
import { isProfileOnTrial } from '@/lib/billing/trialPolicy'
import {
  formatCreativeDirectionBlock,
  getOrComputeCreativeDirection,
} from '@/lib/agents/foundationCreativeDirection'
import { formatPostContextBriefBlock } from '@/lib/agents/imageGeneration/postContextBrief'
import { composeVideoConcept, type VideoConcept } from '@/lib/agents/videoGeneration/briefComposeConcept'
import { resolveVideoSkill } from '@/lib/agents/videoGeneration/videoSkills'
import { videoModelLabel } from '@/lib/agents/videoGeneration/videoModelCatalog'
import { submitVideoJob } from '@/lib/agents/videoGeneration/openRouterVideo'
import { ACTION_CREDIT_COST } from '@/lib/credits/actionCosts'

export const maxDuration = 120  // writer + critic passes

type Body = {
  postGoal?: string
  platform?: string
  offer?: string
  audience?: string
  mustInclude?: string
  mustAvoid?: string
  topic?: string
  sceneDirection?: string
  /** Video skill id (video_skills / BUILTIN_VIDEO_SKILLS). */
  skillId?: string
  /** Legacy client field — ignored; the skill picks its model. */
  videoModelId?: string
}

export async function POST(req: Request) {
  if (!isVideoGenerationEnabled()) {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 404 })
  }

  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { workspaceId, profile } = ws
  if (!hasPlatformAccess(profile.plan, profile.status, profile.billing_exempt ?? false)) {
    return NextResponse.json({ error: 'active_plan_required' }, { status: 403 })
  }

  // Foundation floor gate — same 70% floor as image generation
  const floor = await assertGenerationFloor(workspaceId)
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

  const profileId = workspaceId
  const companyName = (profile.company_name as string | null) ?? 'your business'
  const skill = await resolveVideoSkill(supabase, body.skillId)

  // Credit price comes from the skill. Premium skills follow the premium-model rules.
  const actionType = skill.credit_action
  const videoCost = ACTION_CREDIT_COST[actionType]
  if (actionType === 'video_premium') {
    const onTrial = await isProfileOnTrial({
      stripe_subscription_id: (profile.stripe_subscription_id as string | null) ?? null,
    })
    if (onTrial || profile.plan !== 'proagent') {
      return NextResponse.json(
        {
          error: onTrial ? 'premium_trial_blocked' : 'premium_plan_required',
          message: onTrial
            ? 'This video style unlocks after your trial converts to a paid plan.'
            : 'This video style is available on ProAgent.',
        },
        { status: 403 },
      )
    }
  }

  // Check the balance before paying for a render (the debit itself happens after the task exists).
  const { data: bal } = await supabase.from('credit_balances').select('balance').eq('user_id', profileId).maybeSingle()
  if (Number(bal?.balance ?? 0) < videoCost) {
    return NextResponse.json(
      {
        error: 'insufficient_credits',
        message: `This video uses ${videoCost} credits and your balance is ${Number(bal?.balance ?? 0)}. Credits refresh with your plan each month.`,
      },
      { status: 402 },
    )
  }

  const postForm: Record<string, string> = {
    topic: body.topic ?? '',
    postGoal: body.postGoal ?? '',
    platform: body.platform ?? '',
    offer: body.offer ?? '',
    audience: body.audience ?? '',
    mustInclude: body.mustInclude ?? '',
    mustAvoid: body.mustAvoid ?? '',
  }
  const postContextBlock = formatPostContextBriefBlock(postForm, 'video')

  // ── Step 1: idea → concept → one-shot prompt (no side effects — fail early) ─
  let concept: VideoConcept
  let ideas: string[] = []
  let critique: unknown = null
  let briefCostUsd = 0
  let briefInputTokens = 0
  let briefOutputTokens = 0
  let briefModel = ''
  try {
    const creativeDirection = await getOrComputeCreativeDirection({ profileId, companyName })
    const creativeDirectionBlock = formatCreativeDirectionBlock(creativeDirection, companyName)
    const r = await composeVideoConcept({
      skill,
      creativeDirectionBlock,
      companyName,
      postContextBlock,
      sceneDirection: body.sceneDirection,
    })
    concept = r.concept
    ideas = r.ideas
    critique = r.critique
    briefCostUsd = r.costUsd
    briefInputTokens = r.inputTokens
    briefOutputTokens = r.outputTokens
    briefModel = r.model
  } catch (err) {
    logProviderError('generate-video concept', err)
    return NextResponse.json(
      {
        error: 'brief_failed',
        message: sanitizeUserFacingError(err instanceof Error ? err.message : 'brief_failed', 'video_generation'),
      },
      { status: 502 },
    )
  }

  // ── Step 2: submit to the skill's model, then its fallback ───────────────
  let jobResult: { id: string; status: string } | null = null
  let usedModel = skill.model
  let submitErr: unknown = null
  for (const model of [skill.model, skill.fallback_model].filter((m): m is string => Boolean(m))) {
    try {
      jobResult = await submitVideoJob({
        model,
        prompt: concept.prompt,
        aspectRatio: '9:16',
        duration: skill.duration_seconds,
      })
      usedModel = model
      break
    } catch (err) {
      submitErr = err
      logProviderError(`generate-video submit ${model}`, err)
    }
  }
  if (!jobResult) {
    return NextResponse.json(
      {
        error: 'submit_failed',
        message: sanitizeUserFacingError(
          submitErr instanceof Error ? submitErr.message : 'video_submit_failed',
          'video_generation',
        ),
      },
      { status: 502 },
    )
  }

  // ── Step 3: agent_task record (job already submitted) ────────────────────
  const taskInput = {
    profileId,
    postGoal: body.postGoal,
    topic: body.topic ?? null,
    platform: body.platform ?? null,
    offer: body.offer ?? null,
    audience: body.audience ?? null,
    brief_excerpt: concept.prompt.slice(0, 200),
    video_prompt: concept.prompt,
    video_skill: skill.id,
    headline: concept.headline,
    concept: { look: concept.look, idea: concept.idea, headline: concept.headline },
    ideas,
    critique,
    video_model: usedModel,
    video_model_id: null,
    video_job_id: jobResult.id,
    action_type: actionType,
  }

  const { data: task, error: taskError } = await supabase
    .from('agent_tasks')
    .insert({
      user_id:          profileId,
      agent:            'video_generation',
      job_type:         'video_generate',
      action_type:      actionType,
      model:            briefModel,
      input_tokens:     briefInputTokens,
      output_tokens:    briefOutputTokens,
      cost_usd:         briefCostUsd,
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

  // ── Step 4: debit (balance was checked above; a race here fails the task) ─
  try {
    await deductCredits(profileId, videoCost, `Video — ${skill.name}`, taskId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'deduct_failed'
    if (msg === 'INSUFFICIENT_CREDITS') {
      await supabase
        .from('agent_tasks')
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', taskId)
      return NextResponse.json(
        {
          error: 'insufficient_credits',
          message: `This video uses ${videoCost} credits. Credits refresh with your plan each month.`,
        },
        { status: 402 },
      )
    }
    logProviderError('generate-video deduct-credits', err)
  }

  return NextResponse.json({
    jobId: jobResult.id,
    taskId,
    model: videoModelLabel(usedModel),
    skill: skill.name,
    headline: concept.headline,
    idea: concept.idea,
    status: 'pending',
    message: 'Your video is generating — usually 2–5 minutes.',
  })
}
