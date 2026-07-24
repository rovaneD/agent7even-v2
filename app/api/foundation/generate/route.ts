import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
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

  await supabase
    .from('profiles')
    .upsert({ clerk_user_id: userId, role: 'client', status: 'onboarding' }, { onConflict: 'clerk_user_id', ignoreDuplicates: true })

  const profile = await resolveClerkProfile<{
    id: string
    plan: string | null
    company_name: string | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    created_at: string
  }>(supabase, userId, 'id, plan, company_name, stripe_customer_id, stripe_subscription_id, created_at')

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userPlan = profile.plan ?? 'starter'
  const result = await runFoundationGeneration(supabase, {
    profileId: profile.id,
    userPlan,
    companyName: companyName || profile.company_name || 'Business',
    answers,
    sections: sectionFilter,
    markComplete: !sectionFilter?.length,
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, generated: result.generated, missing: result.missing },
      { status: result.status ?? 500 },
    )
  }

  return NextResponse.json({ success: true, generated: result.generated, missing: result.missing })
}
