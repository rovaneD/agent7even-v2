import type { TextQaIssue } from './types'

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

  // Offer provided but no CTA-ish copy visible
  const offer = ctx?.offer?.trim()
  if (offer && offer.length >= 4) {
    const offerNorm = normalize(offer)
    const textNorm = normalize(text)
    const offerTokens = offerNorm.split(' ').filter(t => t.length >= 4)
    const hasOfferEcho = offerTokens.some(t => textNorm.includes(t))
    const hasCtaShape =
      /\b(start|try|get|book|sign up|learn more|free trial|let'?s talk|shop|download|join)\b/i.test(text)
    if (!hasOfferEcho && !hasCtaShape) {
      return [{
        code: 'missing_cta',
        message: 'Post form includes an offer/CTA but the image has no visible call-to-action tied to it.',
      }]
    }
  }

  return []
}

/** Brief lacks concrete post grounding — likely vague output. */
export function detectBriefMissingPostGrounding(
  brief: string,
  ctx?: PostGroundingContext,
): TextQaIssue | null {
  const hasQuotedHeadline = /["'][^"']{6,}["']/.test(brief)
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
    const hasCtaWord = /\b(?:cta|call to action|button|pill)\b/i.test(brief)
    if (!hasOfferRef && !hasCtaWord) {
      return {
        code: 'brief_vague',
        message: 'Brief omits the offer/CTA from the post form — image will lack a call to action.',
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
  const ctaLine = offer
    ? ` Include a visible CTA button or pill with text like "${offer.slice(0, 40)}" — not a generic "Let's talk".`
    : ' Include one short CTA line or button tied to the post goal (e.g. "Start free trial", "See how it works") — not generic filler.'

  return `Instagram/LinkedIn post graphic for ${companyName}: bold marketing headline (under 8 words) about ${goal}.${audienceLine}${includeLine}${ctaLine} Full-bleed social layout with headline + supporting line — NOT a logo tile, invented wordmark, monogram, abstract brand-mark grid, or geometric identity symbol. Do NOT draw or invent any logo icon — user did not request a logo on this post. Do NOT make "${companyName}" the hero text. Company name may appear small in a corner at most. Stay on the B2B marketing SaaS product described in Foundation — no random coffee-shop or lifestyle scenes unless the post ask requests them.`
}
