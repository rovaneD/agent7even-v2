import type { TextQaIssue } from './types'
import type { ImageGenerationModelId } from './imageModelCatalog'
import { modelRequiresOnImageHeadline } from './headlineRequiredBrief'
import { hasObjectivePrefix, isPostGoalObjective, objectiveAngle, stripObjectivePrefix } from './postObjective'

export type PostGroundingContext = {
  topic?: string
  /** Foundation headline angles — used when a retry needs a fresh headline. */
  headlineAngles?: string[]
  /** Foundation casting — who appears in this company's pictures; used by the fallback scene. */
  casting?: string
  postGoal?: string
  offer?: string
  audience?: string
  mustInclude?: string
  mustAvoid?: string
}

export function postGroundingFromForm(form: Record<string, string> | undefined): PostGroundingContext | undefined {
  if (!form) return undefined
  const ctx: PostGroundingContext = {
    topic: form.topic?.trim(),
    postGoal: form.postGoal?.trim(),
    offer: form.offer?.trim(),
    audience: form.audience?.trim(),
    mustInclude: form.mustInclude?.trim(),
    mustAvoid: form.mustAvoid?.trim(),
  }
  return Object.values(ctx).some(Boolean) ? ctx : undefined
}

function normalize(text: string): string {
  return text.replace(/[^\w\s']/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
}

const GENERIC_HEADLINE_PATTERNS = [
  /^boost your brand$/i,
  /^real talk over coffee$/i,
  /^let'?s talk$/i,
  /^let'?s connect$/i,
  /^grow your business$/i,
  /^elevate your brand$/i,
  /^your success starts here$/i,
  /^marketing made simple$/i,
  /^coffee (?:chat|talk)s?$/i,
]

/** Stock filler headlines with no product or pain-point tie-in. */
export function detectGenericHeadlineInImageText(
  transcription: string | null | undefined,
  ctx?: PostGroundingContext,
): TextQaIssue[] {
  const text = transcription?.trim()
  if (!text) return []

  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean)
  const primary = lines[0] ?? text

  if (lines.slice(0, 2).some(l => isPostGoalObjective(l) || hasObjectivePrefix(l))) {
    return [{
      code: 'vague_headline',
      message: 'Headline prints the post objective label (e.g. "Awareness:") — objectives are strategy, not on-image copy. Write a real marketing line instead.',
    }]
  }

  for (const pattern of GENERIC_HEADLINE_PATTERNS) {
    if (pattern.test(primary) || pattern.test(text)) {
      return [{
        code: 'vague_headline',
        message: 'Headline is generic stock filler — tie it to the post goal, offer, or customer pain point from the form.',
      }]
    }
  }

  return []
}

/** Brief lacks concrete post grounding — likely vague output. */
export function detectBriefMissingPostGrounding(
  brief: string,
  ctx?: PostGroundingContext,
  modelId?: ImageGenerationModelId,
): TextQaIssue | null {
  const hasQuotedHeadline = /["'][^"']{8,}["']/.test(brief)

  if (modelId && modelRequiresOnImageHeadline(modelId)) {
    if (!hasQuotedHeadline) {
      return {
        code: 'brief_vague',
        message: 'Brief must quote a concrete on-image headline — textless editorial photos are not social post graphics.',
      }
    }
    return null
  }

  const mentionsPost =
    /\bpost goal\b/i.test(brief)
    || (ctx?.postGoal && new RegExp(normalize(ctx.postGoal).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(brief))

  if (!hasQuotedHeadline && !mentionsPost) {
    return {
      code: 'brief_vague',
      message: 'Brief does not specify a concrete marketing headline or post goal — output will be vague.',
    }
  }

  if (ctx?.offer?.trim()) {
    const offerNorm = normalize(ctx.offer)
    const briefNorm = normalize(brief)
    const offerTokens = offerNorm.split(' ').filter(t => t.length >= 4)
    const hasOfferRef = offerTokens.some(t => briefNorm.includes(t))
    const hasHeadlineQuote = /["'][^"']{6,}["']/.test(brief)
    if (!hasOfferRef && !hasHeadlineQuote) {
      return {
        code: 'brief_vague',
        message: 'Brief omits the offer from the post form — weave it into the headline, not a separate button.',
      }
    }
  }

  return null
}

/**
 * Fallback / retry brief sent straight to the image model. Positive description only:
 * image models draw whatever a prompt names, so nothing unwanted is mentioned here.
 */
export function buildGroundedSocialPostBrief(
  companyName: string,
  ctx?: PostGroundingContext,
  preservedHeadline?: string | null,
): string {
  const usable = (h?: string | null) => {
    const t = h ? stripObjectivePrefix(h.trim()).replace(/["“”]/g, '') : ''
    const words = t.split(/\s+/).filter(Boolean).length
    return words >= 2 && words <= 10 && !isPostGoalObjective(t) ? t : ''
  }

  const rawGoal = ctx?.postGoal?.trim() || ''
  const goalIsObjective = objectiveAngle(rawGoal) !== null
  const headline =
    usable(preservedHeadline)
    || usable(ctx?.headlineAngles?.find(a => usable(a)))
    || (!goalIsObjective ? usable(rawGoal.split(/\s+/).slice(0, 8).join(' ')) : '')

  const topic = ctx?.topic?.trim() ? ` The post is about: ${ctx.topic.trim().slice(0, 160)}.` : ''
  const who = ctx?.casting?.trim()
    ? `one real person drawn from this company's customers (${ctx.casting.trim().slice(0, 220)})`
    : `one real owner of a small local business`
  const typeLine = headline
    ? `Headline across the clear upper third in a bold clean sans, white with one key word in electric blue: "${headline}". This headline is the only text in the image.`
    : `Across the clear upper third, a short specific headline of four to eight words that ${objectiveAngle(rawGoal) ?? 'names the customer pain this company solves'}, in a bold clean sans, white with one key word in electric blue. That headline is the only text in the image.`

  return `Vertical 4:5 social post photo for ${companyName}.${topic} Candid documentary shot of ${who}, in their own place of work, in the middle of one specific working moment, framed in the lower two thirds with a clear, uncluttered area above. Bright natural daylight, cool-neutral color grade with deep charcoal and clean white tones. 35mm documentary photography, natural skin texture, shallow depth of field. ${typeLine}`
}
