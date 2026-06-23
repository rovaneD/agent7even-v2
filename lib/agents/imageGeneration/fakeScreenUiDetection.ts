import type { TextQaIssue } from './types'
import type { PostGroundingContext } from './postGrounding'

const FAKE_SCREEN_UI_BRIEF_PATTERNS = [
  /\b(?:laptop|computer|macbook|screen|monitor).{0,50}(?:dashboard|analytics|chart|graph|data viz|ui mockup|saas ui|software interface)\b/i,
  /\b(?:dashboard|analytics|chart|graph).{0,50}(?:on (?:the |her |his |their )?(?:laptop|screen|monitor|computer))\b/i,
  /\b(?:looking at|staring at|working on).{0,30}(?:laptop|computer).{0,40}(?:showing|displaying|with)\b/i,
  /\b(?:scattered|spread|printed).{0,30}(?:papers|documents|reports).{0,30}(?:chart|graph|pie chart|bar chart)\b/i,
  /\bfake dashboard\b/i,
  /\blaptop screen.{0,30}(?:shows|showing|displays|displaying)\b/i,
]

const ALLOWS_DATA_VIZ =
  /\b(?:dashboard|chart|graph|analytics|data viz|report|infographic)\b/i

/** Brief steers toward fake laptop/dashboard UI — common AI slop. */
export function detectFakeScreenUiBrief(
  brief: string,
  postContext?: PostGroundingContext,
): TextQaIssue | null {
  const postText = [
    postContext?.postGoal,
    postContext?.mustInclude,
  ]
    .filter(Boolean)
    .join(' ')
  if (ALLOWS_DATA_VIZ.test(postText) && /\b(?:dashboard|chart|screen)\b/i.test(postText)) {
    return null
  }

  for (const pattern of FAKE_SCREEN_UI_BRIEF_PATTERNS) {
    if (pattern.test(brief)) {
      return {
        code: 'brief_fake_screen_ui',
        message: 'Brief requests a readable laptop/dashboard screen — models render blurry fake UI. Angle screen away, off, or defocused instead.',
      }
    }
  }
  return null
}

/** Safe laptop-at-work wording for brief rewrites. */
export const LAPTOP_SCREEN_SAFE_LINE =
  'If a laptop appears: screen angled away from camera, closed, dark/asleep, or soft out-of-focus bokeh — NEVER a readable fake dashboard, chart grid, or SaaS UI on the screen. No scattered papers with fake charts on the desk.'

export function stripFakeScreenUiFromBrief(brief: string): string {
  let out = brief
  out = out.replace(
    /\b(?:laptop|computer) screen.{0,40}(?:shows|showing|displays|displaying|with).{0,60}(?:dashboard|chart|graph|analytics|ui)[^.]*/gi,
    'laptop with screen turned away or defocused',
  )
  out = out.replace(
    /\b(?:scattered|spread).{0,20}(?:papers|documents|reports).{0,40}(?:chart|graph)[^.]*/gi,
    'minimal desk props without readable charts',
  )
  out = out.replace(/\bfake dashboard\b/gi, 'plain laptop')
  return out.replace(/\s{2,}/g, ' ').trim()
}

export const FAKE_SCREEN_UI_QA_RULE = `- Readable fake software dashboard, analytics grid, or chart UI on a laptop/phone/monitor screen (blurry nonsense data is a common AI artifact — flag code fake_screen_ui). Person-at-laptop scenes are OK only when the screen is off, angled away, closed, or too defocused to read.`
