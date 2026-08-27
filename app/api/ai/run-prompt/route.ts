import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { getToolkitPlanLimits } from '@/lib/ai/toolkitPlanLimits'
import { CATEGORY_MIN_PLAN, meetsPlanRequirement } from '@/lib/ai/toolkitCategoryPlan'
import {
  requireToolkitWorkspace,
  toolkitWorkspaceGateResponse,
} from '@/lib/ai/toolkitWorkspace'
import { hasPlatformAccess } from '@/lib/plans'
import { TRIAL_TOOLKIT_RUNS } from '@/lib/billing/trialPolicy'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const {
    promptId,
    prompt,
    timeSavedMins,
    useBrandVoice = false,
  } = await req.json()

  const supabase = createServiceClient()
  const workspace = await requireToolkitWorkspace(supabase)
  if (!workspace.ok) return toolkitWorkspaceGateResponse(workspace)

  const { workspaceId, profile } = workspace

  // Require the workspace owner's paid plan in good billing standing —
  // failed payments set status 'paused' while plan stays populated.
  if (!hasPlatformAccess(profile.plan, profile.status, profile.billing_exempt ?? false)) {
    return NextResponse.json({ error: 'No active plan', code: 'NO_PLAN' }, { status: 403 })
  }

  // Tier gate: category comes from the prompt library row, not the client —
  // the lock badges in the UI must hold when someone POSTs directly.
  if (promptId) {
    const { data: libraryPrompt } = await supabase
      .from('prompt_library')
      .select('category')
      .eq('id', promptId)
      .maybeSingle()

    const requiredPlan = CATEGORY_MIN_PLAN[libraryPrompt?.category ?? 'general'] ?? 'starter'
    if (!meetsPlanRequirement(profile.plan, requiredPlan)) {
      return NextResponse.json({
        error: `This tool requires the ${requiredPlan === 'proagent' ? 'ProAgent' : 'Growth'} plan.`,
        code: 'PLAN_TIER',
      }, { status: 403 })
    }
  }

  const limits = await getToolkitPlanLimits(supabase, {
    id: workspaceId,
    plan: profile.plan,
    stripe_subscription_id: profile.stripe_subscription_id,
  })

  if (!limits.unlimited && limits.runsUsed >= limits.runLimit) {
    if (limits.onTrial) {
      return NextResponse.json({
        error: `Trial AI limit reached. Your trial includes ${TRIAL_TOOLKIT_RUNS} AI Toolkit runs total.`,
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

  // Brand voice follows the Brand Kit toggle (unlocked on trial as of trial v2).
  const brandVoiceAllowed = useBrandVoice

  if (brandVoiceAllowed) {
    const { data: brandDocs } = await supabase
      .from('brand_documents')
      .select('type, content')
      .eq('user_id', workspaceId)
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
    user_id: workspaceId,
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
