import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  assertGenerationFloor,
  GENERATION_SECTION_FLOOR,
} from '@/lib/foundation/sectionStrength'

/** Check whether the authenticated user passes the generation hard floor. */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const result = await assertGenerationFloor(profile.id)

  if (!result.ok) {
    return NextResponse.json(
      {
        allowed: false,
        floor: result.floor,
        reason: result.reason,
        section: result.section,
        score: result.score,
        route: result.route,
        message: result.message,
        weakField: result.weakField ?? null,
      },
      { status: 403 },
    )
  }

  return NextResponse.json({
    allowed: true,
    floor: GENERATION_SECTION_FLOOR,
    scores: result.scores,
  })
}
