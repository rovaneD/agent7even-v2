import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { exaReadSite, exaSynthesizeFoundation, type FoundationSuggestions, type ExaGrounding } from '@/lib/research/exa'

type ConfidenceMap = Record<string, 'low' | 'medium' | 'high'>

// Fields eligible for pre-fill and their minimum required confidence.
// Voice (toneTraits, brandsAdmired, neverSoundLike) and Budget/Goals are never pre-filled.
const CONFIDENCE_THRESHOLDS: Record<keyof FoundationSuggestions, 'medium' | 'high'> = {
  businessDescription: 'high',
  problemSolved:       'high',
  transformation:      'high',
  customerWho:         'high',
  competitors:         'medium', // headline win — surface at medium
  differentiatorOwn:   'high',
}

function buildConfidenceMap(grounding: ExaGrounding[]): ConfidenceMap {
  const map: ConfidenceMap = {}
  for (const g of grounding) {
    map[g.field] = g.confidence
  }
  return map
}

function applyConfidenceGate(
  suggestions: FoundationSuggestions,
  confidence: ConfidenceMap
): FoundationSuggestions {
  // If grounding has no field-level entries, use overall confidence (first entry) for all fields.
  const overallConfidence = Object.values(confidence)[0] ?? undefined

  const gated: FoundationSuggestions = {}

  for (const [field, minThreshold] of Object.entries(CONFIDENCE_THRESHOLDS) as [keyof FoundationSuggestions, 'medium' | 'high'][]) {
    const raw = suggestions[field]
    if (raw == null || (Array.isArray(raw) && raw.length === 0)) continue

    const fieldConfidence = confidence[field] ?? overallConfidence
    if (!fieldConfidence) continue

    const meetsThreshold =
      minThreshold === 'medium'
        ? fieldConfidence === 'medium' || fieldConfidence === 'high'
        : fieldConfidence === 'high'

    if (meetsThreshold) {
      (gated as Record<string, unknown>)[field] = raw
    }
  }

  return gated
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { website, businessName } = body as { website?: string; businessName?: string }

    if (!website && !businessName) {
      return NextResponse.json({ error: 'website or businessName required' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    // 1. Read their site (if URL given). Fail-soft.
    const siteRead = website ? await exaReadSite(website) : null

    // 2. Synthesize Foundation fields via Exa outputSchema. Fail-soft.
    const seed = businessName || siteRead?.title || website || ''
    const synthesis = seed ? await exaSynthesizeFoundation(seed, siteRead?.text) : null

    if (!synthesis) {
      return NextResponse.json({ research: null, prefilled: false })
    }

    // 3. Apply confidence gate — only include fields with sufficient confidence.
    const confidenceMap = buildConfidenceMap(synthesis.grounding)
    const gatedSuggestions = applyConfidenceGate(synthesis.suggestions, confidenceMap)

    const hasAnySuggestion = Object.values(gatedSuggestions).some(
      (v) => v != null && (!Array.isArray(v) || v.length > 0)
    )
    if (!hasAnySuggestion) {
      return NextResponse.json({ research: null, prefilled: false })
    }

    const research = {
      website:     website ?? null,
      siteTitle:   siteRead?.title ?? null,
      suggestions: gatedSuggestions,
      confidence:  confidenceMap,
    }

    // 4. Persist research + variant. Cost = 0 during free-tier test — no deductCredits call.
    await supabase
      .from('profiles')
      .update({
        foundation_research:         research,
        foundation_research_variant: 'exa_prefill',
      })
      .eq('id', profile.id)

    return NextResponse.json({ research, prefilled: true })
  } catch {
    // Never throw to client — onboarding must not hang on research failures.
    return NextResponse.json({ research: null, prefilled: false })
  }
}
