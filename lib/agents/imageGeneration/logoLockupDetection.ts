import type { TextQaIssue } from './types'
import type { PostGroundingContext } from './postGrounding'
import { buildGroundedSocialPostBrief } from './postGrounding'

const LOGO_BRIEF_PATTERNS = [
  /\bwordmark\b/i,
  /\blogo lockup\b/i,
  /\blogomark\b/i,
  /\bbrand mark\b/i,
  /\bmonogram\b/i,
  /\babstract (?:logo|mark|icon|symbol|emblem)\b/i,
  /\b(?:logo|wordmark|brand icon) (?:as|for|in) (?:the )?(?:hero|focal|center|centrepiece|centerpiece|corner|header)\b/i,
  /\bidentity (?:tile|card|lockup|system|grid)\b/i,
  /\bcentered (?:logo|wordmark|brand name)\b/i,
  /\bcompany name (?:as|for) (?:the )?(?:hero|focal|main visual|primary)\b/i,
  /\b(?:geometric|abstract) (?:grid|pattern|tile|mosaic|mark)\b/i,
  /\b(?:three|3) (?:bars|pillars|columns) (?:as|for) (?:visual|hero|graphic)\b/i,
  /\bbrand icon (?:top|bottom|corner)\b/i,
]

/** Brief steers toward logo/identity design instead of a social post. */
export function detectLogoLockupBrief(brief: string): TextQaIssue | null {
  for (const pattern of LOGO_BRIEF_PATTERNS) {
    if (pattern.test(brief)) {
      return {
        code: 'brief_logo_lockup',
        message: 'Brief requests a logo/wordmark lockup — social posts need a marketing headline, not identity design.',
      }
    }
  }
  return null
}

function normalizeForCompare(text: string): string {
  return text.replace(/[^\w\s']/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Post-render: brand name only (or brand + tiny tagline) with no marketing headline. */
export function detectLogoLockupInImageText(
  transcription: string | null | undefined,
  brandNames: string[] = [],
): TextQaIssue[] {
  const text = transcription?.trim()
  if (!text) return []

  const normalized = normalizeForCompare(text)
  if (!normalized) return []

  const brandNorms = brandNames.map(n => normalizeForCompare(n)).filter(n => n.length >= 3)
  const words = normalized.split(' ').filter(Boolean)

  // Only brand name visible — classic logo tile output
  if (brandNorms.some(b => normalized === b)) {
    return [{
      code: 'logo_lockup',
      message: 'Image shows only the brand name — looks like a logo tile, not a social post with a marketing headline.',
    }]
  }

  // Brand name is the longest line and total copy is very short (no real headline)
  if (words.length <= 4 && brandNorms.some(b => normalized.includes(b))) {
    const hasMarketingShape =
      /\b(results|without|stop|get|your|how|why|free|trial|marketing|clients?|growth|save|start)\b/i.test(text)
    if (!hasMarketingShape) {
      return [{
        code: 'logo_lockup',
        message: 'Prominent text is mostly the brand name with no post-specific marketing headline.',
      }]
    }
  }

  return []
}

const VAGUE_SOCIAL_BRIEF =
  /\bclean social post visual\b/i

/** Brief is too generic — models default to logo tiles instead of headline posts. */
export function detectVagueSocialBrief(brief: string): TextQaIssue | null {
  if (VAGUE_SOCIAL_BRIEF.test(brief)) {
    return {
      code: 'brief_logo_lockup',
      message: 'Brief is too generic — likely to produce a logo tile instead of a marketing headline post.',
    }
  }

  const hasHeadlineIntent =
    /\bheadline\b/i.test(brief)
    || /\b(?:quote|cta|call to action|pain point|offer|stat|number)\b/i.test(brief)
    || /["'][^"']{8,}["']/.test(brief)

  if (!hasHeadlineIntent && /\b(?:social post|instagram|linkedin)\b/i.test(brief) && brief.length < 280) {
    return {
      code: 'brief_logo_lockup',
      message: 'Brief lacks a concrete marketing headline — likely to produce a logo tile.',
    }
  }

  return null
}

export function buildSocialPostReplacementBrief(
  companyName: string,
  themeHint?: string | PostGroundingContext,
): string {
  if (themeHint && typeof themeHint === 'object') {
    return buildGroundedSocialPostBrief(companyName, themeHint)
  }
  const theme = typeof themeHint === 'string' ? themeHint.trim() : ''
  return buildGroundedSocialPostBrief(companyName, {
    postGoal: theme || 'the post goal and customer pain point',
  })
}
