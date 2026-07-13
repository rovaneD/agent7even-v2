import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import {
  buildIdentityRestoreSwap,
  cloneFoundationAnswers,
} from '@/lib/foundation/answersSnapshot'
import { scheduleCreativeDirectionCacheRefresh } from '@/lib/agents/foundationCreativeDirection/cache'

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServiceClient()
    const profile = await resolveClerkProfile<{
      id: string
      company_name: string | null
      foundation_answers: Record<string, unknown> | null
      foundation_answers_previous: Record<string, unknown> | null
      foundation_answers_previous_at: string | null
      foundation_updated_at: string | null
      stripe_customer_id: string | null
      stripe_subscription_id: string | null
      plan: string | null
      created_at: string
    }>(
      supabase,
      userId,
      'id, company_name, foundation_answers, foundation_answers_previous, foundation_answers_previous_at, foundation_updated_at',
    )

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

    scheduleCreativeDirectionCacheRefresh(
      profile.id,
      profile.company_name ?? 'Business',
    )

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
