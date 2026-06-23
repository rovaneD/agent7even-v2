import { LAPTOP_SCREEN_SAFE_LINE } from './fakeScreenUiDetection'

export type ImageEditMode = 'text-only' | 'visual'

/** Max server-side QA retries after a text-only edit (img2img only — layout preserved). */
export const TEXT_EDIT_QA_MAX_RETRIES = 2

/** Pull quoted replacement copy from user instruction when present. */
export function extractQuotedText(instruction: string): string | null {
  const match = instruction.match(/["']([^"']+)["']/)
  return match?.[1]?.trim() ?? null
}

/** Headline the user asked for — quoted copy or "change/fix to X" patterns. */
export function extractExpectedHeadline(instruction: string): string | null {
  const quoted = extractQuotedText(instruction)
  if (quoted) return quoted

  const changeTo = instruction.match(
    /\b(?:change|fix|update|replace|set)\s+(?:the\s+)?(?:headline|text|copy)\s+to\s+(.+?)(?:\s*[—–-]\s*keep|\s*\.|$)/i,
  )
  if (changeTo?.[1]?.trim()) {
    return changeTo[1].replace(/^["']|["']$/g, '').trim()
  }

  return null
}

function spellingStrictHeadlineBlock(headline: string): string {
  const words = headline.split(/\s+/).filter(Boolean)
  const wordList = words.map(w => `"${w}"`).join(', ')
  return `HEADLINE — spell character-perfect (each word exactly: ${wordList}):
"${headline}"

Common AI mistakes to AVOID in this headline:
- "run" must not render as rour, pour, rrun, roum, or rou
- "your" must not render as yrou, yor, or your with missing letters
- Every word must be a real English word — no garbled letter soup`
}

export function detectImageEditMode(instruction: string): ImageEditMode {
  const lower = instruction.toLowerCase()
  const textSignals =
    /\b(headline|subhead|text|typo|spelling|word|words|copy|title|caption|lettering|font|say|reads?|fix the|change the text|replace the text)\b/
  const visualSignals =
    /\b(model|person|people|man|woman|male|female|background|scene|layout|composition|photo|subject|pose|outfit|swap|replace the (person|image|photo|model))\b/

  const hasText = textSignals.test(lower)
  const hasVisual = visualSignals.test(lower)

  if (hasText && !hasVisual) return 'text-only'
  if (hasVisual && !hasText) return 'visual'
  // Ambiguous — default to text-only when user mentions "only" or quoted replacement copy
  if (/\bonly\b|["']/.test(lower)) return 'text-only'
  return 'visual'
}

export function buildImageEditPrompt(opts: {
  editInstruction: string
  brief?: string
  mode: ImageEditMode
  spellingRetry?: boolean
}): string {
  const instruction = opts.editInstruction.trim()

  if (opts.mode === 'text-only') {
    const headline = extractExpectedHeadline(instruction)
    const headlineBlock = headline
      ? `\n${spellingStrictHeadlineBlock(headline)}
The output MUST display this headline in the SAME text overlay region as the source (same box, position, size, and style).\n`
      : '\nThe output MUST still include clear on-image headline text — do NOT remove or omit text.\n'

    const retryBlock = opts.spellingRetry
      ? `\nRETRY — previous output had misspelled headline text. Fix spelling ONLY. Layout is LOCKED — do not move, resize, or restyle the headline area, people, furniture, or background.\n`
      : ''

    return `IN-PLACE TEXT EDIT ONLY — the attached image is the source of truth.
${retryBlock}
Change ONLY the on-image text/headline as requested. Do NOT change anything else:
- Keep the same background, objects, people, lighting, crop, and layout
- Keep the same colors, textures, shadows, graphic elements, and text overlay shape
- Keep the same composition and spacing — only replace the specified words in the text area
- New headline copy may be longer or shorter but MUST stay in the same overlay region — do not relocate text
- Do NOT re-render, recompose, redesign, or generate a new concept
- Do NOT produce a textless or blank image
- Render every word with correct spelling — no garbled or substituted letters
${headlineBlock}
Requested text change:
${instruction}`
  }

  return `TARGETED VISUAL EDIT — use the attached image as the starting point.

Preserve brand colors, layout, typography style, and overall composition unless the edit explicitly requires a change.
Change only what the instruction asks for.

Original generation brief (context only — do not regenerate from scratch):
${opts.brief?.trim() || 'N/A'}

Apply this change:
${instruction}`
}

export function buildTextOnlyRegenBrief(originalBrief: string, editInstruction: string): string {
  const headline = extractExpectedHeadline(editInstruction)
  const headlineBlock = headline
    ? `\n${spellingStrictHeadlineBlock(headline)}\n`
    : ''

  return `${originalBrief.trim()}

CRITICAL TEXT-ONLY REVISION — in-place edit on the attached source image:
- Change ONLY the on-image headline/text as specified below
- Keep the same people, background, lighting, crop, colors, and layout
- Do NOT introduce a new scene, subject, metaphor, or composition
- The image MUST include readable on-image text — never output a textless image
- Every word must be spelled correctly — no garbled letters
${headlineBlock}
Text change to apply:
${editInstruction.trim()}`
}

/** Recraft re-render: vision scene + exact headline (sharp typography, approximate layout). */
export function buildRecraftTextEditBrief(opts: {
  sceneDescription: string
  headline: string
  editInstruction: string
  originalBrief?: string
  spellingRetry?: boolean
}): string {
  const retryNote = opts.spellingRetry
    ? '\nPREVIOUS ATTEMPT HAD GARBLED TEXT — this retry must be letter-perfect.\n'
    : ''

  return `Instagram/LinkedIn post graphic — recreate the SAME scene with sharp, legible headline typography.
${retryNote}
SCENE (match this composition closely — same subject, setting, and mood):
${opts.sceneDescription.trim()}

${spellingStrictHeadlineBlock(opts.headline)}

Layout: full-bleed social post with headline overlay only — no CTA buttons or pills.
Do NOT invent logos on laptop lids, neon signs, or device decals.
${LAPTOP_SCREEN_SAFE_LINE}
Do NOT change to a different person, shop type, or metaphor.

Context from original brief (secondary — scene block above is primary):
${opts.originalBrief?.trim().slice(0, 600) || 'N/A'}

User edit request:
${opts.editInstruction.trim()}`
}
