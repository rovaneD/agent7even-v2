import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { buildIdentityUpdateWithSnapshot, legacyColumnsFromAnswers } from '@/lib/foundation/answersSnapshot'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { step, answers } = await req.json() as {
    step: number
    answers: Record<string, unknown>
  }

  const supabase = createServiceClient()

  // Ensure profile row exists
  await supabase
    .from('profiles')
    .upsert({ clerk_user_id: userId, role: 'client', status: 'onboarding' }, { onConflict: 'clerk_user_id', ignoreDuplicates: true })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, foundation_answers')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const answerString = (key: string) => typeof answers[key] === 'string' ? answers[key] as string : ''
  const answerArray = (key: string) => Array.isArray(answers[key]) ? answers[key] as string[] : []

  const base: Record<string, unknown> = {
    foundation_step: step + 1,
    updated_at: new Date().toISOString(),
  }

  const stepFields: Record<string, unknown> = (() => {
    switch (step) {
      case 0:
        return {
          employee_count_bucket: answerString('employeeCountBucket') || null,
          annual_revenue_bucket: answerString('annualRevenueBucket') || null,
        }
      case 1:
        return {
          ideal_customer: answerString('customerWho') || null,
          marketing_challenge: answerString('customerFrustration') || null,
        }
      case 2:
        return {
          competitors: answerArray('competitors').filter(Boolean),
        }
      case 3:
        return {
          content_comfort: answerArray('toneTraits').join(', ') || null,
        }
      case 4:
        return {
          marketing_budget: answerString('marketingBudget') || null,
          top_goals: answerString('monthlyGoal') ? [answerString('monthlyGoal')] : [],
          sell_locations: answerArray('channels'),
        }
      default:
        return {}
    }
  })()

  const mergedAnswers = { ...(profile.foundation_answers ?? {}), ...answers }

  const { error } = await supabase
    .from('profiles')
    .update(buildIdentityUpdateWithSnapshot(profile.foundation_answers, {
      ...base,
      foundation_answers: mergedAnswers,
      foundation_updated_at: new Date().toISOString(),
      ...legacyColumnsFromAnswers(mergedAnswers),
      ...stepFields,
    }))
    .eq('id', profile.id)

  if (error) {
    console.error('[foundation/save-step] profile update failed:', error.message)
    return NextResponse.json({ error: 'Failed to save answers' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
