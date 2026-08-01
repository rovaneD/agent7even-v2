import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getClerkSessionEmail } from '@/lib/clerk/sessionUser'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { ensurePaidSubscriptionForClerkUser } from '@/lib/billing/subscriptionGate'
import { shouldChargeFoundationGenerationCredits } from '@/lib/foundation/generationFunding'
import { runFoundationGeneration } from '@/lib/foundation/runFoundationGeneration'

export const maxDuration = 120

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    answers: Record<string, any>
    companyName: string
    sections?: string[]
  }
  const { answers, companyName, sections: sectionFilter } = body
  const supabase = createServiceClient()
  const email = await getClerkSessionEmail()

  // Provider spend must not run for accounts without paid/trial access.
  const gate = await ensurePaidSubscriptionForClerkUser(supabase, userId, email)
  if (!gate.ok) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 402 })
  }

  await supabase
    .from('profiles')
    .upsert({ clerk_user_id: userId, role: 'client', status: 'onboarding' }, { onConflict: 'clerk_user_id', ignoreDuplicates: true })

  const profile = await resolveClerkProfile<{
    id: string
    plan: string | null
    company_name: string | null
    foundation_complete: boolean | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    created_at: string
  }>(
    supabase,
    userId,
    'id, plan, company_name, foundation_complete, stripe_customer_id, stripe_subscription_id, created_at',
  )

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userPlan = profile.plan ?? 'starter'
  const chargeCredits = shouldChargeFoundationGenerationCredits(profile.foundation_complete)
  // First-time onboarding may mark complete; post-completion regenerates must not.
  const markComplete = !chargeCredits && !sectionFilter?.length

  const result = await runFoundationGeneration(supabase, {
    profileId: profile.id,
    userPlan,
    companyName: companyName || profile.company_name || 'Business',
    answers,
    sections: sectionFilter,
    markComplete,
    chargeCredits,
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, generated: result.generated, missing: result.missing },
      { status: result.status ?? 500 },
    )
  }

  return NextResponse.json({ success: true, generated: result.generated, missing: result.missing })
}
