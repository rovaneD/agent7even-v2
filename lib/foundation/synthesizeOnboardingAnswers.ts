import { openRouterComplete } from '@/lib/agents/openrouter'
import type { FoundationSuggestions } from '@/lib/research/exa'
import type { SiteSnapshot } from '@/lib/foundation/siteSnapshot'
import {
  BUDGET_OPTIONS,
  CHANNEL_OPTIONS,
  DIFFERENTIATOR_OPTIONS,
  GOAL_OPTIONS,
  TONE_OPTIONS,
} from '@/lib/foundation/onboardingOptions'
import {
  emptyOnboardingAnswers,
  normalizeOnboardingAnswers,
  type OnboardingAnswers,
} from '@/lib/foundation/onboardingAnswerShape'
import { normalizeBusinessType, type OnboardingBusinessTypeId } from '@/lib/foundation/onboardingBusinessTypes'

const SYNTHESIS_MODEL = 'anthropic/claude-sonnet-4'

export type SynthesizeOnboardingResult = {
  answers: OnboardingAnswers
  businessType: OnboardingBusinessTypeId | null
}

export async function synthesizeOnboardingAnswers(input: {
  companyName: string
  websiteUrl: string
  siteText?: string | null
  siteTitle?: string | null
  exaSuggestions?: FoundationSuggestions | null
  siteSnapshot?: SiteSnapshot | null
}): Promise<SynthesizeOnboardingResult | null> {
  const sources: string[] = [
    `Company: ${input.companyName}`,
    `Website: ${input.websiteUrl}`,
  ]
  if (input.siteTitle) sources.push(`Page title: ${input.siteTitle}`)
  if (input.siteText?.trim()) sources.push(`Site excerpt:\n${input.siteText.trim().slice(0, 6000)}`)
  if (input.exaSuggestions) sources.push(`Research hints:\n${JSON.stringify(input.exaSuggestions, null, 2)}`)
  if (input.siteSnapshot) {
    sources.push(`Strategic snapshot:\n${JSON.stringify(input.siteSnapshot, null, 2)}`)
  }

  const prompt = `You are building a complete Foundation profile for a small business marketing platform from website research.

Ground every field in the sources. Write specific, vivid copy — not generic one-liners like "small businesses" or "influencers, brands, and buyers" unless the site truly serves everyone.

Return ONLY valid JSON (no markdown fences) matching this shape:
{
  "businessType": "services" | "local" | "products",
  "businessDescription": "2-4 sentences on what they do",
  "problemSolved": "specific problem",
  "transformation": "outcome customers get",
  "customerWho": "specific ideal customer persona",
  "customerFrustration": "concrete frustrations",
  "customerTriedBefore": "what they tried before finding this business",
  "customerBuyingTrigger": "what makes them buy now",
  "competitors": ["name1", "name2", "name3"],
  "differentiator": "one of: ${DIFFERENTIATOR_OPTIONS.join(' | ')}",
  "differentiatorOwn": "differentiator in their words",
  "toneTraits": ["pick 2-4 from: ${TONE_OPTIONS.join(', ')}"],
  "brandsAdmired": "optional brand they might admire or empty string",
  "neverSoundLike": "what to avoid in voice",
  "marketingBudget": "one of: ${BUDGET_OPTIONS.join(' | ')}",
  "channels": ["pick 2-4 from: ${CHANNEL_OPTIONS.join(', ')}"],
  "monthlyGoal": "one of: ${GOAL_OPTIONS.join(' | ')}",
  "visualAesthetic": "how brand should look",
  "visualCasting": "who appears in visuals",
  "visualHeroSubjects": "hero imagery subjects",
  "visualPaletteWords": "colors in words only, no hex",
  "visualMustNotDepict": "visual anti-patterns to avoid"
}

Rules:
- businessType: services = consultants/agencies/freelancers; local = physical location businesses; products = e-commerce or product makers
- competitors: exactly 3 strings (use best guesses or plausible category peers; empty string ok if unknown)
- Use exact option strings for differentiator, marketingBudget, monthlyGoal, toneTraits, channels
- Never invent pricing, testimonials, or metrics not supported by sources
- Prefer rich paragraphs over bullet fragments

Sources:
${sources.join('\n\n')}`

  const result = await openRouterComplete({
    model: SYNTHESIS_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2500,
    temperature: 0.2,
  })

  try {
    const cleaned = result.content.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    return {
      answers: normalizeOnboardingAnswers({ ...emptyOnboardingAnswers(), ...parsed }),
      businessType: normalizeBusinessType(parsed.businessType),
    }
  } catch {
    console.error('[synthesizeOnboardingAnswers] parse failed:', result.content.slice(0, 300))
    return null
  }
}
