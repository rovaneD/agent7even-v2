export type ImageEditMode = 'text-only' | 'visual'

/** Pull quoted replacement copy from user instruction when present. */
export function extractQuotedText(instruction: string): string | null {
  const match = instruction.match(/["']([^"']+)["']/)
  return match?.[1]?.trim() ?? null
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
}): string {
  const instruction = opts.editInstruction.trim()

  if (opts.mode === 'text-only') {
    const headline = extractQuotedText(instruction)
    const headlineBlock = headline
      ? `\nThe output MUST display this exact headline text prominently (same general placement as before):\n"${headline}"\n`
      : '\nThe output MUST still include clear on-image headline text — do NOT remove or omit text.\n'

    return `IN-PLACE TEXT EDIT ONLY — the attached image is the source of truth.

Change ONLY the on-image text/headline as requested. Do NOT change anything else:
- Keep the same background, objects, people, lighting, crop, and layout
- Keep the same colors, textures, shadows, and graphic elements
- Keep the same composition and spacing — only replace the specified words in the text area
- Do NOT re-render, recompose, redesign, or generate a new concept
- Do NOT produce a textless or blank image
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
  const headline = extractQuotedText(editInstruction)
  const headlineBlock = headline
    ? `\nREQUIRED HEADLINE TEXT (must appear legibly on the image):\n"${headline}"\n`
    : ''

  return `${originalBrief.trim()}

CRITICAL TEXT-ONLY REVISION — recreate the SAME scene and layout with updated on-image copy:
- Match the previous composition, subjects, background, colors, and layout as closely as possible
- Change ONLY the on-image headline/text as specified below
- Do NOT introduce a new scene, metaphor, or layout
- The image MUST include readable on-image text — never output a textless image
${headlineBlock}
Text change to apply:
${editInstruction.trim()}`
}
