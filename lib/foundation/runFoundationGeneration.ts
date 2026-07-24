import type { SupabaseClient } from '@supabase/supabase-js'
import {
  runAgent,
  createOrchestrationSession,
  completeOrchestration,
} from '@/lib/agents/runner'
import { scheduleCreativeDirectionCacheRefresh } from '@/lib/agents/foundationCreativeDirection/cache'
import { ensureDefaultAgentSchedules } from '@/lib/agents/ensureDefaultSchedules'
import { formatCompetitorsForAgent } from '@/lib/foundation/competitorsArray'

const FOUNDATION_MODEL = 'anthropic/claude-sonnet-4'

const SECTION_DOCS: Record<string, string[]> = {
  business: ['brief', 'plan'],
  customer: ['icp'],
  position: ['positioning'],
  voice: ['voice'],
  plan: ['plan'],
}

const ALL_DOC_SPECS = [
  {
    type: 'brief',
    title: 'Business Brief',
    buildPrompt: () =>
      `Based on this business context, write a concise Business Brief in 3 short paragraphs: (1) What the business does and who it serves, (2) The problem it solves and the transformation it creates, (3) Where it stands in the market. Write in second person ("Your business..."). Max 150 words total.`,
  },
  {
    type: 'icp',
    title: 'Ideal Customer Profile',
    buildPrompt: () =>
      `Based on this business context, create an Ideal Customer Profile. Include: a name and description for the persona, their demographics, their daily frustrations, what they've tried before, what makes them finally buy, and 3 things they say to themselves before purchasing. Format as clear sections with headers. Max 250 words.`,
  },
  {
    type: 'positioning',
    title: 'Positioning Statement',
    buildPrompt: () =>
      `Based on this business context, write: (1) A one-line positioning statement using this format: "For [customer] who [problem], [business] is the [category] that [differentiator] because [reason to believe]." (2) A one-paragraph brand promise (3-4 sentences). (3) Three proof points that support the positioning. Max 200 words total.`,
  },
  {
    type: 'voice',
    title: 'Brand Voice Guide',
    buildPrompt: (answers: Record<string, unknown>) =>
      `Based on this business context and their tone traits (${((answers.toneTraits as string[] | undefined) ?? []).join(', ')}), create a Brand Voice Guide with: (1) Voice description in 2 sentences, (2) 4 voice rules (specific do's), (3) 3 things to never say/do, (4) 2 example sentences showing the voice in action for social media. Max 250 words.`,
  },
  {
    type: 'plan',
    title: '30-Day Marketing Plan',
    buildPrompt: (answers: Record<string, unknown>) =>
      `Based on this business context, create a focused 30-day marketing plan. Structure it as 4 weeks with a theme for each week. For each week: the focus area, 3-4 specific daily actions with the channel and estimated time. Also include: 3 quick wins to do in the first 48 hours, and 4 metrics to track. Budget: ${answers.marketingBudget}. Primary channels: ${((answers.channels as string[] | undefined) ?? []).join(', ')}. Goal: ${answers.monthlyGoal}. Be specific and actionable. Max 400 words.`,
  },
] as const

export type RunFoundationGenerationInput = {
  profileId: string
  userPlan: string
  companyName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answers: Record<string, any>
  sections?: string[]
  markComplete?: boolean
}

export type RunFoundationGenerationResult =
  | { ok: true; generated: string[]; missing: string[] }
  | { ok: false; error: string; generated?: string[]; missing?: string[]; status?: number }

