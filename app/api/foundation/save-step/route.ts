import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { step, answers } = await req.json()

  const supabase = createServiceClient()

  // Ensure profile row exists
  await supabase
    .from('profiles')
    .upsert({ clerk_user_id: userId, role: 'client', status: 'onboarding' }, { onConflict: 'clerk_user_id', ignoreDuplicates: true })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase
    .from('profiles')
    .update({
      foundation_step: step + 1,
      ideal_customer: answers.customerWho || null,
      marketing_budget: answers.marketingBudget || null,
      competitors: answers.competitors?.filter(Boolean) ?? [],
      top_goals: answers.monthlyGoal ? [answers.monthlyGoal] : [],
      marketing_challenge: answers.customerFrustration || null,
      content_comfort: answers.toneTraits?.join(', ') || null,
      sell_locations: answers.channels ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)

  return NextResponse.json({ success: true })
}
