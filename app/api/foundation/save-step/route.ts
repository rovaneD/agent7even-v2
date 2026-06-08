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

  const base: Record<string, unknown> = {
    foundation_step:    Math.min(step + 1, 4),
    foundation_answers: answers,
    updated_at:         new Date().toISOString(),
  }

  const stepFields: Record<string, unknown> = (() => {
    switch (step) {
      case 0:
        return {}
      case 1:
        return {
          ideal_customer: answers.customerWho || null,
          marketing_challenge: answers.customerFrustration || null,
        }
      case 2:
        return {
          competitors: answers.competitors?.filter(Boolean) ?? [],
        }
      case 3:
        return {
          content_comfort: answers.toneTraits?.join(', ') || null,
        }
      case 4:
        return {
          marketing_budget: answers.marketingBudget || null,
          top_goals: answers.monthlyGoal ? [answers.monthlyGoal] : [],
          sell_locations: answers.channels ?? [],
        }
      default:
        return {}
    }
  })()

  await supabase
    .from('profiles')
    .update({ ...base, ...stepFields })
    .eq('id', profile.id)

  return NextResponse.json({ success: true })
}