function buildContext(answers: Record<string, unknown>, companyName: string): string {
  return `
Business: ${companyName}
What they do: ${answers.businessDescription}
Problem they solve: ${answers.problemSolved}
Transformation: ${answers.transformation}
Ideal customer: ${answers.customerWho}
Customer frustration: ${answers.customerFrustration}
What customer tried before: ${answers.customerTriedBefore}
Buying trigger: ${answers.customerBuyingTrigger}
Competitors: ${formatCompetitorsForAgent(answers.competitors) || 'None specified'}
Differentiator: ${answers.differentiator}
In their words: ${answers.differentiatorOwn}
Tone traits: ${(answers.toneTraits as string[] | undefined)?.join(', ')}
Brands admired: ${answers.brandsAdmired}
Never sound like: ${answers.neverSoundLike}
Budget: ${answers.marketingBudget}
Channels: ${(answers.channels as string[] | undefined)?.join(', ')}
Monthly goal: ${answers.monthlyGoal}
  `.trim()
}

export async function runFoundationGeneration(
  supabase: SupabaseClient,
  input: RunFoundationGenerationInput,
): Promise<RunFoundationGenerationResult> {
  const { profileId, userPlan, companyName, answers, sections: sectionFilter, markComplete = true } = input

  const context = buildContext(answers, companyName)
  const docFilter = sectionFilter?.length
    ? new Set(sectionFilter.flatMap(s => SECTION_DOCS[s] ?? []))
    : null

  const docsToGenerate = (docFilter
    ? ALL_DOC_SPECS.filter(d => docFilter.has(d.type))
    : ALL_DOC_SPECS
  ).map(doc => ({
    type: doc.type,
    title: doc.title,
    prompt: doc.buildPrompt(answers),
  }))

  const saved: string[] = []
  let orchestrationId: string | undefined

  try {
    orchestrationId = await createOrchestrationSession({
      userId: profileId,
      triggeredBy: 'foundation_generate',
      plan: userPlan,
      subagentCount: docsToGenerate.length,
      agentIds: docsToGenerate.map(d => `foundation_generate_${d.type}`),
    })

    const results = await Promise.allSettled(
      docsToGenerate.map(async doc => {
        const result = await runAgent({
          userId: profileId,
          agentId: `foundation_generate_${doc.type}`,
          model: FOUNDATION_MODEL,
          messages: [{ role: 'user', content: `${doc.prompt}\n\nBUSINESS CONTEXT:\n${context}` }],
          plan: userPlan,
          orchestrationId,
          maxTokens: 1000,
          chargeCredits: false,
        })
        if (!result.content) throw new Error(`Empty content returned for ${doc.type}`)
        return { ...doc, content: result.content }
      }),
    )

    let creditError = false
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { type, title, content } = result.value
        const { error: upsertError } = await supabase
          .from('foundation_documents')
          .upsert(
            {
              user_id: profileId,
              type,
              title,
              markdown: content,
              version: 1,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,type' },
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
      return { ok: false, error: 'INSUFFICIENT_CREDITS', status: 402 }
    }

    const missing = docsToGenerate.map(d => d.type).filter(t => !saved.includes(t))
    const allSaved = saved.length === docsToGenerate.length

    if (allSaved && markComplete && !sectionFilter?.length) {
      await supabase
        .from('profiles')
        .update({
          foundation_complete: true,
          onboarding_complete: true,
          foundation_step: 5,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId)

      await ensureDefaultAgentSchedules(supabase, profileId).catch((err: unknown) =>
        console.error('Schedule seeding failed (non-fatal):', err),
      )
    }

    if (!allSaved) {
      return {
        ok: false,
        error: 'Some foundation documents could not be generated.',
        generated: saved,
        missing,
        status: 500,
      }
    }

    scheduleCreativeDirectionCacheRefresh(profileId, companyName)

    return { ok: true, generated: saved, missing }
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'INSUFFICIENT_CREDITS' || msg === 'BUDGET_EXCEEDED') {
      return { ok: false, error: msg, status: 402 }
    }
    console.error('Foundation generate failed:', err)
    return { ok: false, error: 'Generation failed', status: 500 }
  } finally {
    if (orchestrationId) {
      await completeOrchestration(orchestrationId).catch(console.error)
    }
  }
}
