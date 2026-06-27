import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { openRouterComplete } from '@/lib/agents/openrouter'
import { deductCredits, refundCredits } from '@/lib/credits'
import { ACTION_CREDIT_COST } from '@/lib/credits/actionCosts'
import { assessTextFairUse } from '@/lib/credits/textFairUse'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const body = await req.json()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_name, foundation_answers')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const model = body.model ?? 'anthropic/claude-sonnet-4'
  const credits = ACTION_CREDIT_COST.text_run

  const fairUse = await assessTextFairUse(profile.id)
  if (fairUse.warn) {
    console.warn('[campaigns/generate] text fair-use:', fairUse.message)
  }

  const prompt = body.mode === 'guided'
    ? buildGuidedPrompt(body, profile)
    : buildOpenCanvasPrompt(body, profile)

  try {
    await deductCredits(profile.id, credits, `Campaign generation — ${model} reserved`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'INSUFFICIENT_CREDITS') {
      return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
    }
    console.error('[campaigns/generate] credit deduction failed:', err)
    return NextResponse.json({ error: 'Credit deduction failed' }, { status: 500 })
  }

  let result: { content: string; modelUsed: string }
  try {
    result = await openRouterComplete({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.7,
    })
  } catch (err) {
    await refundCredits(profile.id, credits, `Campaign generation failed — ${model} refund`).catch(() => {})
    console.error('[campaigns/generate] openrouter error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }

  let campaign: Record<string, unknown>
  try {
    const clean = result.content.replace(/```json|```/g, '').trim()
    campaign = JSON.parse(clean)
  } catch {
    await refundCredits(profile.id, credits, `Campaign parse failed — ${model} refund`).catch(() => {})
    console.error('[campaigns/generate] JSON parse failed:', result.content.slice(0, 200))
    return NextResponse.json({ error: 'Failed to parse campaign plan' }, { status: 500 })
  }

  const { data: saved, error: insertError } = await supabase
    .from('campaigns')
    .insert({
      user_id: profile.id,
      title: campaign.title,
      plan: {
        mode: body.mode,
        segment: body.segment ?? null,
        goal: body.goal ?? null,
        timelineDays: body.timelineDays ?? null,
        strategySummary: campaign.strategySummary,
        doThisToday: campaign.doThisToday,
        weekPlan: campaign.weekPlan,
      },
      model_used: result.modelUsed,
      status: 'active',
    })
    .select('id')
    .single()

  if (insertError) {
    await refundCredits(profile.id, credits, `Campaign save failed — ${model} refund`).catch(() => {})
    console.error('[campaigns/generate] insert error:', insertError.message)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ campaignId: saved.id })
}

function buildGuidedPrompt(body: Record<string, unknown>, profile: Record<string, unknown>): string {
  return `You are Maya, an AI marketing strategist.

Build a complete marketing campaign for the following:

Business: ${profile.company_name}
Foundation context: ${JSON.stringify(profile.foundation_answers)}

Campaign parameters:
- Audience segment: ${body.segment}
- Goal: ${body.goal}
- Timeline: ${body.timelineDays} days
- Budget: ${body.budget}

Return ONLY valid JSON with this exact structure:
{
  "title": "Campaign name (specific and descriptive)",
  "strategySummary": "2-3 sentences explaining the approach and why it fits this segment",
  "doThisToday": [
    {
      "task": "Specific action to take today",
      "channel": "instagram | email | ads | organic",
      "cta": "Do this with Maya →"
    }
  ],
  "weekPlan": [
    {
      "week": 1,
      "theme": "Week theme",
      "days": [
        {
          "day": "Mon",
          "channel": "Instagram",
          "type": "Post",
          "content": "Specific content description",
          "mins": 30
        }
      ]
    }
  ]
}`
}

function buildOpenCanvasPrompt(body: Record<string, unknown>, profile: Record<string, unknown>): string {
  return `You are Maya, an AI marketing strategist.

The user had an open canvas brainstorm session and here is what they want to build:

Business: ${profile.company_name}
Foundation context: ${JSON.stringify(profile.foundation_answers)}

Campaign brief from conversation:
${body.brief}

Build a custom campaign plan that solves their specific situation.
Return ONLY valid JSON with the same structure as a guided campaign:
{
  "title": "Campaign name that reflects the specific situation",
  "strategySummary": "2-3 sentences explaining the custom approach",
  "doThisToday": [
    {
      "task": "Specific action to take today",
      "channel": "instagram | email | ads | organic",
      "cta": "Do this with Maya →"
    }
  ],
  "weekPlan": [
    {
      "week": 1,
      "theme": "Week theme",
      "days": [
        {
          "day": "Mon",
          "channel": "Channel name",
          "type": "Content type",
          "content": "Specific content description",
          "mins": 30
        }
      ]
    }
  ]
}`
}
