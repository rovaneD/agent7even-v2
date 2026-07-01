import { auth } from '@clerk/nextjs/server'
import { formatCompetitorsForAgent } from '@/lib/foundation/competitorsArray'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { openRouterComplete } from '@/lib/agents/openrouter'

const DOC_TITLE_MAP: Record<string, string> = {
  brief: 'Business Brief',
  icp: 'Ideal Customer Profile',
  positioning: 'Positioning Statement',
  voice: 'Brand Voice Guide',
  plan: '30-Day Marketing Plan',
  tagline: 'Tagline',
  elevator_pitch: 'Elevator Pitch',
  about_us: 'About Us',
  mission: 'Mission Statement',
}

const VALID_DOC_TYPES = ['brief', 'icp', 'positioning', 'voice']

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { docType } = await req.json()

  if (!docType || !VALID_DOC_TYPES.includes(docType)) {
    return NextResponse.json(
      { error: `Invalid docType. Must be one of: ${VALID_DOC_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Fetch profile with foundation_answers
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, company_name, foundation_answers')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  const profile = profileRows?.[0] ?? null

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!profile.foundation_answers) {
    return NextResponse.json({ error: 'No foundation answers found' }, { status: 400 })
  }

  // foundation_answers is JSONB — already parsed by the Supabase client
  const answers = profile.foundation_answers as Record<string, unknown>
  const companyName = (profile.company_name as string | null) ?? 'Your Business'

  const context = `
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
Tone traits: ${Array.isArray(answers.toneTraits) ? (answers.toneTraits as string[]).join(', ') : answers.toneTraits}
Brands admired: ${answers.brandsAdmired}
Never sound like: ${answers.neverSoundLike}
Budget: ${answers.marketingBudget}
Channels: ${Array.isArray(answers.channels) ? (answers.channels as string[]).join(', ') : answers.channels}
Monthly goal: ${answers.monthlyGoal}
  `.trim()

  const promptMap: Record<string, string> = {
    brief: `Based on this business context, write a concise Business Brief in 3 short paragraphs: (1) What the business does and who it serves, (2) The problem it solves and the transformation it creates, (3) Where it stands in the market. Write in second person ("Your business..."). Max 150 words total.`,
    icp: `Based on this business context, create an Ideal Customer Profile. Include: a name and description for the persona, their demographics, their daily frustrations, what they've tried before, what makes them finally buy, and 3 things they say to themselves before purchasing. Format as clear sections with headers. Max 250 words.`,
    positioning: `Based on this business context, write: (1) A one-line positioning statement using this format: "For [customer] who [problem], [business] is the [category] that [differentiator] because [reason to believe]." (2) A one-paragraph brand promise (3-4 sentences). (3) Three proof points that support the positioning. Max 200 words total.`,
    voice: `Based on this business context and their tone traits (${Array.isArray(answers.toneTraits) ? (answers.toneTraits as string[]).join(', ') : answers.toneTraits}), create a Brand Voice Guide with: (1) Voice description in 2 sentences, (2) 4 voice rules (specific do's), (3) 3 things to never say/do, (4) 2 example sentences showing the voice in action for social media. Max 250 words.`,
  }

  let generated = ''

  try {
    const result = await openRouterComplete({
      model: 'anthropic/claude-haiku-4-5',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `${promptMap[docType]}\n\nBUSINESS CONTEXT:\n${context}`,
        },
      ],
    })
    generated = result.content
  } catch (err) {
    console.error('openRouterComplete failed during regenerate:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }

  // Fetch existing version to increment
  const { data: existingDoc } = await supabase
    .from('foundation_documents')
    .select('version')
    .eq('user_id', profile.id)
    .eq('type', docType)
    .single()

  const newVersion = (existingDoc?.version ?? 0) + 1

  const { error: upsertError } = await supabase
    .from('foundation_documents')
    .upsert(
      {
        user_id: profile.id,
        type: docType,
        markdown: generated,
        title: DOC_TITLE_MAP[docType] ?? docType,
        version: newVersion,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,type' }
    )

  if (upsertError) {
    console.error('Document upsert error after regeneration:', upsertError)
    return NextResponse.json({ error: 'Failed to save regenerated document' }, { status: 500 })
  }

  return NextResponse.json({ success: true, type: docType, content: generated })
}
