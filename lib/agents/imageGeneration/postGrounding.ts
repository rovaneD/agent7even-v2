import type { TextQaIssue } from './types'
import type { ImageGenerationModelId } from './imageModelCatalog'
import { modelRequiresOnImageHeadline } from './headlineRequiredBrief'
import { LAPTOP_SCREEN_SAFE_LINE } from './fakeScreenUiDetection'
import { NO_ON_IMAGE_CTA_RULE } from './onImageCtaDetection'

export type PostGroundingContext = {
  postGoal?: string
  offer?: string
  audience?: string
  mustInclude?: string
  mustAvoid?: string
}

export function postGroundingFromForm(form: Record<string, string> | undefined): PostGroundingContext | undefined {
  if (!form) return undefined
  const ctx: PostGroundingContext = {
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

export function buildGroundedSocialPostBrief(
  companyName: string,
  ctx?: PostGroundingContext,
): string {
  const goal = ctx?.postGoal?.trim() || 'the post goal from the form'
  const offer = ctx?.offer?.trim()
  const audience = ctx?.audience?.trim()
  const mustInclude = ctx?.mustInclude?.trim()

  const audienceLine = audience ? ` Audience: ${audience}.` : ''
  const includeLine = mustInclude ? ` Must reflect: ${mustInclude}.` : ''
  const offerLine = offer
    ? ` Offer context (for headline angle only, not a button): ${offer.slice(0, 60)}.`
    : ''
  const headlineWords = goal.split(/\s+/).slice(0, 8).join(' ')
  const quotedHeadline = `"${headlineWords.charAt(0).toUpperCase()}${headlineWords.slice(1)}"`

  return `Instagram/LinkedIn post graphic for ${companyName}: headline on image ${quotedHeadline} — bold sans, under 8 words, tied to ${goal}.${audienceLine}${includeLine}${offerLine} ${NO_ON_IMAGE_CTA_RULE} Full-bleed layout with headline only — optional one short subhead max, no button chrome. NOT a logo tile, invented wordmark, monogram, abstract brand-mark grid, or geometric identity symbol. Do NOT draw or invent any logo icon anywhere — no logos on laptop lids, device backs, neon wall signs, or background decor; user did not request a logo on this post. ${LAPTOP_SCREEN_SAFE_LINE} Do NOT make "${companyName}" the hero text. Company name may appear small in a corner at most. Neutral/cool photo grade with electric blue accents — no sepia, brown, or terracotta color wash. Prefer bright modern workspace or product-adjacent scenes — no random coffee-shop or lifestyle stock unless the post ask requests them. Stay on the B2B marketing SaaS product described in Foundation.`
}
