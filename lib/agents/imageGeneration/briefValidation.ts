import type { ImageGenerationModelId } from './imageModelCatalog'
import { detectTextlessStockBrief } from './headlineRequiredBrief'
import {
  buildSocialPostReplacementBrief,
  detectLogoLockupBrief,
  detectLifestyleDefaultBrief,
  detectVagueSocialBrief,
} from './logoLockupDetection'
import { detectFakeScreenUiBrief, stripFakeScreenUiFromBrief } from './fakeScreenUiDetection'
import { detectOnImageCtaBrief, stripOnImageCtaFromBrief } from './onImageCtaDetection'
import { detectBriefMissingPostGrounding, type PostGroundingContext } from './postGrounding'
import type { TextQaIssue } from './types'
import { extractHeadlineFromBrief } from './headlineExtract'
import { stripObjectivePrefix } from './postObjective'

const PHOTOREAL_FORBIDDEN_BRIEF = [
  /\bdata visualization\b/i,
  /\bbar chart\b/i,
  /\bascending bars?\b/i,
  /\b(?:bars|pillars)\s+or\s+(?:bars|pillars)\b/i,
  /\bpillar(s)?\b/i,
  /\binfographic\b/i,
  /\bstat card\b/i,
  /\bdashboard\b/i,
  /\b(?:line|pie|donut|column) chart\b/i,
  /\bminimalist (?:chart|graph|diagram|data)\b/i,
  /\bthree (?:bars|pillars|columns)\b/i,
  /\b(?:labeled|labelled) (?:bars|pillars|segments)\b/i,
  /\barchitectural style\b/i,
  /\bgeometric forms?\b/i,
]

const COLOR_TOKEN_NAMES =
  /\b(strategic slate|growth green|insight amber|clarity white|brand orange|primary blue|accent pink)\b/i

