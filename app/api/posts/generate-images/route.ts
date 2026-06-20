import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { generateImageOptions } from '@/lib/agents/imageGeneration'
import { assertGenerationFloor } from '@/lib/foundation/sectionStrength'
import { isImageGenerationEnabled } from '@/lib/posts/imageGenerationFlag'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 180

type Body = {
  sceneDirection?: string
}

/** Step 2 compose: Foundation gate → brief compose → 3 image options (pre-queue). */
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
    body = await req.json()
  } catch {
    body = {}
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'openrouter_not_configured' }, { status: 503 })
  }

  try {
    const result = await generateImageOptions({
      profileId: profile.id,
      companyName: (profile.company_name as string | null) ?? 'your business',
      sceneDirection: body.sceneDirection,
    })

    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'generation_failed'
    console.error('[posts/generate-images]', err)
    return NextResponse.json({ error: 'generation_failed', message: msg }, { status: 502 })
  }
}
