import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { openRouterComplete } from '@/lib/agents/openrouter'
import { logActivity } from '@/lib/activity'
import { FIELD_EXPECTATIONS, mergeScoredFields, topWeakFieldKeys } from '@/lib/foundation/score'
import { computeOverallFoundationScore } from '@/lib/foundation/sections'
import { scheduleCreativeDirectionCacheRefresh } from '@/lib/agents/foundationCreativeDirection/cache'

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

  // Normalize arrays to strings for the scoring prompt
  const answersForScoring: Record<string, string> = {}
  for (const key of Object.keys(FIELD_EXPECTATIONS)) {
    const val = answers[key]
    if (Array.isArray(val)) {
      answersForScoring[key] = val.filter(Boolean).join(', ')
    } else {
      answersForScoring[key] = String(val ?? '')
    }
  }

  const scoringPrompt = `You are evaluating onboarding answers for a small business marketing platform.
Score each answer from 0-100 based on specificity and usefulness for creating marketing content.
- 0-30: Too vague (e.g. "small businesses", "good quality", "everyone")
- 31-60: Somewhat specific but could be better
- 61-85: Good specificity, useful for marketing
- 86-100: Excellent — highly specific, actionable, vivid

Empty or blank answers score 0.
For each field, return a score and one sentence of feedback if score is below 70. Feedback should be a specific suggestion, not just "be more specific."

The following fields are PREDEFINED SELECTIONS (the user picked from a fixed list — they cannot type a custom answer). Score them but always set feedback to null — do not suggest rewording a selection:
- differentiator (single choice from a list)
- marketingBudget (single choice from a list)
- monthlyGoal (single choice from a list)
- toneTraits (multi-select from a list)
- channels (multi-select from a list)

Return ONLY valid JSON — no markdown, no code fences, no preamble.

Answers to score:
${JSON.stringify(answersForScoring, null, 2)}

Return format exactly:
{
  "fieldScores": {
    "businessDescription": { "score": 75, "feedback": null },
    "customerWho": { "score": 35, "feedback": "Try specifying the industry, business size, and the exact problem they face on a typical Tuesday." }
  },
  "overallScore": 62,
  "topWeakFields": ["customerWho", "problemSolved"]
}`

  const result = await openRouterComplete({
    model: 'anthropic/claude-haiku-4-5',
    messages: [{ role: 'user', content: scoringPrompt }],
    max_tokens: 1200,
    temperature: 0.1,
  })

  let parsed: {
    fieldScores: Record<string, { score: number; feedback: string | null }>
    overallScore: number
    topWeakFields: string[]
  }

  try {
    const cleaned = result.content.replace(/```json\n?|\n?```/g, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('[foundation/score] JSON parse failed:', result.content.slice(0, 200))
    return NextResponse.json({ error: 'Score parsing failed' }, { status: 500 })
  }

  const { data: previousRows } = await supabase
    .from('foundation_field_scores')
    .select('field_key, score, feedback')
    .eq('user_id', profile.id)

  const previousScores = Object.fromEntries(
    (previousRows ?? []).map(row => [
      row.field_key as string,
      { score: row.score as number, feedback: (row.feedback as string | null) ?? null },
    ]),
  )

  const completeFieldScores = mergeScoredFields(
    parsed.fieldScores ?? {},
    answersForScoring,
    previousScores,
  )

  const overallScore = computeOverallFoundationScore(completeFieldScores)
  const topWeakFields = topWeakFieldKeys(completeFieldScores)

  // Replace per-field scores atomically so rescored rows stay in sync with section pills.
  await supabase.from('foundation_field_scores').delete().eq('user_id', profile.id)

  const fieldScoreRows = Object.entries(completeFieldScores).map(([key, val]) => ({
    user_id:    profile.id,
    field_key:  key,
    score:      val.score,
    feedback:   val.feedback ?? null,
    updated_at: new Date().toISOString(),
  }))

  if (fieldScoreRows.length > 0) {
    await supabase.from('foundation_field_scores').insert(fieldScoreRows)
  }

  const fieldScoreMap = completeFieldScores

  // Update profile
  await supabase
    .from('profiles')
    .update({
      foundation_score: overallScore,
      foundation_answers: answers,
      foundation_updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)

  logActivity(profile.id, 'foundation_updated', { score: overallScore }).catch(() => {})

  scheduleCreativeDirectionCacheRefresh(
    profile.id,
    profile.company_name ?? 'Business',
  )

  // Congratulations notification when score crosses 80%
  const prevScore = profile.foundation_score ?? 0
  if (overallScore >= 80 && prevScore < 80) {
    await supabase.from('notifications').insert({
      user_id: profile.id,
      title:   'Foundation milestone reached',
      body:    `Your foundation is now ${overallScore}% complete. Everything Maya creates for you just got better.`,
      type:    'foundation_milestone',
      link:    '/dashboard/foundation',
      read:    false,
    })
  }

  return NextResponse.json({
    overallScore,
    fieldScores:   fieldScoreMap,
    topWeakFields,
  })
}