const HEX_IN_BRIEF = /#(?:[0-9A-Fa-f]{3}){1,2}\b/
const NAMED_COLOR_WITH_HEX = /\b[A-Za-z][\w\s-]{0,32}\s*\(#(?:[0-9A-Fa-f]{3}){1,2}\)/
const FONT_SPEC_IN_BRIEF =
  /\b(?:inter|lora|geist|roboto|montserrat|poppins|dm\s+sans)\s+(?:weight\s+)?\d{3}\b/i

/** Block briefs that steer the image model toward known bad outputs for this pick. */
export function validateBriefForModel(
  brief: string,
  modelId: ImageGenerationModelId,
  postContext?: PostGroundingContext,
): TextQaIssue[] {
  const issues: TextQaIssue[] = []

  if (modelId === 'photoreal') {
    for (const pattern of PHOTOREAL_FORBIDDEN_BRIEF) {
      if (pattern.test(brief)) {
        issues.push({
          code: 'brief_model_mismatch',
          message: 'Brief requests chart/infographic layout — not allowed for Photoreal.',
        })
        break
      }
    }

    if (
      /\b(?:include|add|feature|with)\s+(?:one\s+)?(?:powerful\s+)?headline\b/i.test(brief)
      || /\bheadline[^.\n]{0,50}(?:positioned|weight|inter|top)\b/i.test(brief)
    ) {
      issues.push({
        code: 'brief_model_mismatch',
        message: 'Brief requests on-image text — not allowed for Photoreal.',
      })
    }
  }

  if (HEX_IN_BRIEF.test(brief) || NAMED_COLOR_WITH_HEX.test(brief)) {
    issues.push({
      code: 'brief_design_leak',
      message: 'Brief contains hex codes — image models often render these as visible labels.',
    })
  }

  if (FONT_SPEC_IN_BRIEF.test(brief) || /\bweight\s+\d{3}\b/i.test(brief)) {
    issues.push({
      code: 'brief_font_leak',
      message: 'Brief contains font weight specs that leak into renders.',
    })
  }

  if (COLOR_TOKEN_NAMES.test(brief)) {
    issues.push({
      code: 'brief_design_leak',
      message: 'Brief copies Brand Kit color token names that image models render as labels.',
    })
  }

  const logoIssue = detectLogoLockupBrief(brief) ?? detectVagueSocialBrief(brief)
  if (logoIssue) issues.push(logoIssue)

  const lifestyleIssue = detectLifestyleDefaultBrief(brief, postContext)
  if (lifestyleIssue) issues.push(lifestyleIssue)

  const screenUiIssue = detectFakeScreenUiBrief(brief, postContext)
  if (screenUiIssue) issues.push(screenUiIssue)

  const ctaButtonIssue = detectOnImageCtaBrief(brief, postContext)
  if (ctaButtonIssue) issues.push(ctaButtonIssue)

  const groundingIssue = detectBriefMissingPostGrounding(brief, postContext, modelId)
  if (groundingIssue) issues.push(groundingIssue)

  const textlessIssue = detectTextlessStockBrief(brief, modelId)
  if (textlessIssue) issues.push(textlessIssue)

  return issues
}

const NEGATION = /\b(?:no|not|never|avoid|avoiding|without|don'?t|do not|nothing|none|free of)\b/i

/**
 * Image models draw what a prompt names, so "no laptop logos" produces laptop logos.
 * Drop sentences that describe what should be absent. Sentences carrying the quoted
 * headline are kept whole.
 */
export function dropNegativeSentences(brief: string): string {
  // Shield quoted text so punctuation inside a headline doesn't split a sentence.
  const quotes: string[] = []
  const shielded = brief.replace(/["\u201c][^"\u201d]*["\u201d]/g, q => `\u0000${quotes.push(q) - 1}\u0000`)
  const sentences = shielded.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [shielded]
  const kept = sentences.filter(s => s.includes('\u0000') || !NEGATION.test(s))
  const out = kept.join(' ').replace(/\u0000(\d+)\u0000/g, (_m, i: string) => quotes[Number(i)]!).replace(/\s{2,}/g, ' ').trim()
  return out.length >= 40 ? out : brief
}

/** Remove design-system tokens from brief text before sending to an image model. */
export function stripDesignSpecsFromBrief(brief: string): string {
  let out = brief

  out = out.replace(/\b[A-Za-z][\w\s-]{0,32}\s*\(#(?:[0-9A-Fa-f]{3}){1,2}\)/g, 'a brand-appropriate accent color')
  out = out.replace(/#(?:[0-9A-Fa-f]{3}){1,2}\b/g, 'brand color')
  out = out.replace(
    /\b(?:inter|lora|geist|roboto|montserrat|poppins|dm\s+sans)\s+(?:weight\s+)?\d{3}\b/gi,
    'bold brand typography',
  )
  out = out.replace(/\bweight\s+\d{3}\b/gi, 'bold weight')
  out = out.replace(COLOR_TOKEN_NAMES, 'brand accent')
  out = out.replace(
    /\b(?:warm amber|terracotta|burnt orange|earthy brown|brown cta|brown button|amber button|orange button)\b/gi,
    'electric blue accent',
  )
  out = out.replace(/\bsepia(?: tone)?\b/gi, 'clean natural color')
  out = out.replace(
    /\b(?:logo|wordmark|brand mark|emblem|neon sign).{0,30}\b(?:on|atop|across) (?:the )?(?:laptop|wall|device|background)\b/gi,
    'a plain surface',
  )

  out = stripFakeScreenUiFromBrief(out)
  out = stripOnImageCtaFromBrief(out)
  out = dropNegativeSentences(out)
  out = out.replace(/(["'])([^"']{3,})\1/g, (_m, q: string, inner: string) => `${q}${stripObjectivePrefix(inner)}${q}`)

  return out.replace(/\s{2,}/g, ' ').trim()
}

function extractThemeHint(brief: string): string {
  const themePatterns = [
    /represents (.+?)(?:\.|$)/i,
    /suggest(s)? (.+?)(?:\.|—|--)/i,
    /metaphor(?:ize|izes|izing)? (.+?)(?:\.|$)/i,
  ]
  for (const pattern of themePatterns) {
    const match = brief.match(pattern)
    if (match?.[1]?.trim()) return match[1].trim().slice(0, 200)
  }
  return 'the post goal and brand positioning'
}

/** Final brief sent to the image model — rewrite bad Photoreal briefs instead of appending fixes. */
export function prepareBriefForImageModel(
  brief: string,
  modelId: ImageGenerationModelId,
  companyName: string,
  postContext?: PostGroundingContext,
): string {
  const issues = validateBriefForModel(brief, modelId, postContext)
  if (issues.length === 0) return stripDesignSpecsFromBrief(brief)

  const hasPhotorealLayoutIssue = modelId === 'photoreal'
    && issues.some(i => i.code === 'brief_model_mismatch')

  if (hasPhotorealLayoutIssue) {
    const theme = extractThemeHint(brief)
    return `Editorial photograph for ${companyName} social post: one specific physical object that visually metaphorizes ${theme}, shot like a product photo on a plain seamless background. Soft studio lighting, shallow depth of field, generous negative space, the brand palette carried by the color grade. A clean, purely photographic frame.`
  }

  const needsGroundedRewrite = issues.some(
    i =>
      i.code === 'brief_logo_lockup'
      || i.code === 'brief_vague'
      || i.code === 'brief_lifestyle_default'
      || i.code === 'brief_fake_screen_ui'
      || i.code === 'brief_unwanted_cta'
      || i.code === 'brief_textless_stock',
  )
  if (needsGroundedRewrite) {
    return buildSocialPostReplacementBrief(
      companyName,
      postContext ?? { postGoal: extractThemeHint(brief) },
      extractHeadlineFromBrief(brief),
    )
  }

  const stripped = stripDesignSpecsFromBrief(brief)
  const headline = extractHeadlineFromBrief(stripped)
  return headline && modelId !== 'photoreal'
    ? `${stripped} The headline "${headline}" is the only text in the image.`
    : stripped
}

/** @deprecated Use prepareBriefForImageModel */
export function tightenBriefForModel(
  brief: string,
  modelId: ImageGenerationModelId,
  companyName = 'the brand',
): string {
  return prepareBriefForImageModel(brief, modelId, companyName)
}

export function buildSafeFallbackBrief(
  modelId: ImageGenerationModelId,
  companyName: string,
  postContext?: PostGroundingContext,
): string {
  if (modelId === 'photoreal') {
    return `Professional still-life photograph for ${companyName}: one specific object as a business metaphor on a plain seamless background, soft studio lighting, shallow depth of field. A clean, purely photographic frame.`
  }

  return buildSocialPostReplacementBrief(companyName, postContext)
}

export function appendQaFixToBrief(
  brief: string,
  issues: TextQaIssue[],
  modelId: ImageGenerationModelId,
  companyName: string,
  postContext?: PostGroundingContext,
): string {
  if (modelId === 'photoreal') {
    return buildSafeFallbackBrief(modelId, companyName, postContext)
  }

  const needsGroundedRewrite = issues.some(
    i =>
      i.code === 'logo_lockup'
      || i.code === 'brief_logo_lockup'
      || i.code === 'brief_lifestyle_default'
      || i.code === 'vague_headline'
      || i.code === 'unwanted_cta'
      || i.code === 'brief_unwanted_cta'
      || i.code === 'invented_logo'
      || i.code === 'environmental_logo'
      || i.code === 'off_palette_grade'
      || i.code === 'fake_screen_ui'
      || i.code === 'brief_textless_stock'
      || i.code === 'missing_headline'
      || i.code === 'typo'
      || i.code === 'brief_vague',
  )
  if (needsGroundedRewrite) {
    // Typo / spelling retries keep the intended copy; content failures (vague, logo) rewrite it.
    const keepCopy = issues.every(i => i.code === 'typo' || i.code === 'missing_headline' || i.code === 'invented_logo' || i.code === 'environmental_logo' || i.code === 'fake_screen_ui' || i.code === 'off_palette_grade' || i.code === 'unwanted_cta')
    return buildSocialPostReplacementBrief(
      companyName,
      postContext ?? { postGoal: extractThemeHint(brief) },
      keepCopy ? extractHeadlineFromBrief(brief) : null,
    )
  }

  // Restate what we want instead of listing the failure: naming the mistake re-primes it.
  const stripped = stripDesignSpecsFromBrief(brief)
  const headline = extractHeadlineFromBrief(stripped)
  return headline
    ? `${stripped} Typography: the headline "${headline}" spelled exactly as written, crisp and fully legible, and it is the only text in the image.`
    : stripped
}
