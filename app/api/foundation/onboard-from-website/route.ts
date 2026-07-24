import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
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

    const result = await onboardFromWebsite({ website, companyName: businessName })

    if (!result.ok) {
      const status = result.reason === 'invalid_url' ? 400 : 422
      return NextResponse.json({ ok: false, reason: result.reason }, { status })
    }

    const supabase = createServiceClient()
    const profile = await resolveClerkProfile<{
      id: string
      foundation_answers: Record<string, unknown> | null
      company_name: string | null
      stripe_customer_id: string | null
      stripe_subscription_id: string | null
      plan: string | null
      created_at: string
    }>(supabase, userId, 'id, foundation_answers, company_name, stripe_customer_id, stripe_subscription_id, plan, created_at')

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

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

    await supabase
      .from('profiles')
      .update(buildIdentityUpdateWithSnapshot(profile.foundation_answers, patch))
      .eq('id', profile.id)

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
