import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { runFoundationScore } from '@/lib/foundation/runFoundationScore'

export const maxDuration = 30

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { answers } = await req.json()
  const supabase = createServiceClient()

  const profile = await resolveClerkProfile<{
    id: string
    foundation_score: number | null
    company_name: string | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    plan: string | null
    created_at: string
  }>(supabase, userId, 'id, foundation_score, company_name')

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const result = await runFoundationScore(supabase, profile, answers)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    overallScore: result.overallScore,
    fieldScores: result.fieldScores,
    topWeakFields: result.topWeakFields,
  })
}
