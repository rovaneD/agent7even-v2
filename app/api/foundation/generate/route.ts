import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  runAgent,
  createOrchestrationSession,
  completeOrchestration,
} from '@/lib/agents/runner'

const FOUNDATION_MODEL = 'anthropic/claude-sonnet-4'

export const maxDuration = 120

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { answers, companyName } = await req.json()
  const supabase = createServiceClient()

  // Ensure profile row exists
  await supabase
    .from('profiles')
    .upsert({ clerk_user_id: userId, role: 'client', status: 'onboarding' }, { onConflict: 'clerk_user_id', ignoreDuplicates: true })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, plan, foundation_complete')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const isInitialFoundationGeneration = !profile.foundation_complete

  const context = `
Business: ${companyName}
What they do: ${answers.businessDescription}
Problem they solve: ${answers.problemSolved}
Transformation: ${answers.transformation}
Ideal customer: ${answers.customerWho}
Customer frustration: ${answers.customerFrustration}
What customer tried before: ${answers.customerTriedBefore}
Buying trigger: ${answers.customerBuyingTrigger}
Competitors: ${answers.competitors?.filter(Boolean).join(', ')}
Differentiator: ${answers.differentiator}
In their words: ${answers.differentiatorOwn}
Tone traits: ${answers.toneTraits?.join(', ')}
Brands admired: ${answers.brandsAdmired}
Never sound like: ${answers.neverSoundLike}
Budget: ${answers.marketingBudget}
Channels: ${answers.channels?.join(', ')}
Monthly goal: ${answers.monthlyGoal}
  `.trim()

  const docsToGenerate = [
    {
      type: 'brief',
      title: 'Business Brief',
      prompt: `Based on this business context, write a concise Business Brief in 3 short paragraphs: (1) What the business does and who it serves, (2) The problem it solves and the transformation it creates, (3) Where it stands in the market. Write in second person ("Your business..."). Max 150 words total.`,
    },
    {
      type: 'icp',
      title: 'Ideal Customer Profile',
      prompt: `Based on this business context, create an Ideal Customer Profile. Include: a name and description for the persona, their demographics, their daily frustrations, what they've tried before, what makes them finally buy, and 3 things they say to themselves before purchasing. Format as clear sections with headers. Max 250 words.`,
    },
    {
      type: 'positioning',
      title: 'Positioning Statement',
      prompt: `Based on this business context, write: (1) A one-line positioning statement using this format: "For [customer] who [problem], [business] is the [category] that [differentiator] because [reason to believe]." (2) A one-paragraph brand promise (3-4 sentences). (3) Three proof points that support the positioning. Max 200 words total.`,
    },
    {
      type: 'voice',
      title: 'Brand Voice Guide',
      prompt: `Based on this business context and their tone traits (${answers.toneTraits?.join(', ')}), create a Brand Voice Guide with: (1) Voice description in 2 sentences, (2) 4 voice rules (specific do's), (3) 3 things to never say/do, (4) 2 example sentences showing the voice in action for social media. Max 250 words.`,
    },
    {
      type: 'plan',
      title: '30-Day Marketing Plan',
      prompt: `Based on this business context, create a focused 30-day marketing plan. Structure it as 4 weeks with a theme for each week. For each week: the focus area, 3-4 specific daily actions with the channel and estimated time. Also include: 3 quick wins to do in the first 48 hours, and 4 metrics to track. Budget: ${answers.marketingBudget}. Primary channels: ${answers.channels?.join(', ')}. Goal: ${answers.monthlyGoal}. Be specific and actionable. Max 400 words.`,
    },
  ]

  const userPlan: string = (profile as Record<string, unknown>).plan as string ?? 'starter'
  const saved: string[] = []
  let orchestrationId: string | undefined

  try {
    orchestrationId = await createOrchestrationSession({
      userId:        profile.id,
      triggeredBy:   'foundation_generate',
      plan:          userPlan,
      subagentCount: docsToGenerate.length,
      agentIds:      docsToGenerate.map(d => `foundation_generate_${d.type}`),
    })

    // Generate all 5 docs in parallel — one failure doesn't kill the rest
    const results = await Promise.allSettled(
      docsToGenerate.map(async (doc) => {
        const result = await runAgent({
          userId:          profile.id,
          agentId:         `foundation_generate_${doc.type}`,
          model:           FOUNDATION_MODEL,
          messages:        [{ role: 'user', content: `${doc.prompt}\n\nBUSINESS CONTEXT:\n${context}` }],
          plan:            userPlan,
          orchestrationId,
          maxTokens:       1000,
          chargeCredits:   !isInitialFoundationGeneration,
        })
        if (!result.content) throw new Error(`Empty content returned for ${doc.type}`)
        return { ...doc, content: result.content }
      })
    )

    let creditError = false
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { type, title, content } = result.value
        const { error: upsertError } = await supabase
          .from('foundation_documents')
          .upsert(
            { user_id: profile.id, type, title, markdown: content, version: 1, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,type' }
          )
        if (upsertError) {
          console.error('Document upsert failed:', type, upsertError)
        } else {
          saved.push(type)
        }
      } else {
        const msg: string = result.reason?.message ?? ''
        console.error('Doc generation failed:', msg)
        if (msg === 'INSUFFICIENT_CREDITS' || msg === 'BUDGET_EXCEEDED') creditError = true
      }
    }

    if (creditError && saved.length === 0) {
      return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
    }

    const missing = docsToGenerate.map(d => d.type).filter(t => !saved.includes(t))
    const allSaved = saved.length === docsToGenerate.length

    if (allSaved) {
      await supabase
        .from('profiles')
        .update({
          foundation_complete: true,
          onboarding_complete: true,
          foundation_step:     5,
          updated_at:          new Date().toISOString(),
        })
        .eq('id', profile.id)
    }

    if (!allSaved) {
      return NextResponse.json(
        { error: 'Some foundation documents could not be generated.', generated: saved, missing },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, generated: saved, missing })

  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'INSUFFICIENT_CREDITS' || msg === 'BUDGET_EXCEEDED') {
      return NextResponse.json({ error: msg }, { status: 402 })
    }
    console.error('Foundation generate failed:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  } finally {
    if (orchestrationId) {
      await completeOrchestration(orchestrationId).catch(console.error)
    }
  }
}
