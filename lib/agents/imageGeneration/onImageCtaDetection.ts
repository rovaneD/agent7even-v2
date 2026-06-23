import type { TextQaIssue } from './types'
import type { PostGroundingContext } from './postGrounding'

/** Social post images = headline (+ optional subhead) only — CTAs live in the caption/link. */
export const NO_ON_IMAGE_CTA_RULE =
  'NO on-image CTA buttons, pills, or arrow links (e.g. "See how it works", "Learn how", "Start free trial") — headline text only unless Must include explicitly requests a button.'

const ON_IMAGE_CTA_PATTERNS = [
  /\bsee how it works\b/i,
  /\blearn how\b/i,
  /\bstart (?:your )?free trial\b/i,
  /\bget started\b/i,
  /\bget real results\b/i,
  /\bmeet maya\b/i,
  /\bsign up\b/i,
  /\btry free\b/i,
  /\blearn more\b/i,
  /\bbook a (?:demo|call)\b/i,
  /\blet'?s talk\b/i,
]

function allowsOnImageCta(postContext?: PostGroundingContext): boolean {
  const text = [postContext?.mustInclude, postContext?.mustAvoid].filter(Boolean).join(' ')
  return /\bon-image\s+(?:cta|button)|(?:cta|button)\s+on (?:the )?image|include a button\b/i.test(text)
}

/** Post-render: generic CTA button baked into the image (not allowed for social posts). */
export function detectUnwantedOnImageCtaButtons(
  transcription: string | null | undefined,
  postContext?: PostGroundingContext,
): TextQaIssue[] {
  if (allowsOnImageCta(postContext)) return []
  const text = transcription?.trim()
  if (!text) return []

  for (const pattern of ON_IMAGE_CTA_PATTERNS) {
    if (pattern.test(text)) {
      return [{
        code: 'unwanted_cta',
        message: 'Image includes an on-image CTA button — social posts use headline-only visuals; CTAs belong in the caption.',
      }]
    }
  }
  return []
}

const CTA_BUTTON_BRIEF_PATTERNS = [
  /\bcta button\b/i,
  /\bcall-to-action button\b/i,
  /\b(?:visible|include|add).{0,20}\b(?:cta|button|pill)\b/i,
  /\b(?:blue|electric).{0,20}\bbutton\b/i,
  /\bpill with text\b/i,
]

/** Brief steers toward on-image CTA buttons. */
export function detectOnImageCtaBrief(
  brief: string,
  postContext?: PostGroundingContext,
): TextQaIssue | null {
  if (allowsOnImageCta(postContext)) return null

  for (const pattern of CTA_BUTTON_BRIEF_PATTERNS) {
    if (pattern.test(brief)) {
      return {
        code: 'brief_unwanted_cta',
        message: 'Brief requests an on-image CTA button — social post images should be headline-only.',
      }
    }
  }
  return null
}

export function stripOnImageCtaFromBrief(brief: string): string {
  let out = brief
  out = out.replace(
    /\b(?:include|add|visible).{0,30}\b(?:cta|call-to-action).{0,20}\bbutton\b[^.]*\.?/gi,
    'headline text only — no on-image buttons.',
  )
  out = out.replace(/\bcta button\b/gi, 'headline')
  out = out.replace(/\bpill with text like[^.]+/gi, 'headline copy')
  return out.replace(/\s{2,}/g, ' ').trim()
}
