import { stripDesignSpecsFromBrief } from '@/lib/agents/imageGeneration/briefValidation'
import { detectFakeScreenUiBrief, LAPTOP_SCREEN_SAFE_LINE } from '@/lib/agents/imageGeneration/fakeScreenUiDetection'
import {
  detectOnImageCtaBrief,
  NO_ON_IMAGE_CTA_RULE,
} from '@/lib/agents/imageGeneration/onImageCtaDetection'
import {
  detectLifestyleDefaultBrief,
  detectLogoLockupBrief,
  detectVagueSocialBrief,
} from '@/lib/agents/imageGeneration/logoLockupDetection'
import {
  detectBriefMissingPostGrounding,
  type PostGroundingContext,
} from '@/lib/agents/imageGeneration/postGrounding'
import type { TextQaIssue } from '@/lib/agents/imageGeneration/types'

const HEX_IN_BRIEF = /#(?:[0-9A-Fa-f]{3}){1,2}\b/
const COLOR_TOKEN_NAMES =
  /\b(strategic slate|growth green|insight amber|clarity white|brand orange|primary blue|accent pink)\b/i

/** Fallback brief when compose or validation detects known bad patterns. */
export function buildGroundedVideoBrief(
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
    ? ` Offer context (headline angle only, not a button): ${offer.slice(0, 60)}.`
    : ''
  const headlineWords = goal.split(/\s+/).slice(0, 8).join(' ')
  const quotedHeadline = `"${headlineWords.charAt(0).toUpperCase()}${headlineWords.slice(1)}"`

  return `9:16 vertical short-form video (8 seconds) for ${companyName}. Opening (0-2s): bright modern workspace or product-adjacent scene with neutral/cool daylight — no sepia or coffee-shop stock. Middle (2-6s): authentic business moment tied to ${goal} — camera slowly pushes in or cuts between focused desk moments.${audienceLine}${includeLine}${offerLine} Closing (6-8s): hold on the key visual beat. Text overlay: ${quotedHeadline} — bold sans, fades in center-frame, max 8 words. ${NO_ON_IMAGE_CTA_RULE} Electric blue accent on white/slate typography — no brown or terracotta grade. ${LAPTOP_SCREEN_SAFE_LINE} Do NOT invent logos on laptop lids, neon wall signs, or readable fake dashboards on screens. Company name may appear small in a corner at most — headline is the hero text.`
}

export function validateVideoBrief(
  brief: string,
  postContext?: PostGroundingContext,
): TextQaIssue[] {
  const issues: TextQaIssue[] = []

  if (HEX_IN_BRIEF.test(brief) || COLOR_TOKEN_NAMES.test(brief)) {
    issues.push({
      code: 'brief_design_leak',
      message: 'Brief contains hex codes or color token names that video models render as labels.',
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

  const groundingIssue = detectBriefMissingPostGrounding(brief, postContext)
  if (groundingIssue) issues.push(groundingIssue)

  if (!/["'][^"']{6,}["']/.test(brief)) {
    issues.push({
      code: 'brief_vague',
      message: 'Video brief must quote concrete on-screen headline copy in double quotes.',
    })
  }

  return issues
}

/** Final brief sent to the video model — strip leaks and rewrite known bad patterns. */
export function prepareBriefForVideo(
  brief: string,
  companyName: string,
  postContext?: PostGroundingContext,
): string {
  const issues = validateVideoBrief(brief, postContext)
  if (issues.length === 0) return stripDesignSpecsFromBrief(brief)

  const needsGroundedRewrite = issues.some(
    i =>
      i.code === 'brief_logo_lockup'
      || i.code === 'brief_vague'
      || i.code === 'brief_lifestyle_default'
      || i.code === 'brief_fake_screen_ui'
      || i.code === 'brief_unwanted_cta',
  )
  if (needsGroundedRewrite) {
    return buildGroundedVideoBrief(companyName, postContext)
  }

  return stripDesignSpecsFromBrief(brief)
}
