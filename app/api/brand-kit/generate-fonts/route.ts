import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { openRouterComplete } from '@/lib/agents/openrouter'
import { deductCredits } from '@/lib/credits'

const COST = 2

interface FontDef { family: string; weight: string; size_guide: string }
interface Pairing { name: string; rationale: string; heading: FontDef; body: FontDef }

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, company_name, foundation_answers')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  const profile = profileRows?.[0] ?? null
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: bal } = await supabase
    .from('credit_balances')
    .select('balance')
    .eq('user_id', profile.id)
    .single()
  if ((bal?.balance ?? 0) < COST) {
    return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
  }

  const answers = (profile.foundation_answers ?? {}) as Record<string, unknown>
  const companyName = (profile.company_name as string | null) ?? 'this business'

  const arr = (v: unknown) => Array.isArray(v) ? (v as string[]).join(', ') : String(v ?? '')

  const context = [
    `Business: ${companyName}`,
    `What they do: ${answers.businessDescription ?? ''}`,
    `Tone traits: ${arr(answers.toneTraits)}`,
    `Brands admired: ${answers.brandsAdmired ?? ''}`,
    `Never sound like: ${answers.neverSoundLike ?? ''}`,
    `Differentiator: ${answers.differentiatorOwn ?? ''}`,
    `Ideal customer: ${answers.customerWho ?? ''}`,
  ].join('\n')

  const prompt = `You are a brand typography specialist. Based on the business context below, suggest exactly 2 distinct font pairings.

Return ONLY valid JSON — no markdown fences, no explanation, no other text:
{
  "pairings": [
    {
      "name": "Pairing Name",
      "rationale": "One sentence why this fits the brand's tone and audience",
      "heading": { "family": "Font Family", "weight": "700", "size_guide": "H1: 48px, H2: 32px, H3: 24px" },
      "body": { "family": "Font Family", "weight": "400, 600", "size_guide": "Body: 16px, Small: 14px" }
    }
  ]
}

Rules:
- Use only freely available Google Fonts
- The two pairings must be meaningfully different from each other (different moods/styles)
- Name should be 2–3 words describing the pairing style (e.g. "Editorial & Clean", "Bold & Warm")
- Rationale must be one sentence, specific to this brand — not generic typography advice
- Weights: list comma-separated weights the brand should use (e.g. "400, 600, 700")
- Size guide: practical H1/H2/H3/Body/Small scale

BUSINESS CONTEXT:
${context}`

  let raw = ''
  try {
    const result = await openRouterComplete({
      model: 'anthropic/claude-haiku-4-5',
      max_tokens: 700,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    })
    raw = result.content.trim()
  } catch (err) {
    console.error('[generate-fonts] openRouterComplete error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }

  let parsed: { pairings: Pairing[] }
  try {
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
    parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed.pairings) || parsed.pairings.length === 0) throw new Error('Empty pairings')
  } catch (err) {
    console.error('[generate-fonts] JSON parse error:', err, '\nRaw:', raw)
    return NextResponse.json({ error: 'Failed to parse font suggestions' }, { status: 500 })
  }

  try {
    await deductCredits(profile.id, COST, 'Brand Kit — generate font pairings')
  } catch {
    console.warn('[generate-fonts] credit deduction failed')
  }

  return NextResponse.json({ pairings: parsed.pairings })
}
