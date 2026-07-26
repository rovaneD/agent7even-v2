import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getClerkSessionEmail } from '@/lib/clerk/sessionUser'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { ensurePaidSubscriptionForClerkUser } from '@/lib/billing/subscriptionGate'
import { buildIdentityUpdateWithSnapshot, legacyColumnsFromAnswers } from '@/lib/foundation/answersSnapshot'
import { normalizeOnboardingAnswers } from '@/lib/foundation/onboardingAnswerShape'
import { normalizeBusinessType } from '@/lib/foundation/onboardingBusinessTypes'
import { runFoundationScore } from '@/lib/foundation/runFoundationScore'
import { runFoundationGeneration } from '@/lib/foundation/runFoundationGeneration'
import { normalizeWebsiteUrl } from '@/lib/maya/canonicalWebsite'

export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const rawAnswers = body.answers as Record<string, unknown> | undefined
    const websiteUrl =
      typeof body.websiteUrl === 'string' ? normalizeWebsiteUrl(body.websiteUrl) : null
    const companyName =
      typeof body.companyName === 'string' ? body.companyName.trim() : null
    const businessType = normalizeBusinessType(body.businessType)

    if (!rawAnswers) {
      return NextResponse.json({ error: 'answers required' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const email = await getClerkSessionEmail()
    const gate = await ensurePaidSubscriptionForClerkUser(supabase, userId, email)
    if (!gate.ok) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 402 })
    }

    const answers = normalizeOnboardingAnswers(rawAnswers)

    const profile = await resolveClerkProfile<{
      id: string
      foundation_answers: Record<string, unknown> | null
      foundation_complete: boolean | null
      foundation_score: number | null
      company_name: string | null
      plan: string | null
      stripe_customer_id: string | null
      stripe_subscription_id: string | null
      created_at: string
    }>(
      supabase,
      userId,
      'id, foundation_answers, foundation_complete, foundation_score, company_name, plan, stripe_customer_id, stripe_subscription_id, created_at',
    )

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    if (profile.foundation_complete) {
      return NextResponse.json(
        { error: 'Foundation already complete', ok: false, reason: 'already_complete' },
        { status: 409 },
      )
    }

    const answersRecord = answers as unknown as Record<string, unknown>

    const { data: updatedRows, error: updateError } = await supabase
      .from('profiles')
      .update(
        buildIdentityUpdateWithSnapshot(profile.foundation_answers, {
          foundation_answers: answersRecord,
          foundation_step: 4,
          foundation_research_variant: 'onboarding_v2',
          ...(websiteUrl ? { website_url: websiteUrl } : {}),
          ...(companyName ? { company_name: companyName } : {}),
          ...(businessType ? { business_type: businessType } : {}),
          ...legacyColumnsFromAnswers(answersRecord),
          foundation_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      )
      .eq('id', profile.id)
      .neq('foundation_complete', true)
      .select('id')

    if (updateError) {
      console.error('[complete-onboarding] profile update failed:', updateError)
      return NextResponse.json({ error: 'Failed to save onboarding answers' }, { status: 500 })
    }
    if (!updatedRows?.length) {
      return NextResponse.json(
        { error: 'Foundation already complete', ok: false, reason: 'already_complete' },
        { status: 409 },
      )
    }

    const scoreResult = await runFoundationScore(supabase, profile, answersRecord)
    if (!scoreResult.ok) {
      return NextResponse.json({ error: scoreResult.error }, { status: 500 })
    }

    const userPlan = profile.plan ?? 'starter'
    const generationCompanyName = companyName || profile.company_name || 'Business'

    const genResult = await runFoundationGeneration(supabase, {
      profileId: profile.id,
      userPlan,
      companyName: generationCompanyName,
      answers: answersRecord,
      markComplete: true,
    })

    if (!genResult.ok) {
      return NextResponse.json(
        {
          error: genResult.error,
          overallScore: scoreResult.overallScore,
          generated: genResult.generated ?? [],
          missing: genResult.missing ?? [],
        },
        { status: genResult.status ?? 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      overallScore: scoreResult.overallScore,
      fieldScores: scoreResult.fieldScores,
      generated: genResult.generated,
      redirectTo: '/dashboard/foundation?onboarding=complete',
    })
  } catch (err) {
    console.error('[complete-onboarding]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
