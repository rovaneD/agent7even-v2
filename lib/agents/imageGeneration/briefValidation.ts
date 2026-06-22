import type { ImageGenerationModelId } from './imageModelCatalog'
import {
  buildSocialPostReplacementBrief,
  detectLogoLockupBrief,
  detectVagueSocialBrief,
} from './logoLockupDetection'
import { detectBriefMissingPostGrounding, type PostGroundingContext } from './postGrounding'
import type { TextQaIssue } from './types'

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

  const groundingIssue = detectBriefMissingPostGrounding(brief, postContext)
  if (groundingIssue) issues.push(groundingIssue)

  return issues
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
    return `Editorial photograph for ${companyName} social post: an authentic, cinematic scene that visually metaphorizes ${theme}. Natural lighting, shallow depth of field, real environment (workspace detail, hands at work, decisive moment — never a chart, diagram, infographic, or pillar layout). Apply the brand palette through scene color grading only — never as labels. Absolutely no text, typography, headlines, hex codes, color names, font specs, or graphic overlays anywhere in the frame.`
  }

  const needsGroundedRewrite = issues.some(
    i => i.code === 'brief_logo_lockup' || i.code === 'brief_vague',
  )
  if (needsGroundedRewrite) {
    return buildSocialPostReplacementBrief(companyName, postContext ?? { postGoal: extractThemeHint(brief) })
  }

  const stripped = stripDesignSpecsFromBrief(brief)
  return `${stripped}

Apply brand colors and typography silently in the render only. Do NOT print hex codes, color token names, swatches, font family names, or weight numbers as visible text.`
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
    return `Professional editorial photograph for ${companyName}: natural lighting, shallow depth of field, authentic business metaphor (hands at work, thoughtful pause, movement in a real environment). Absolutely no text, typography, charts, labels, hex codes, or graphic overlays anywhere in the frame.`
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
      || i.code === 'vague_headline'
      || i.code === 'missing_cta'
      || i.code === 'invented_logo'
      || i.code === 'brief_vague',
  )
  if (needsGroundedRewrite) {
    return buildSocialPostReplacementBrief(
      companyName,
      postContext ?? { postGoal: extractThemeHint(brief) },
    )
  }

  const summary = issues.map(i => i.message).join(' ')
  return `${stripDesignSpecsFromBrief(brief)}

FIX PREVIOUS RENDER: ${summary}
Do NOT repeat these mistakes. No hex codes or design token labels as visible text.`
}
