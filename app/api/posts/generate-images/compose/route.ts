import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { queueGeneratedPost, GENERATION_BUNDLE_CREDIT_COST } from '@/lib/agents/imageGeneration/queueGeneratedPost'
import { isImageGenerationEnabled } from '@/lib/posts/imageGenerationFlag'
import { createServiceClient } from '@/lib/supabase/server'
import type { TextQaResult } from '@/lib/agents/imageGeneration/types'

export const maxDuration = 120

type Body = {
  briefId?: string
  optionIndex?: number
  brief?: string
  storagePath?: string
  mime?: string
  imageModel?: string
  optionsCount?: number
  qa?: TextQaResult
  instructions?: string
  contentFlow?: string
  platform?: string
  postGoal?: string
  audience?: string
  offer?: string
  mustInclude?: string
  mustAvoid?: string
  priority?: string
}

/** Steps 5–6–7: QA-passed pick → caption with image → pending_approval insert (bundled credits). */
export async function POST(req: Request) {
  if (!isImageGenerationEnabled()) {
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

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const {
    briefId,
    optionIndex,
    storagePath,
    mime,
    imageModel,
    optionsCount = 3,
    qa,
    priority,
    instructions,
    platform,
    postGoal,
    audience,
    offer,
    mustInclude,
    mustAvoid,
  } = body

  if (
    !briefId
    || typeof optionIndex !== 'number'
    || optionIndex < 0
    || !storagePath?.trim()
    || !mime?.trim()
    || !imageModel?.trim()
    || !qa?.passed
  ) {
    return NextResponse.json(
      { error: 'briefId, optionIndex, storagePath, mime, imageModel, and qa.passed required' },
      { status: 400 },
    )
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'openrouter_not_configured' }, { status: 503 })
  }

  const taskInput: Record<string, unknown> = {
    instructions: instructions?.trim() || undefined,
    contentFlow: 'single',
    platform: platform ?? 'Instagram',
    platforms: platform ?? 'Instagram',
    postGoal,
    audience,
    offer,
    mustInclude,
    mustAvoid,
  }

  const result = await queueGeneratedPost({
    profileId: profile.id,
    companyName: (profile.company_name as string | null) ?? 'your business',
    taskInput,
    priority,
    picked: {
      storagePath: storagePath.trim(),
      mime: mime.trim(),
      imageModel: imageModel.trim(),
      briefId,
      optionIndex,
      brief: body.brief?.trim() ?? '',
      optionsCount,
      qa,
    },
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status: result.status },
    )
  }

  return NextResponse.json({
    taskId: result.taskId,
    outputId: result.outputId,
    caption: result.caption,
    creditsCharged: GENERATION_BUNDLE_CREDIT_COST,
  })
}
