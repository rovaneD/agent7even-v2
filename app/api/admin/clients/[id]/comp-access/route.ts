import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { allocatePlanCredits } from '@/lib/credits'
import { isPaidPlan, type PaidPlan } from '@/lib/plans'
import { createServiceClient } from '@/lib/supabase/server'

async function getAdminProfile(userId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()
  return data
}

type Body = {
  action: 'grant' | 'revoke'
  tier?: PaidPlan
  allocateCredits?: boolean
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await getAdminProfile(userId)
  if (!admin || !['admin', 'owner'].includes(admin.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = (await req.json()) as Body
  const supabase = createServiceClient()

  if (body.action === 'grant') {
    const tier = body.tier ?? 'proagent'
    if (!isPaidPlan(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        billing_exempt: true,
        plan: tier,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, plan, status, billing_exempt')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let creditsGranted: number | null = null
    if (body.allocateCredits !== false) {
      creditsGranted = await allocatePlanCredits(id, tier, {
        description: `Complimentary access — ${tier} plan`,
      })
    }

    return NextResponse.json({ profile, creditsGranted })
  }

  if (body.action === 'revoke') {
    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        billing_exempt: false,
        plan: null,
        status: 'onboarding',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, plan, status, billing_exempt')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ profile })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
