import { NextResponse } from 'next/server'
import { resolvePostsWorkspace } from '@/lib/profiles/resolvePostsWorkspace'
import { generateImageOptions } from '@/lib/agents/imageGeneration'
import type { ImageAspectRatio } from '@/lib/agents/imageGeneration/openRouterImage'
import { logProviderError, sanitizeUserFacingError } from '@/lib/agents/sanitizeProviderError'
import { assertGenerationFloor } from '@/lib/foundation/sectionStrength'
import { isImageGenerationEnabled } from '@/lib/posts/imageGenerationFlag'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 180

type Body = {
  sceneDirection?: string
  useBrandKit?: boolean
  includeLogo?: boolean
  imageModelId?: string
  postContext?: Record<string, string>
  aspectRatio?: ImageAspectRatio
}

const VALID_ASPECT_RATIOS: ImageAspectRatio[] = [
  '1:1', '4:5', '9:16', '16:9', '3:2', '2:3', '3:4', '4:3', '5:4', '21:9',
]

function resolveAspectRatio(value: unknown): ImageAspectRatio {
  if (typeof value === 'string' && VALID_ASPECT_RATIOS.includes(value as ImageAspectRatio)) {
    return value as ImageAspectRatio
  }
  return '4:5'
}

/** Step 2 compose: Foundation gate → brief compose → 3 image options (pre-queue). */
export async function POST(req: Request) {
  if (!isImageGenerationEnabled()) {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 404 })
  }

  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { workspaceId, profile } = ws
  if (!profile.plan) return NextResponse.json({ error: 'active_plan_required' }, { status: 403 })

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
    body = await req.json()
  } catch {
    body = {}
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'openrouter_not_configured' }, { status: 503 })
  }

  try {
    const result = await generateImageOptions({
      profileId: workspaceId,
      companyName: (profile.company_name as string | null) ?? 'your business',
      sceneDirection: body.sceneDirection,
      useBrandKit: body.useBrandKit === true,
      includeLogo: body.includeLogo === true,
      imageModelId: body.imageModelId,
      postContext: body.postContext,
      aspectRatio: resolveAspectRatio(body.aspectRatio),
    })

    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'generation_failed'
    if (msg === 'post_goal_required') {
      return NextResponse.json(
        {
          error: 'post_goal_required',
          message: 'Choose a Post goal in the setup form before generating images.',
        },
        { status: 422 },
      )
    }
    console.error('[posts/generate-images]', err)
    return NextResponse.json(
      {
        error: 'generation_failed',
        message: sanitizeUserFacingError(msg, 'image_generation'),
      },
      { status: 502 },
    )
  }
}
