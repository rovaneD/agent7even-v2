import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getClerkSessionEmail } from '@/lib/clerk/sessionUser'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { ensurePaidSubscriptionForClerkUser } from '@/lib/billing/subscriptionGate'
import { buildIdentityUpdateWithSnapshot, legacyColumnsFromAnswers } from '@/lib/foundation/answersSnapshot'
import { onboardFromWebsite } from '@/lib/foundation/onboardFromWebsite'

export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const website = typeof body.website === 'string' ? body.website.trim() : ''
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : undefined

    if (!website) {
      return NextResponse.json({ error: 'website required' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const email = await getClerkSessionEmail()
    const gate = await ensurePaidSubscriptionForClerkUser(supabase, userId, email)
    if (!gate.ok) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 402 })
    }

    const profile = await resolveClerkProfile<{
      id: string
      foundation_answers: Record<string, unknown> | null
      foundation_complete: boolean | null
      company_name: string | null
      stripe_customer_id: string | null
      stripe_subscription_id: string | null
      plan: string | null
      created_at: string
    }>(
      supabase,
      userId,
      'id, foundation_answers, foundation_complete, company_name, stripe_customer_id, stripe_subscription_id, plan, created_at',
    )

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    if (profile.foundation_complete) {
      return NextResponse.json(
        { error: 'Foundation already complete', ok: false, reason: 'already_complete' },
        { status: 409 },
      )
    }

    // Provider/website work only after paid access + incomplete Foundation are confirmed.
    const result = await onboardFromWebsite({ website, companyName: businessName })

    if (!result.ok) {
      const status = result.reason === 'invalid_url' ? 400 : 422
      return NextResponse.json({ ok: false, reason: result.reason }, { status })
    }

    const answersRecord = result.answers as unknown as Record<string, unknown>

    const patch: Record<string, unknown> = {
      foundation_answers: answersRecord,
      foundation_step: 4,
      foundation_research_variant: 'onboarding_v2',
      website_url: result.websiteUrl,
      ...legacyColumnsFromAnswers(answersRecord),
      foundation_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (result.siteSnapshot) {
      patch.site_snapshot = result.siteSnapshot
      patch.site_snapshot_source_url = result.siteSnapshot.sourceUrl
      patch.site_snapshot_generated_at = new Date().toISOString()
      patch.site_snapshot_enabled = true
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from('profiles')
      .update(buildIdentityUpdateWithSnapshot(profile.foundation_answers, patch))
      .eq('id', profile.id)
      .neq('foundation_complete', true)
      .select('id')

    if (updateError) {
      console.error('[onboard-from-website] profile update failed:', updateError)
      return NextResponse.json({ error: 'Failed to save onboarding draft' }, { status: 500 })
    }
    if (!updatedRows?.length) {
      return NextResponse.json(
        { error: 'Foundation already complete', ok: false, reason: 'already_complete' },
        { status: 409 },
      )
    }

    return NextResponse.json({
      ok: true,
      answers: result.answers,
      businessType: result.businessType,
      websiteUrl: result.websiteUrl,
      hostname: result.hostname,
      siteTitle: result.siteTitle,
      siteSnapshot: result.siteSnapshot,
      checklist: result.checklist,
    })
  } catch (err) {
    console.error('[onboard-from-website]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
