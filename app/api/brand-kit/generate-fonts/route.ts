import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { openRouterComplete } from '@/lib/agents/openrouter'
import { deductCredits, refundCredits } from '@/lib/credits'
import { ACTION_CREDIT_COST } from '@/lib/credits/actionCosts'
import { BRAND_KIT_TRIAL_LOCKED, isBrandKitLockedForClerkUser } from '@/lib/billing/brandKitLock'
import { brandKitGateResponse, requireBrandKitWorkspace } from '@/lib/brandKit/brandKitWorkspace'

const COST = ACTION_CREDIT_COST.brandkit_gen

interface FontDef { family: string; weight: string; size_guide: string }
interface Pairing { name: string; rationale: string; heading: FontDef; body: FontDef }

export async function POST() {
  const supabase = createServiceClient()
  const gate = await requireBrandKitWorkspace(supabase)
  if (!gate.ok) return brandKitGateResponse(gate)

  if (await isBrandKitLockedForClerkUser(supabase, gate.clerkUserId)) {
    return NextResponse.json(
      { error: 'Brand Kit is locked during your free trial.', code: BRAND_KIT_TRIAL_LOCKED },
      { status: 403 },
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_name, foundation_answers')
    .eq('id', gate.workspaceId)
    .maybeSingle()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  try {
    await deductCredits(profile.id, COST, 'Brand Kit — generate font pairings reserved')
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'INSUFFICIENT_CREDITS') {
      return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
    }
    console.error('[generate-fonts] credit deduction failed:', err)
    return NextResponse.json({ error: 'Credit deduction failed' }, { status: 500 })
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
    await refundCredits(profile.id, COST, 'Brand Kit — font pairings generation failed refund').catch(() => {})
    console.error('[generate-fonts] openRouterComplete error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }

  let parsed: { pairings: Pairing[] }
  try {
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
    parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed.pairings) || parsed.pairings.length === 0) throw new Error('Empty pairings')
  } catch (err) {
    await refundCredits(profile.id, COST, 'Brand Kit — font pairings parse failed refund').catch(() => {})
    console.error('[generate-fonts] JSON parse error:', err, '\nRaw:', raw)
    return NextResponse.json({ error: 'Failed to parse font suggestions' }, { status: 500 })
  }

  return NextResponse.json({ pairings: parsed.pairings })
}
