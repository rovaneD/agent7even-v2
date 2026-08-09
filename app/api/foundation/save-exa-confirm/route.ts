import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { buildIdentityUpdateWithSnapshot, legacyColumnsFromAnswers } from '@/lib/foundation/answersSnapshot'
import { runFoundationScore } from '@/lib/foundation/runFoundationScore'
import { scheduleCreativeDirectionCacheRefresh } from '@/lib/agents/foundationCreativeDirection/cache'
import { normalizeWebsiteUrl } from '@/lib/maya/canonicalWebsite'

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { answers, websiteUrl } = body as {
      answers?: Record<string, unknown>
      websiteUrl?: string
    }

    if (!answers) return NextResponse.json({ error: 'answers required' }, { status: 400 })

    const supabase = createServiceClient()
    const profile = await resolveClerkProfile<{
      id: string
      foundation_answers: Record<string, unknown> | null
      foundation_score: number | null
      company_name: string | null
      stripe_customer_id: string | null
      stripe_subscription_id: string | null
      plan: string | null
      created_at: string
    }>(supabase, userId, 'id, foundation_answers, foundation_score, company_name')
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const normalizedWebsite = websiteUrl ? normalizeWebsiteUrl(websiteUrl) : null

    const { error: updateError } = await supabase
      .from('profiles')
      .update(buildIdentityUpdateWithSnapshot(profile.foundation_answers, {
        foundation_answers: answers,
        foundation_step: 4,
        foundation_research_variant: 'exa_prefill',
        ...(normalizedWebsite ? { website_url: normalizedWebsite } : {}),
        ...legacyColumnsFromAnswers(answers),
        foundation_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
      .eq('id', profile.id)

    if (updateError) {
      console.error('[foundation/save-exa-confirm] profile update failed:', updateError.message)
      return NextResponse.json({ error: 'save_failed' }, { status: 500 })
    }

    scheduleCreativeDirectionCacheRefresh(
      profile.id,
      profile.company_name ?? 'Business',
    )

    const scoreResult = await runFoundationScore(supabase, profile, answers)

    return NextResponse.json({
      ok: true,
      overallScore: scoreResult.ok ? scoreResult.overallScore : null,
      fieldScores: scoreResult.ok ? scoreResult.fieldScores : null,
      scoreError: scoreResult.ok ? null : scoreResult.error,
    })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
