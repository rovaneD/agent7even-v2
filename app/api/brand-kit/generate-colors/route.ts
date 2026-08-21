import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { openRouterComplete } from '@/lib/agents/openrouter'
import { deductCredits, refundCredits } from '@/lib/credits'
import { ACTION_CREDIT_COST } from '@/lib/credits/actionCosts'
import { BRAND_KIT_TRIAL_LOCKED, isBrandKitLockedForClerkUser } from '@/lib/billing/brandKitLock'
import { brandKitGateResponse, requireBrandKitWorkspace } from '@/lib/brandKit/brandKitWorkspace'

const COST = ACTION_CREDIT_COST.brandkit_gen

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
    await deductCredits(profile.id, COST, 'Brand Kit — generate color palette reserved')
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'INSUFFICIENT_CREDITS') {
      return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
    }
    console.error('[generate-colors] credit deduction failed:', err)
    return NextResponse.json({ error: 'Credit deduction failed' }, { status: 500 })
  }

  const answers = (profile.foundation_answers ?? {}) as Record<string, unknown>
  const companyName = (profile.company_name as string | null) ?? 'this business'

  const context = buildContext(companyName, answers)

  const prompt = `You are a brand identity designer. Based on the business context below, suggest a brand color palette of exactly 5 colors.

Return ONLY valid JSON — no markdown fences, no explanation, no other text:
{
  "colors": [
    { "name": "Color Name", "hex": "#RRGGBB", "rgb": "R, G, B", "role": "primary" }
  ]
}

Rules:
- Roles must be from: primary, secondary, accent, neutral
- Include exactly 1 primary, 1 secondary, 1–2 accents, 1–2 neutrals (5 total)
- Hex values must be valid 6-digit hex codes with # prefix
- RGB values must correctly match the hex
- Color names must be evocative and brand-appropriate (e.g. "Ember Orange" not just "Orange")
- Palette should feel cohesive and reflect the brand's tone and personality

BUSINESS CONTEXT:
${context}`

  let raw = ''
  try {
    const result = await openRouterComplete({
      model: 'anthropic/claude-haiku-4-5',
      max_tokens: 600,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    })
    raw = result.content.trim()
  } catch (err) {
    await refundCredits(profile.id, COST, 'Brand Kit — color palette generation failed refund').catch(() => {})
    console.error('[generate-colors] openRouterComplete error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }

  // Parse JSON — strip any accidental markdown fences
  let parsed: { colors: Array<{ name: string; hex: string; rgb: string; role: string }> }
  try {
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
    parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed.colors) || parsed.colors.length === 0) throw new Error('Empty colors array')
  } catch (err) {
    await refundCredits(profile.id, COST, 'Brand Kit — color palette parse failed refund').catch(() => {})
    console.error('[generate-colors] JSON parse error:', err, '\nRaw:', raw)
    return NextResponse.json({ error: 'Failed to parse color suggestions' }, { status: 500 })
  }

  return NextResponse.json({ colors: parsed.colors })
}

function buildContext(companyName: string, a: Record<string, unknown>): string {
  const arr = (v: unknown) => Array.isArray(v) ? (v as string[]).join(', ') : String(v ?? '')
  return [
    `Business: ${companyName}`,
    `What they do: ${a.businessDescription ?? ''}`,
    `Problem solved: ${a.problemSolved ?? ''}`,
    `Transformation: ${a.transformation ?? ''}`,
    `Ideal customer: ${a.customerWho ?? ''}`,
    `Differentiator: ${a.differentiator ?? ''} — ${a.differentiatorOwn ?? ''}`,
    `Tone traits: ${arr(a.toneTraits)}`,
    `Brands admired: ${a.brandsAdmired ?? ''}`,
    `Never sound like: ${a.neverSoundLike ?? ''}`,
  ].join('\n')
}
