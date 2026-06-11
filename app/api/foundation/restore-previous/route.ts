import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  buildIdentityRestoreSwap,
  cloneFoundationAnswers,
} from '@/lib/foundation/answersSnapshot'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServiceClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, foundation_answers, foundation_answers_previous, foundation_answers_previous_at, foundation_updated_at')
      .eq('clerk_user_id', userId)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    if (profile.foundation_answers_previous == null) {
      return NextResponse.json({
        hasPrevious: false,
        message: 'No previous version saved yet.',
      })
    }

    const swapUpdate = buildIdentityRestoreSwap(profile)
    if (!swapUpdate) {
      return NextResponse.json({
        hasPrevious: false,
        message: 'No previous version saved yet.',
      })
    }

    const { error } = await supabase
      .from('profiles')
      .update(swapUpdate)
      .eq('id', profile.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const answers = cloneFoundationAnswers(swapUpdate.foundation_answers)

    return NextResponse.json({
      hasPrevious: true,
      success: true,
      answers,
      previousAt: swapUpdate.foundation_answers_previous_at as string | null,
      restoredFrom: profile.foundation_answers_previous_at,
    })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
