import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { getToolkitPlanLimits } from '@/lib/ai/toolkitPlanLimits'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    promptId,
    prompt,
    timeSavedMins,
    useBrandVoice = false,
  } = await req.json()

  const supabase = createServiceClient()

  const profile = await resolveClerkProfile<{
    id: string
    plan: string | null
    status: string | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    created_at: string
  }>(supabase, userId, 'id, plan, status, stripe_subscription_id')

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Require active plan
  if (!profile.plan || !['starter', 'growth', 'proagent'].includes(profile.plan)) {
    return NextResponse.json({ error: 'No active plan', code: 'NO_PLAN' }, { status: 403 })
  }

  // Enforce plan limits (trial total vs Starter monthly vs unlimited)
  const limits = await getToolkitPlanLimits(supabase, profile)

  if (!limits.unlimited && limits.runsUsed >= limits.runLimit) {
    if (limits.onTrial) {
      return NextResponse.json({
        error: 'Trial AI limit reached. Your 3-day trial includes 5 AI Toolkit runs total.',
        code: 'TRIAL_LIMIT',
      }, { status: 403 })
    }
    return NextResponse.json({
      error: 'Monthly AI limit reached. Upgrade to Growth for unlimited runs.',
      code: 'MONTHLY_LIMIT',
    }, { status: 403 })
  }

  // Build system prompt
  let systemPrompt = `You are an expert marketing copywriter. Write compelling, professional marketing content based on the user's request. Be specific, actionable, and ready to use.`

  if (useBrandVoice) {
    const { data: brandDocs } = await supabase
      .from('brand_documents')
      .select('type, content')
      .eq('user_id', profile.id)
      .in('type', ['voice', 'positioning', 'persona'])

    if (brandDocs && brandDocs.length > 0) {
      const voiceDoc = brandDocs.find(d => d.type === 'voice')
      const positioningDoc = brandDocs.find(d => d.type === 'positioning')
      const personaDoc = brandDocs.find(d => d.type === 'persona')

      systemPrompt = `You are an expert marketing copywriter writing exclusively for this specific brand. Study the brand documents below carefully and write all content in this brand's voice, tone, and style. Never deviate from their personality, positioning, or audience.

${voiceDoc ? `## BRAND VOICE & TONE\n${voiceDoc.content}\n` : ''}
${positioningDoc ? `## BRAND POSITIONING\n${positioningDoc.content}\n` : ''}
${personaDoc ? `## IDEAL CLIENT PROFILE\n${personaDoc.content}\n` : ''}

## YOUR INSTRUCTIONS
- Always write in this brand's established voice and tone
- Keep the ideal client profile in mind for every word you write
- Reflect the brand's positioning and what makes them unique
- Never use generic marketing language that could apply to any business
- Make every output feel distinctly like this brand

Now complete the following task:`
    }
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  })

  const output = message.content[0].type === 'text' ? message.content[0].text : ''

  await supabase.from('ai_tool_usage').insert({
    user_id: profile.id,
    tool: 'prompt_library',
    prompt_id: promptId ?? null,
    output_length: output.length,
    time_saved_mins: timeSavedMins ?? 0,
  })

  return NextResponse.json({
    output,
    onTrial: limits.onTrial,
    runsUsed: limits.runsUsed + 1,
  })
}
