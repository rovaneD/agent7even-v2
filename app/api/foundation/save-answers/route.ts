import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buildIdentityUpdateWithSnapshot, legacyColumnsFromAnswers } from '@/lib/foundation/answersSnapshot'
import { serializeCompetitorSlots } from '@/lib/foundation/competitorsArray'
import { scheduleCreativeDirectionCacheRefresh } from '@/lib/agents/foundationCreativeDirection/cache'

// Hub editing route — merges updated answers into foundation_answers without
// touching foundation_step (unlike save-step which is for the onboarding wizard).
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { answers } = body as { answers?: Record<string, unknown> }
    if (!answers) return NextResponse.json({ error: 'answers required' }, { status: 400 })

    const supabase = createServiceClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, foundation_answers, company_name')
      .eq('clerk_user_id', userId)
      .single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const merged = { ...(profile.foundation_answers ?? {}), ...answers }
    if (answers.competitors != null) {
      merged.competitors = serializeCompetitorSlots(answers.competitors)
    }

    await supabase
      .from('profiles')
      .update(buildIdentityUpdateWithSnapshot(profile.foundation_answers, {
        foundation_answers: merged,
        ...legacyColumnsFromAnswers(answers),
        foundation_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
      .eq('id', profile.id)

    scheduleCreativeDirectionCacheRefresh(
      profile.id,
      profile.company_name ?? 'Business',
    )

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
