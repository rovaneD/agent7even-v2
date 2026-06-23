import { openRouterComplete } from '@/lib/agents/openrouter'
import { loadFoundationContext } from '@/lib/agents/loadFoundationContext'
import { loadFieldScores } from '@/lib/foundation/sectionStrength'
import { buildCreativeDirectionInput } from './buildInput'
import {
  CreativeDirectionSchema,
  type CreativeDirection,
} from './types'

export { buildCreativeDirectionInput, listThinGatedSections } from './buildInput'
export {
  CreativeDirectionSchema,
  formatCreativeDirectionBlock,
  type CreativeDirection,
} from './types'

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4'

export function creativeDirectionModel(): string {
  return process.env.CREATIVE_DIRECTION_MODEL ?? DEFAULT_MODEL
}

const SYSTEM_PROMPT = `You are a brand strategist translating onboarding data into structured creative direction for image and video generation.
Output ONLY valid JSON matching this schema. No markdown fences. No commentary.

{
  "voiceProfile": {
    "toneDo": string[],
    "toneDont": string[],
    "voiceSummary": string
  },
  "customerPain": string,
  "headlineAngles": string[],
  "product": {
    "category": string,
    "keyNouns": string[],
    "mustNotDepict": string[]
  },
  "visualDirection": {
    "aesthetic": string,
    "lighting": string,
    "casting": string,
    "paletteWords": string[],
    "forbiddenVisuals": string[]
  },
  "weakSignals": string[]
}

Rules:
- PRIMARY source: raw Foundation answers (especially visual* fields).
- SECONDARY: generated documents — fill gaps only; never contradict explicit answers.
- voiceProfile.toneDo / toneDont: from toneTraits, neverSoundLike, brandsAdmired.
- customerPain: one sharp sentence — who hurts and why — not a paragraph.
- headlineAngles: 3–5 distinct angles from pain + differentiator + transformation; no generic "grow your business" filler.
- product.category: plain language specific to this business (not "software company" or "SaaS platform" unless answers say so).
- product.keyNouns: concrete nouns safe to depict (visualHeroSubjects + businessDescription).
- product.mustNotDepict: merge visualMustNotDepict with visual anti-patterns from neverSoundLike.
- visualDirection: descriptive language only — NO hex codes, NO font names, NO color token names.
- visualDirection.aesthetic "warm" means human/candid photography tone — NOT brown/orange UI colors or sepia scene grading.
- visualDirection.lighting: prefer neutral/cool or clean office daylight — NOT sepia, brown wash, golden-hour amber, or coffee-shop mood unless answers explicitly request it.
- visualDirection.paletteWords: copy visualPaletteWords from answers when present; do NOT add "warm undertones", amber, terracotta, or brown unless the owner explicitly wrote those color words.
- visualDirection.forbiddenVisuals: always include invented logos on laptop lids, neon/wall brand signage, and sepia/brown color grading when logo is not requested.
- For tech/SaaS brands with blue in visualPaletteWords: primary accent is electric blue + charcoal/white — never default CTAs to brown or terracotta.
- weakSignals: for each gated section (customer, position, voice) with average score 70–84, one actionable warning using field feedback when present; omit if section ≥85 or unscored.
- If visual answers are empty or thin, infer cautiously from voice/brandsAdmired and add a weakSignal about thin visual identity.`

/** One LLM call: Foundation in → validated CreativeDirection JSON out. */
export async function translateFoundationToCreativeDirection(opts: {
  profileId: string
  companyName: string
}): Promise<CreativeDirection> {
  const [ctx, fieldScores] = await Promise.all([
    loadFoundationContext(opts.profileId),
    loadFieldScores(opts.profileId),
  ])

  if (!ctx.hasFoundation) {
    throw new Error(`No Foundation data for profile ${opts.profileId}`)
  }

  const userContent = buildCreativeDirectionInput(ctx, fieldScores, opts.companyName)

  if (process.env.DEBUG_CREATIVE_DIRECTION_INPUT === '1') {
    console.error('--- CREATIVE DIRECTION INPUT ---\n', userContent)
  }

  const result = await openRouterComplete({
    model: creativeDirectionModel(),
    temperature: 0.3,
    max_tokens: 2500,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  })

  const raw = result.content
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`Creative direction did not return JSON: ${raw.slice(0, 400)}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error(`Creative direction JSON parse failed: ${jsonMatch[0].slice(0, 400)}`)
  }

  const validated = CreativeDirectionSchema.safeParse(parsed)
  if (!validated.success) {
    throw new Error(
      `Creative direction schema validation failed: ${validated.error.message}\nRaw: ${jsonMatch[0].slice(0, 400)}`,
    )
  }

  return validated.data
}
